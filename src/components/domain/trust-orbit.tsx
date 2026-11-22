"use client";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** One person in the orbit. `ring` is how well they are known: 0 sits closest to the centre. */
export type OrbitPerson = {
  id: string; name: string; headline?: string | null;
  /** Their photo, passed only where they agreed to show it (see canShowPhoto). Otherwise initials. */
  photo?: string | null;
  ring: 0 | 1 | 2;
  /** The counters on the left this person belongs to. */
  groups: string[];
  /** How they are known, in words: "Worked with them", "Came through Sara". */
  note?: string | null;
  chips?: string[];
  href?: string | null;
  /** What the link on their card says. Defaults to "Open profile". */
  hrefLabel?: string;
  /** Who to show first when a circle is too full to draw everyone (higher first, e.g. trust). */
  weight?: number;
};
export type OrbitGroup = { key: string; label: string; hint?: string };
/** Who knows whom. Drawn only for the person in focus, and listed on their card. */
export type OrbitLink = { source: string; target: string };

// A stable number in [0, 1) from a string, so the same person always lands in the same place.
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const initials = (name: string) => name.split(/\s+/).map((s) => s[0] ?? "").join("").slice(0, 2).toUpperCase();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** 2,140 → "2.1k", 12,600 → "13k": a count you read at a glance. */
const compactCount = (n: number) => (n < 1000 ? String(n) : n < 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${Math.round(n / 1000)}k`);

// Each person carries one of the brand's own lights: it tints their glass, their glow and their initials.
const TINTS: [string][] = [["#9af2cf"], ["#ffb9ab"], ["#b4d0ff"], ["#f2d594"], ["#cfccff"]];
const tintOf = (name: string) => TINTS[Math.floor(hash(name) * TINTS.length)];

// Each circle is a band round the centre, as a share of the stage's half-width and half-height.
const BANDS: [number, number][] = [[0.34, 0.52], [0.58, 0.78], [0.84, 1]];
const RING_WORDS = ["closest to you", "in your middle circle", "on the edge"];

type Placed = OrbitPerson & { x: number; y: number; size: number; depth: number };

// The four corners of a viewfinder, drawn round the chosen face.
function Brackets() {
  return <span className="swarm-focus pointer-events-none absolute -inset-[5px]" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function Face({ p, size }: { p: { name: string; photo?: string | null }; size: number }) {
  if (p.photo) {
    // eslint-disable-next-line @next/next/no-img-element -- a small user photo from our own store or inline; no optimiser needed
    return <img src={p.photo} alt="" className="h-full w-full object-cover" draggable={false} />;
  }
  // Dark glass lit from one corner in the person's own tint, with their initials in that light.
  const [a] = tintOf(p.name);
  return <span className="grid h-full w-full place-items-center font-semibold leading-none tracking-[0.02em]" style={{ background: `radial-gradient(130% 120% at 26% 14%, ${a}80 0%, ${a}26 42%, transparent 70%), linear-gradient(160deg, #1d3266 0%, #0b1736 100%)`, color: a, fontSize: Math.max(8, Math.round(size * 0.36)) }}>{size >= 20 ? initials(p.name) : ""}</span>;
}

/**
 * The network as a swarm of faces round a glowing centre. Whoever is looking sits in the middle;
 * the people they know best sit closest, and everyone else further out. The counters filter the
 * swarm, and choosing a face pulls it forward, names it, and lights up the people it knows.
 * Used for the team's view of the whole network and for a member's own circle.
 */
export function TrustOrbit({ centre, people, groups, links = [], caption, label, moreHref, total, heightClass = "h-[calc(100vh-270px)] min-h-[520px]", compact = false }: {
  centre: { name: string; photo?: string | null };
  people: OrbitPerson[]; groups: OrbitGroup[]; links?: OrbitLink[];
  /** One plain line across the top of the stage. */
  caption?: string;
  /** What a screen reader hears for the whole picture. */
  label: string;
  /** Where "+N more" leads, for everyone the orbit does not draw. */
  moreHref?: string;
  /** The real size of the network, when `people` is only part of it. */
  total?: number;
  heightClass?: string; compact?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const counts = useMemo(() => new Map(groups.map((g) => [g.key, people.filter((p) => p.groups.includes(g.key)).length])), [groups, people]);
  const neighbours = useMemo(() => {
    const ids = new Set(people.map((p) => p.id)), m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => { if (!m.has(a)) m.set(a, new Set()); m.get(a)!.add(b); };
    for (const l of links) if (ids.has(l.source) && ids.has(l.target) && l.source !== l.target) { add(l.source, l.target); add(l.target, l.source); }
    return m;
  }, [links, people]);

  const layout = useMemo(() => {
    if (!box || box.w < 140 || box.h < 140) return null;
    const narrow = box.w < 520, small = narrow || compact;
    const base = small ? [42, 34, 28] : [60, 48, 38];
    const pad = small ? 14 : 30, top = caption ? 30 : 0;
    const cx = box.w / 2, cy = top + (box.h - top) / 2;
    const ry = Math.max(50, (box.h - top) / 2 - pad - base[2] / 2);
    const rx = Math.min(Math.max(50, box.w / 2 - pad - base[2] / 2), ry * 2.1);
    const hub = Math.round(clamp(Math.min(rx, ry) * 0.36, 40, compact ? 68 : 104));
    const placed: Placed[] = [];
    // A full network is not drawn face by face: each circle shows the people who matter most (and
    // whoever is chosen), and everyone else is counted in one quiet "+N" instead of a wall of tiles.
    const cap = (small ? [8, 12, 16] : [14, 22, 30]);
    const pool = group ? people.filter((p) => p.groups.includes(group)) : people;
    const shownIds = new Set<string>();
    let hidden = 0;
    for (const ring of [0, 1, 2] as const) {
      const all = pool.filter((p) => p.ring === ring).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || hash(a.id) - hash(b.id));
      all.slice(0, cap[ring]).forEach((p) => shownIds.add(p.id));
      hidden += Math.max(0, all.length - cap[ring]);
    }
    if (!group && total && total > people.length) hidden += total - people.length;
    if (selected && !shownIds.has(selected) && people.some((p) => p.id === selected)) shownIds.add(selected);
    const visible = people.filter((p) => shownIds.has(p.id));
    // A handful of people share one turn of the circle, so they spread out instead of bunching by ring.
    const few = visible.length <= 12;
    let k = 0;
    for (const ring of [0, 1, 2] as const) {
      const inRing = visible.filter((p) => p.ring === ring).sort((a, b) => hash(a.id) - hash(b.id));
      const n = inRing.length;
      if (!n) continue;
      const [lo, hi] = BANDS[ring];
      const room = Math.sqrt((Math.PI * rx * ry * (hi * hi - lo * lo)) / n) * 0.95;
      const size = Math.round(clamp(room, 14, base[ring]));
      const step = (Math.PI * 2) / n, start = hash(`ring${ring}`) * Math.PI * 2;
      inRing.forEach((p, i) => {
        // Evenly round the circle, then nudged along it and across the band, so it reads as a swarm, not a clock face.
        const th = few ? -Math.PI / 2 + (k++ * Math.PI * 2) / visible.length : start + i * step + (hash(`${p.id}a`) - 0.5) * step * 0.7;
        // Never closer than a clear gap from the centre, however small the stage.
        const f = Math.max(n <= 3 ? (lo + hi) / 2 : lo + hash(`${p.id}r`) * (hi - lo), (hub / 2 + size / 2 + (few ? 26 : 10)) / Math.min(rx, ry));
        // The orbits are tilted towards you: faces at the front read larger than faces at the back.
        const depth = (Math.sin(th) + 1) / 2;
        placed.push({ ...p, x: cx + rx * f * Math.cos(th), y: cy + ry * f * Math.sin(th), size: Math.round(size * (0.82 + 0.32 * depth)), depth });
      });
    }
    // Ease touching faces apart, a few passes, keeping them clear of the centre and inside the frame.
    const gap = small ? 4 : 7, top0 = top + 6;
    for (let pass = 0; pass < 36; pass++) {
      let moved = false;
      for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i], b = placed[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = (a.size + b.size) / 2 + gap;
        if (d < min) { const push = (min - d) / 2, ux = dx / d, uy = dy / d; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; moved = true; }
      }
      for (const q of placed) {
        const dx = q.x - cx, dy = q.y - cy, d = Math.hypot(dx, dy) || 0.01, min = hub / 2 + q.size / 2 + 10;
        if (d < min) { q.x = cx + (dx / d) * min; q.y = cy + (dy / d) * min; }
        q.x = clamp(q.x, q.size / 2 + 4, box.w - q.size / 2 - 4); q.y = clamp(q.y, top0 + q.size / 2, box.h - q.size / 2 - 4);
      }
      if (!moved) break;
    }
    return { cx, cy, rx, ry, hub, placed, narrow, hidden };
  }, [box, people, compact, caption, group, selected, total]);

  const byId = useMemo(() => new Map((layout?.placed ?? []).map((p) => [p.id, p])), [layout]);
  const focus = hover ?? selected;
  const focused = focus ? byId.get(focus) ?? null : null;
  const chosen = selected ? people.find((p) => p.id === selected) ?? null : null;
  const inGroup = (p: OrbitPerson) => !group || p.groups.includes(group);
  const lit = (id: string) => !focus || id === focus || !!neighbours.get(focus)?.has(id);
  const showNames = (layout?.placed.length ?? 0) <= 12;
  const stacked = compact; // the counters sit above the stage and the card below it
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const card = chosen ? (
    <PersonCard p={chosen} knows={[...(neighbours.get(chosen.id) ?? [])].map((id) => people.find((x) => x.id === id)).filter((x): x is OrbitPerson => !!x)} onPick={setSelected} onClose={() => setSelected(null)} />
  ) : null;

  return (
    <div className={cn("ink-stage swarm-shell flex w-full flex-col overflow-hidden rounded-[20px]", !stacked && "lg:flex-row")} data-trust-orbit onKeyDown={(e) => { if (e.key === "Escape") setSelected(null); }}>
      <div className={cn("flex flex-wrap gap-1.5 p-3", !stacked && "lg:w-[216px] lg:flex-none lg:flex-col lg:flex-nowrap lg:gap-2 lg:p-4")} role="group" aria-label="Show">
        {[{ key: "", label: "Everyone", hint: undefined as string | undefined }, ...groups].map((g) => {
          const on = (group ?? "") === g.key, n = g.key ? counts.get(g.key) ?? 0 : Math.max(total ?? 0, people.length);
          return (
            <button key={g.key || "all"} type="button" aria-pressed={on} disabled={!n && !on} onClick={() => { setGroup(g.key || null); setSelected(null); }}
              className={cn("swarm-count relative flex min-h-11 cursor-pointer items-center gap-2.5 overflow-hidden rounded-[14px] px-3 py-2 text-left transition-[border-color,background-color,box-shadow] duration-300 disabled:cursor-default disabled:opacity-45", on && "is-on", !stacked && "lg:min-h-[64px] lg:gap-3")}>
              <span className={cn("font-display text-[18px] font-light leading-none tabular", on ? "text-teal" : "num-grad", !stacked && "lg:min-w-[44px] lg:text-[28px]")}>{n}</span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold leading-tight text-ink">{g.label}</span>
                {g.hint ? <span className={cn("hidden text-[11.5px] leading-snug text-ink-muted", !stacked && "lg:block")}>{g.hint}</span> : null}
              </span>
              {/* How much of the network this is, as a thin line of light along the bottom. */}
              {people.length ? <span className="swarm-share" style={{ width: `${Math.min(100, Math.round((n / Math.max(total ?? 0, people.length)) * 100))}%` }} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      <div className="relative min-w-0 flex-1">
        <div ref={wrapRef} className={cn("swarm-stage relative w-full", heightClass)} onClick={() => setSelected(null)}>
          {caption ? <div className="pointer-events-none absolute inset-x-0 top-3 z-[5] flex justify-center px-3"><span className="orbit-tag max-w-full truncate px-3.5 py-1 text-[12px] text-ink-muted">{caption}</span></div> : null}
          {layout ? (
            <>
              <svg className="absolute inset-0 h-full w-full" role="img" aria-label={label}>
                <defs>
                  <linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7ee3bc" stopOpacity="0.55" /><stop offset="0.5" stopColor="#8fb0ff" stopOpacity="0.12" /><stop offset="1" stopColor="#a9a6ff" stopOpacity="0.45" /></linearGradient>
                  <linearGradient id={`${uid}-beam`} gradientUnits="userSpaceOnUse" x1={layout.cx} y1={layout.cy} x2={focused?.x ?? layout.cx} y2={focused?.y ?? layout.cy}><stop offset="0" stopColor="#7ee3bc" stopOpacity="0" /><stop offset="0.25" stopColor="#7ee3bc" /><stop offset="1" stopColor="#ffffff" /></linearGradient>
                </defs>
                {/* Dust: a still, evenly scattered field of faint points, a few of which twinkle. */}
                {Array.from({ length: layout.narrow || compact ? 28 : 64 }, (_, i) => <circle key={i} cx={((((i + 1) * 0.7548776662) % 1) * (box?.w ?? 0)).toFixed(1)} cy={((((i + 1) * 0.5698402910) % 1) * (box?.h ?? 0)).toFixed(1)} r={i % 6 ? 0.7 : 1.2} fill="#dfe9ff" opacity={0.1 + hash(`do${i}`) * 0.3} className={i % 5 === 0 ? "swarm-twinkle" : undefined} style={i % 5 === 0 ? { animationDelay: `${(hash(`dt${i}`) * 5).toFixed(1)}s` } : undefined} />)}
                {/* The three orbits, each with a point of light travelling round it. */}
                {BANDS.map(([lo, hi], r) => {
                  const a = layout.rx * (lo + hi) / 2, b = layout.ry * (lo + hi) / 2;
                  const round = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))); // the orbit's length
                  return (
                    <g key={r}>
                      <ellipse cx={layout.cx} cy={layout.cy} rx={a} ry={b} fill="none" stroke={`url(#${uid}-ring)`} strokeWidth={1} opacity={[0.9, 0.6, 0.4][r]} />
                      <ellipse cx={layout.cx} cy={layout.cy} rx={a} ry={b} fill="none" className={`swarm-comet is-${r}`} style={{ strokeDasharray: `${(round * 0.045).toFixed(1)} ${(round * 0.955).toFixed(1)}`, "--round": `${round.toFixed(1)}px` } as CSSProperties} />
                    </g>
                  );
                })}
                {focused ? (
                  <>
                    <line x1={layout.cx} y1={layout.cy} x2={focused.x} y2={focused.y} stroke={`url(#${uid}-beam)`} strokeWidth={1.6} strokeLinecap="round" />
                    <circle r={2.6} fill="#ffffff" className="swarm-spark"><animateMotion dur="1.6s" repeatCount="indefinite" path={`M${layout.cx.toFixed(1)},${layout.cy.toFixed(1)} L${focused.x.toFixed(1)},${focused.y.toFixed(1)}`} /></circle>
                    {[...(neighbours.get(focused.id) ?? [])].map((id) => { const q = byId.get(id); return q ? <line key={id} x1={focused.x} y1={focused.y} x2={q.x} y2={q.y} className="orbit-flow" stroke="var(--color-coral)" strokeWidth={1.4} strokeLinecap="round" /> : null; })}
                  </>
                ) : null}
              </svg>

              {/* Whoever is looking, at the centre. */}
              <div className="pointer-events-none absolute z-[6] -translate-x-1/2 -translate-y-1/2" style={{ left: layout.cx, top: layout.cy, width: layout.hub, height: layout.hub }}>
                <span className="organism-halo absolute -inset-[70%] rounded-full" />
                <span className="swarm-pulse absolute inset-0 rounded-full" />
                <span className="swarm-pulse is-late absolute inset-0 rounded-full" />
                <span className="swarm-core-ring absolute -inset-[14%] rounded-full" />
                <span className="organism-nucleus absolute inset-0 grid place-items-center overflow-hidden rounded-full">
                  {centre.photo ? <Face p={centre} size={layout.hub} /> : <span className="label-caps" style={layout.hub < 48 ? { fontSize: 9.5 } : undefined}>You</span>}
                </span>
              </div>

              {layout.placed.map((p, i) => {
                const active = focus === p.id, picked = selected === p.id;
                const dim = (!inGroup(p) && selected !== p.id) || !lit(p.id);
                const named = picked || active || showNames;
                return (
                  <button key={p.id} type="button" aria-pressed={picked} aria-label={`${p.name}, ${RING_WORDS[p.ring]}${p.note ? `. ${p.note}` : ""}`}
                    onClick={(e) => { e.stopPropagation(); setSelected(picked ? null : p.id); }}
                    onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)}
                    className={cn("absolute left-0 top-0 cursor-pointer transition-[opacity,transform] duration-300", dim ? "opacity-15" : "opacity-100")}
                    style={{ width: p.size, height: p.size, transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%) scale(${picked ? 1.8 : active ? 1.25 : 1})`, zIndex: picked ? 60 : active ? 50 : 10 + Math.round(p.depth * 30) }}>
                    <span className="swarm-in block h-full w-full" style={{ animationDelay: `${Math.min(i * 9, 700)}ms` }}>
                      <span className="swarm-drift block h-full w-full" style={{ animationDelay: `${(-hash(`${p.id}d`) * 7).toFixed(2)}s`, animationDuration: `${(6 + (i % 5) * 0.6).toFixed(1)}s` }}>
                        <span className={cn("swarm-tile block h-full w-full", `is-${p.ring}`, picked && "is-selected")} style={{ "--tint": tintOf(p.name)[0], opacity: picked || active ? 1 : 0.72 + 0.28 * p.depth } as CSSProperties}><Face p={p} size={p.size} /></span>
                      </span>
                    </span>
                    {picked ? <Brackets /> : null}
                    {/* The chosen face is drawn 1.8 times larger, so its name is set small to land at about 12.5px. */}
                    {named ? <span className={cn("pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap leading-none", picked ? "orbit-tag mt-1.5 px-2 py-[3px] text-[7px] font-semibold text-ink" : "mt-1.5 text-[11px] text-ink-muted")}>{picked ? p.name : p.name.split(/\s+/)[0]}</span> : null}
                  </button>
                );
              })}

              {layout.hidden > 0 ? (() => {
                const at = { left: layout.cx + layout.rx * 0.74, top: layout.cy + layout.ry * 0.86 };
                const inner = <><b className="font-display text-[15px] font-light leading-none tabular text-ink">+{compactCount(layout.hidden)}</b><span className="text-[11px] leading-tight text-ink-muted">{group ? "more here" : "more in your network"}</span></>;
                return moreHref
                  ? <Link href={moreHref} className="swarm-more" style={at} onClick={(e) => e.stopPropagation()} aria-label={`${layout.hidden} more people not drawn. See them all`}>{inner}</Link>
                  : <span className="swarm-more" style={at} aria-label={`${layout.hidden} more people not drawn`}>{inner}</span>;
              })() : null}
              {!people.length ? <p className="absolute inset-x-6 bottom-6 text-center text-[13px] text-ink-muted">Nobody here yet. This fills in as people join and connect.</p> : null}
            </>
          ) : null}
        </div>

        {card ? <div onClick={(e) => e.stopPropagation()} className={cn("orbit-card m-3 rounded-[22px] text-ink", !stacked && "lg:absolute lg:right-3 lg:top-3 lg:z-[80] lg:m-0 lg:max-h-[calc(100%-24px)] lg:w-[300px] lg:overflow-y-auto")}>{card}</div> : null}
      </div>
    </div>
  );
}

function PersonCard({ p, knows, onPick, onClose }: { p: OrbitPerson; knows: OrbitPerson[]; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div>
      <div className="flex items-start gap-3 p-4">
        <span className="swarm-tile is-0 block h-12 w-12 flex-none" style={{ "--tint": tintOf(p.name)[0] } as CSSProperties}><Face p={p} size={48} /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold tracking-[-0.01em]">{p.name}</div>
          <div className="line-clamp-2 text-[12px] leading-[1.4] text-ink-muted">{p.headline || "No headline yet"}</div>
        </div>
        <button type="button" onClick={onClose} className="-mr-1 -mt-1 grid h-9 w-9 flex-none cursor-pointer place-items-center rounded-md text-ink-faint hover:bg-surface-muted hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      {p.note ? <div className="border-t border-line px-4 py-3 text-[12.5px] text-ink">{p.note}</div> : null}
      {p.chips?.length ? <div className="flex flex-wrap gap-1 border-t border-line px-4 py-3">{p.chips.map((c) => <span key={c} className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-muted">{c}</span>)}</div> : null}
      {knows.length ? (
        <div className="border-t border-line px-4 py-3">
          <div className="mb-1.5 text-[11.5px] text-ink-muted">Knows {knows.length} {knows.length === 1 ? "person" : "people"} here</div>
          <ul className="flex flex-wrap gap-1.5">
            {knows.slice(0, 12).map((k) => (
              <li key={k.id}><button type="button" onClick={() => onPick(k.id)} className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface-muted py-0.5 pl-0.5 pr-2.5 text-[12px] text-ink hover:border-line-strong"><span className="block h-6 w-6 overflow-hidden rounded-full"><Face p={k} size={24} /></span>{k.name}</button></li>
            ))}
          </ul>
        </div>
      ) : null}
      {p.href ? <div className="border-t border-line p-4"><Link href={p.href} className="flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-navy text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-navy-600 dark:text-canvas">{p.hrefLabel ?? "Open profile"} <ArrowUpRight className="h-3.5 w-3.5" /></Link></div> : null}
    </div>
  );
}
