"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
};
export type OrbitGroup = { key: string; label: string; hint?: string };
/** Who knows whom. Drawn only for the person in focus, and listed on their card. */
export type OrbitLink = { source: string; target: string };

// A stable number in [0, 1) from a string, so the same person always lands in the same place.
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const initials = (name: string) => name.split(/\s+/).map((s) => s[0] ?? "").join("").slice(0, 2).toUpperCase();
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Initials sit on the brand's own lights, dark on light, so they read at any size.
const TINTS: [string, string, string][] = [
  ["#9af2cf", "#27a57d", "#04392a"], ["#ffc4b8", "#e2705c", "#4a130a"], ["#bcd3f4", "#5f86c9", "#0c2247"],
  ["#ecd8b0", "#b9933f", "#3d2a05"], ["#c9c6ff", "#6f6bd8", "#15124a"],
];
const tintOf = (name: string) => TINTS[Math.floor(hash(name) * TINTS.length)];

// Each circle is a band round the centre, as a share of the stage's half-width and half-height.
const BANDS: [number, number][] = [[0.34, 0.52], [0.58, 0.78], [0.84, 1]];
const RING_WORDS = ["closest to you", "in your middle circle", "on the edge"];

type Placed = OrbitPerson & { x: number; y: number; size: number };

function Face({ p, size }: { p: { name: string; photo?: string | null }; size: number }) {
  if (p.photo) {
    // eslint-disable-next-line @next/next/no-img-element -- a small user photo from our own store or inline; no optimiser needed
    return <img src={p.photo} alt="" className="h-full w-full object-cover" draggable={false} />;
  }
  const [a, b, ink] = tintOf(p.name);
  return <span className="grid h-full w-full place-items-center font-semibold leading-none" style={{ background: `linear-gradient(150deg, ${a}, ${b})`, color: ink, fontSize: Math.max(8, Math.round(size * 0.36)) }}>{size >= 20 ? initials(p.name) : ""}</span>;
}

/**
 * The network as a swarm of faces round a glowing centre. Whoever is looking sits in the middle;
 * the people they know best sit closest, and everyone else further out. The counters filter the
 * swarm, and choosing a face pulls it forward, names it, and lights up the people it knows.
 * Used for the team's view of the whole network and for a member's own circle.
 */
export function TrustOrbit({ centre, people, groups, links = [], caption, label, heightClass = "h-[calc(100vh-270px)] min-h-[520px]", compact = false }: {
  centre: { name: string; photo?: string | null };
  people: OrbitPerson[]; groups: OrbitGroup[]; links?: OrbitLink[];
  /** One plain line across the top of the stage. */
  caption?: string;
  /** What a screen reader hears for the whole picture. */
  label: string;
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
    // A handful of people share one turn of the circle, so they spread out instead of bunching by ring.
    const few = people.length <= 12;
    let k = 0;
    for (const ring of [0, 1, 2] as const) {
      const inRing = people.filter((p) => p.ring === ring).sort((a, b) => hash(a.id) - hash(b.id));
      const n = inRing.length;
      if (!n) continue;
      const [lo, hi] = BANDS[ring];
      const room = Math.sqrt((Math.PI * rx * ry * (hi * hi - lo * lo)) / n) * 0.95;
      const size = Math.round(clamp(room, 14, base[ring]));
      const step = (Math.PI * 2) / n, start = hash(`ring${ring}`) * Math.PI * 2;
      inRing.forEach((p, i) => {
        // Evenly round the circle, then nudged along it and across the band, so it reads as a swarm, not a clock face.
        const th = few ? -Math.PI / 2 + (k++ * Math.PI * 2) / people.length : start + i * step + (hash(`${p.id}a`) - 0.5) * step * 0.7;
        // Never closer than a clear gap from the centre, however small the stage.
        const f = Math.max(n <= 3 ? (lo + hi) / 2 : lo + hash(`${p.id}r`) * (hi - lo), (hub / 2 + size / 2 + (few ? 26 : 10)) / Math.min(rx, ry));
        placed.push({ ...p, x: cx + rx * f * Math.cos(th), y: cy + ry * f * Math.sin(th), size });
      });
    }
    return { cx, cy, hub, placed, narrow };
  }, [box, people, compact, caption]);

  const byId = useMemo(() => new Map((layout?.placed ?? []).map((p) => [p.id, p])), [layout]);
  const focus = hover ?? selected;
  const focused = focus ? byId.get(focus) ?? null : null;
  const chosen = selected ? people.find((p) => p.id === selected) ?? null : null;
  const inGroup = (p: OrbitPerson) => !group || p.groups.includes(group);
  const lit = (id: string) => !focus || id === focus || !!neighbours.get(focus)?.has(id);
  const showNames = people.length <= 12;
  const stacked = compact; // the counters sit above the stage and the card below it

  const card = chosen ? (
    <PersonCard p={chosen} knows={[...(neighbours.get(chosen.id) ?? [])].map((id) => people.find((x) => x.id === id)).filter((x): x is OrbitPerson => !!x)} onPick={setSelected} onClose={() => setSelected(null)} />
  ) : null;

  return (
    <div className={cn("ink-stage flex w-full flex-col overflow-hidden rounded-[20px]", !stacked && "lg:flex-row")} data-trust-orbit onKeyDown={(e) => { if (e.key === "Escape") setSelected(null); }}>
      <div className={cn("flex flex-wrap gap-1.5 p-3", !stacked && "lg:w-[216px] lg:flex-none lg:flex-col lg:flex-nowrap lg:gap-2 lg:p-4")} role="group" aria-label="Show">
        {[{ key: "", label: "Everyone", hint: undefined as string | undefined }, ...groups].map((g) => {
          const on = (group ?? "") === g.key, n = g.key ? counts.get(g.key) ?? 0 : people.length;
          return (
            <button key={g.key || "all"} type="button" aria-pressed={on} disabled={!n && !on} onClick={() => { setGroup(g.key || null); setSelected(null); }}
              className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[14px] border px-3 py-2 text-left transition-colors duration-200 disabled:cursor-default disabled:opacity-45", on ? "border-teal bg-teal-50" : "border-line bg-surface-muted hover:border-line-strong", !stacked && "lg:min-h-[60px] lg:gap-3")}>
              <span className={cn("font-display text-[18px] leading-none tabular", on ? "text-teal" : "text-ink", !stacked && "lg:min-w-[40px] lg:text-[24px]")}>{n}</span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold leading-tight text-ink">{g.label}</span>
                {g.hint ? <span className={cn("hidden text-[11.5px] leading-snug text-ink-muted", !stacked && "lg:block")}>{g.hint}</span> : null}
              </span>
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
                {focused ? (
                  <>
                    <line x1={layout.cx} y1={layout.cy} x2={focused.x} y2={focused.y} stroke="#7ee3bc" strokeWidth={1.4} strokeOpacity={0.8} strokeLinecap="round" />
                    {[...(neighbours.get(focused.id) ?? [])].map((id) => { const q = byId.get(id); return q ? <line key={id} x1={focused.x} y1={focused.y} x2={q.x} y2={q.y} className="orbit-flow" stroke="var(--color-coral)" strokeWidth={1.4} strokeLinecap="round" /> : null; })}
                  </>
                ) : null}
              </svg>

              {/* Whoever is looking, at the centre. */}
              <div className="pointer-events-none absolute z-[6] -translate-x-1/2 -translate-y-1/2" style={{ left: layout.cx, top: layout.cy, width: layout.hub, height: layout.hub }}>
                <span className="organism-halo absolute -inset-[70%] rounded-full" />
                <span className="organism-nucleus absolute inset-0 grid place-items-center overflow-hidden rounded-full">
                  {centre.photo ? <Face p={centre} size={layout.hub} /> : <span className="label-caps" style={layout.hub < 48 ? { fontSize: 9.5 } : undefined}>You</span>}
                </span>
              </div>

              {layout.placed.map((p, i) => {
                const active = focus === p.id, picked = selected === p.id;
                const dim = !inGroup(p) || !lit(p.id);
                const named = picked || active || showNames;
                return (
                  <button key={p.id} type="button" aria-pressed={picked} aria-label={`${p.name}, ${RING_WORDS[p.ring]}${p.note ? `. ${p.note}` : ""}`}
                    onClick={(e) => { e.stopPropagation(); setSelected(picked ? null : p.id); }}
                    onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)}
                    className={cn("absolute left-0 top-0 cursor-pointer transition-[opacity,transform] duration-300", dim ? "opacity-15" : "opacity-100")}
                    style={{ width: p.size, height: p.size, transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%) scale(${picked ? 1.8 : active ? 1.25 : 1})`, zIndex: picked ? 60 : active ? 50 : 10 + (2 - p.ring) * 10 }}>
                    <span className="swarm-drift block h-full w-full" style={{ animationDelay: `${(-hash(`${p.id}d`) * 7).toFixed(2)}s`, animationDuration: `${(6 + (i % 5) * 0.6).toFixed(1)}s` }}>
                      <span className={cn("swarm-tile block h-full w-full", `is-${p.ring}`, picked && "is-selected")}><Face p={p} size={p.size} /></span>
                    </span>
                    {/* The chosen face is drawn 1.8 times larger, so its name is set small to land at about 12.5px. */}
                    {named ? <span className={cn("pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap leading-none", picked ? "orbit-tag mt-1.5 px-2 py-[3px] text-[7px] font-semibold text-ink" : "mt-1.5 text-[11px] text-ink-muted")}>{picked ? p.name : p.name.split(/\s+/)[0]}</span> : null}
                  </button>
                );
              })}

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
        <span className="swarm-tile is-0 block h-12 w-12 flex-none"><Face p={p} size={48} /></span>
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
