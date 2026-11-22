"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CIRCLES, circleOf } from "@/lib/circles";

/** An open requirement this person genuinely fits (from the matching engine, never a guess). */
export type GRole = { id: string; title: string; route: string | null; location: string | null; tier: "meets" | "conversation"; fit: number };
export type GNode = {
  id: string; name: string; headline: string; trust: number; worked: boolean; hub?: boolean;
  band?: string; vouchedBy?: number; capabilities?: string[]; city?: string | null;
  availability?: string; availabilityTone?: "teal" | "amber" | "neutral"; open?: boolean;
  member?: boolean; screened?: boolean; roles?: GRole[];
  /** Their photo, sent only for the orbit view and only where they agreed to show it. */
  photo?: string | null;
  /** Days since they were added. Under 30 counts as new growth. */
  addedDays?: number;
};
export type GLink = { source: string; target: string; worked: boolean };

/** Added within this many days counts as growth. */
const FRESH_DAYS = 30;
const isFresh = (n: GNode) => n.addedDays != null && n.addedDays < FRESH_DAYS;
const TRUSTED = 60; // the "trusted" band and above — see lib/trust.ts
const initials = (name: string) => name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
const shortName = (name: string) => { const [first, ...rest] = name.split(/\s+/); return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first; };
const TONE: Record<string, string> = { teal: "text-teal border-teal/30 bg-teal-50", amber: "text-amber border-amber/30 bg-amber-50", neutral: "text-ink-muted border-line bg-surface-muted" };

const RINGS = CIRCLES;

/**
 * The map's heartbeat, in seconds. A wave leaves "You" on every beat and takes three beats to cross
 * the orbits, so three are always in flight. Each person glows as the wave reaches their circle.
 */
const BEAT = 7; // one slow breath, in seconds
const ringOf = circleOf;

/**
 * The organism: each circle is a living membrane. Its edge ripples (two slow waves travelling round
 * it in opposite directions) and the whole membrane breathes in and out once every BEAT seconds,
 * each circle a little after the one inside it. People ride their membrane, so they breathe with it.
 */
const wob = (ring: number, th: number, t: number) =>
  1 + 0.032 * Math.sin(3 * th + t * 0.32 + ring * 1.7) + 0.02 * Math.sin(5 * th - t * 0.24 + ring * 0.6) + 0.028 * Math.sin((t / BEAT) * Math.PI * 2 - ring * 0.9);

type Placed = GNode & { ring: number; angle: number; size: number; a: number; b: number };
// `base0` is the slot each person occupies (and the area you can click). Inside it, people in the
// two inner circles are drawn as faces with initials; the outer circle, not yet known, as dots.
const base0 = (ring: number, compact: boolean, narrow = false) => (narrow ? [30, 26, 22] : compact ? [40, 32, 24] : [46, 36, 26])[ring];
const dotOf = (ring: number, trust: number, narrow = false) => Math.round((narrow ? [27, 21, 11] : [40, 31, 14])[ring] + Math.min(100, trust) * (ring === 2 ? 0.04 : 0.08));


// Each circle sways gently, in its own time and direction, so the map breathes instead of sitting still.
const SWAY = [{ amp: 0.085, period: 17 }, { amp: -0.06, period: 23 }, { amp: 0.045, period: 31 }];
const swayOf = (ring: number, t: number) => SWAY[ring].amp * Math.sin((t / SWAY[ring].period) * Math.PI * 2);

/**
 * The network as a living organism — no chart dependency. You are at the centre; the
 * people you have worked with circle closest, people the network knows in the middle, new
 * introductions on the edge. The orbits are tilted, so people at the front read larger than people
 * at the back, and each circle drifts slowly. A mint arc shows trust; a mint dot means open to work.
 * Hover to trace who introduced whom; filter by capability; click a person for the roles they fit.
 */
export function NetworkGraph({ nodes, links, heightClass = "h-[calc(100vh-270px)] min-h-[560px]", openRoles, total, compact = false }: { nodes: GNode[]; links: GLink[]; heightClass?: string; openRoles?: number; total?: number; compact?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [cap, setCap] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const clock = useRef(0);                                   // seconds of drift so far; frozen while you inspect someone
  const nodeEls = useRef(new Map<string, HTMLButtonElement>());
  const linkEls = useRef(new Map<number, SVGPathElement>());

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hub = useMemo(() => nodes.find((n) => n.hub) ?? null, [nodes]);
  const people = useMemo(() => nodes.filter((n) => !n.hub), [nodes]);
  const stats = useMemo(() => ({ total: Math.max(total ?? 0, people.length), trusted: people.filter((n) => n.trust >= TRUSTED).length, open: people.filter((n) => n.open).length, fresh: people.filter(isFresh).length }), [people, total]);
  // People added in each of the last six months, oldest first: where the network has been growing.
  const growth = useMemo(() => {
    const now = new Date(), months = Array.from({ length: 6 }, (_, i) => ({ label: new Date(now.getFullYear(), now.getMonth() - (5 - i), 1).toLocaleDateString("en-GB", { month: "short" }), n: 0 }));
    for (const p of people) { if (p.addedDays == null) continue; const d = new Date(now.getTime() - p.addedDays * 86_400_000), back = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth(); if (back >= 0 && back < 6) months[5 - back].n++; }
    return months;
  }, [people]);
  const topCaps = useMemo(() => {
    const seen = new Map<string, { label: string; n: number }>();
    for (const p of people) for (const c of p.capabilities ?? []) { const k = c.trim().toLowerCase(); if (!k) continue; const e = seen.get(k); if (e) e.n += 1; else seen.set(k, { label: c.trim(), n: 1 }); }
    return [...seen.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, compact ? 3 : 4).map(([key, v]) => ({ key, label: v.label }));
  }, [people, compact]);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const l of links) { d.set(l.source, (d.get(l.source) ?? 0) + 1); d.set(l.target, (d.get(l.target) ?? 0) + 1); }
    return d;
  }, [links]);
  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => { if (!m.has(a)) m.set(a, new Set()); m.get(a)!.add(b); };
    for (const l of links) { add(l.source, l.target); add(l.target, l.source); }
    return m;
  }, [links]);
  const selectedNode = useMemo(() => (selected ? nodes.find((n) => n.id === selected) ?? null : null), [nodes, selected]);

  // Geometry: three tilted orbits that fill the frame, so a wide card gets wide orbits.
  const layout = useMemo(() => {
    if (!box || box.w < 120 || box.h < 120) return null;
    const narrow = box.w < 560; // a phone: smaller people, no name captions, orbits never taller than wide
    const padX = narrow ? 26 : compact ? 50 : 70, padTop = compact ? 34 : 96, padBottom = compact ? 84 : 112;
    const cx = box.w / 2, cy = padTop + (box.h - padTop - padBottom) / 2;
    const rx0 = Math.max(60, box.w / 2 - padX);
    const ry = Math.max(60, Math.min((box.h - padTop - padBottom) / 2, rx0 * 1.05));
    const rx = Math.min(rx0, ry * 2.15);
    const scale = [0.4, 0.71, 1];
    const groups: GNode[][] = [[], [], []];
    for (const p of people) groups[ringOf(p)].push(p);
    const placed: Placed[] = [];
    const labelled: boolean[] = [false, false, false];
    const where = new Map<string, number>();
    const introducer = new Map<string, string>();
    for (const l of links) if (hub && l.source !== hub.id) introducer.set(l.target, l.source);
    groups.forEach((group, ring) => {
      const n = group.length;
      if (!n) return;
      const a = rx * scale[ring], b = ry * scale[ring];
      // People introduced by someone sit near that person's angle; everyone else is ordered by trust.
      const ordered = [...group].sort((p, q) => {
        const ap = where.get(introducer.get(p.id) ?? ""), aq = where.get(introducer.get(q.id) ?? "");
        if (ap != null && aq != null && ap !== aq) return ap - aq;
        if (ap != null && aq == null) return -1;
        if (aq != null && ap == null) return 1;
        return q.trust - p.trust;
      });
      // Each orbit keeps a gap at the top for its name tag, wide enough that the drift never crosses it.
      const need = RINGS[ring].label.length * 8.2 + 60 + base0(ring, compact, narrow);
      const gap = need / a <= 1.7 ? need / a + 0.2 : 0;
      labelled[ring] = gap > 0;
      const span = Math.PI * 2 - gap;
      const step = gap && n > 1 ? span / (n - 1) : span / n;
      const circumference = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
      const base = base0(ring, compact, narrow);
      const size = Math.round(Math.max(14, Math.min(base, (circumference / n) * 0.6)));
      ordered.forEach((p, i) => {
        const angle = gap ? (n > 1 ? -Math.PI / 2 + gap / 2 + i * step : Math.PI / 2) : -Math.PI / 2 + step / 2 + i * step;
        where.set(p.id, angle);
        placed.push({ ...p, ring, angle, size, a, b });
      });
    });
    return { cx, cy, rx, ry, scale, placed, labelled, narrow, hub: Math.round(Math.max(34, Math.min(compact ? 62 : 76, rx * scale[0] * 0.66))), counts: groups.map((g) => g.length) };
  }, [box, people, links, hub, compact]);

  const byId = useMemo(() => new Map((layout?.placed ?? []).map((p) => [p.id, p])), [layout]);
  // Where someone is at time t. Depth runs 0 (back of the orbit) to 1 (front): front reads larger and sits on top.
  const at = (p: Placed, t: number) => {
    const th = p.angle + swayOf(p.ring, t);
    const depth = (Math.sin(th) + 1) / 2;
    const w = wob(p.ring, th, t);
    return { x: layout!.cx + p.a * w * Math.cos(th), y: layout!.cy + p.b * w * Math.sin(th), depth, k: 0.88 + 0.2 * depth };
  };
  // A membrane's outline at time t: a closed, smooth curve through points on the rippling edge.
  const membrane = (ring: number, t: number) => {
    if (!layout) return "";
    const a = layout.rx * layout.scale[ring], b = layout.ry * layout.scale[ring], N = 44;
    const pts = Array.from({ length: N }, (_, i) => { const th = (i / N) * Math.PI * 2; const w = wob(ring, th, t); return [layout.cx + a * w * Math.cos(th), layout.cy + b * w * Math.sin(th)]; });
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d + "Z";
  };
  const membraneEls = useRef(new Map<number, SVGPathElement>());
  const pathFor = (l: GLink, t: number) => {
    const b = byId.get(l.target);
    if (!b || !layout) return "";
    const pb = at(b, t);
    const src = l.source === hub?.id ? null : byId.get(l.source);
    const pa = src ? at(src, t) : { x: layout.cx, y: layout.cy };
    if (!src && l.source !== hub?.id) return "";
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    return `M${pa.x.toFixed(1)},${pa.y.toFixed(1)} Q${(mx + (layout.cx - mx) * 0.3).toFixed(1)},${(my + (layout.cy - my) * 0.3).toFixed(1)} ${pb.x.toFixed(1)},${pb.y.toFixed(1)}`;
  };
  const nodeStyle = (p: Placed, t: number) => { const q = at(p, t); return { transform: `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px) translate(-50%, -50%) scale(${q.k.toFixed(3)})`, zIndex: 10 + Math.round(q.depth * 20) }; };

  const focus = hover ?? selected;
  const paused = !!focus;
  // The drift: move the elements directly each frame, so React only re-renders when you interact.
  useEffect(() => {
    if (!layout || paused) return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      clock.current += Math.min(0.05, (now - last) / 1000); last = now;
      const t = clock.current;
      for (const p of layout.placed) { const el = nodeEls.current.get(p.id); if (el) { const st = nodeStyle(p, t); el.style.transform = st.transform; el.style.zIndex = String(st.zIndex); } }
      links.forEach((l, i) => { const el = linkEls.current.get(i); if (el) el.setAttribute("d", pathFor(l, t)); });
      for (const [r, el] of membraneEls.current) el.setAttribute("d", membrane(r, t));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, paused, links]);

  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // A handful of introductions carry a moving signal, so the threads between people read as live.
  const signals = useMemo(() => { const step = Math.max(1, Math.ceil(links.length / 16)); return links.map((_, i) => i).filter((i) => i % step === 0); }, [links]);
  // Names sit beside the people you know best; everyone else shows theirs on hover.
  const showNames = !layout?.narrow;
  const matches = (n: GNode) => (!cap || (n.capabilities ?? []).some((c) => c.trim().toLowerCase() === cap)) && (!fresh || isFresh(n));
  const lit = (id: string) => !focus || id === focus || neighbours.get(focus)?.has(id);

  const card = selectedNode ? <PersonCard n={selectedNode} connections={degree.get(selectedNode.id) ?? 0} onClose={() => setSelected(null)} /> : null;
  const hovered = hover ? byId.get(hover) : null;
  const hoveredAt = hovered && layout ? at(hovered, clock.current) : null;
  const t0 = clock.current;

  return (
    <div className={cn("ink-stage relative w-full flex overflow-hidden rounded-[20px]", heightClass)}>
      <div ref={wrapRef} className="orbit-stage relative flex-1 min-w-0 text-ink" onClick={() => setSelected(null)}>
        {layout ? (
          <>
            <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
              <defs>
                <radialGradient id={`${uid}-m0`} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#7ee3bc" stopOpacity="0.2" /><stop offset="70%" stopColor="#7ee3bc" stopOpacity="0.07" /><stop offset="100%" stopColor="#7ee3bc" stopOpacity="0.02" /></radialGradient>
                <radialGradient id={`${uid}-m1`} cx="50%" cy="50%" r="50%"><stop offset="55%" stopColor="#a9c2ff" stopOpacity="0" /><stop offset="100%" stopColor="#a9c2ff" stopOpacity="0.07" /></radialGradient>
                <radialGradient id={`${uid}-m2`} cx="50%" cy="50%" r="50%"><stop offset="70%" stopColor="#8f8cff" stopOpacity="0" /><stop offset="100%" stopColor="#8f8cff" stopOpacity="0.06" /></radialGradient>
              </defs>
              {/* The membranes, outermost first: soft living edges that ripple and breathe. */}
              {[2, 1, 0].map((r) => (
                <path key={r} ref={(el) => { if (el) membraneEls.current.set(r, el); else membraneEls.current.delete(r); }} d={membrane(r, t0)} fill={`url(#${uid}-m${r})`} className={`organism-membrane is-${r}`} />
              ))}
              {/* Who introduced whom: a faint thread by default, a moving mint line for the person in focus. */}
              {links.map((l, i) => {
                const fromHub = l.source === hub?.id;
                const on = !!focus && (l.source === focus || l.target === focus);
                return <path key={i} id={`${uid}-l${i}`} ref={(el) => { if (el) linkEls.current.set(i, el); else linkEls.current.delete(i); }} d={pathFor(l, t0)} fill="none" className={on ? "orbit-flow" : undefined} stroke={on ? "var(--color-coral)" : "#9fe9cd"} strokeWidth={on ? 1.6 : 1.1} strokeOpacity={on ? 1 : fromHub ? 0 : focus ? 0.05 : 0.2} strokeLinecap="round" />;
              })}
              {/* Signals running along the threads, from whoever made the introduction to the person. */}
              <g className="orbit-signals" opacity={focus ? 0.12 : 1}>
                {signals.map((i, k) => { const begin = `${((k * 1.3) % (BEAT * 1.4)).toFixed(2)}s`; const dur = `${(BEAT * 1.4).toFixed(1)}s`; return (
                  <circle key={i} r={2.4} opacity={0} className="organism-signal" fill={links[i].source === hub?.id ? "var(--color-teal-400)" : "#ffb3a6"}>
                    <animateMotion dur={dur} begin={begin} repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keyPoints="0;1;1" keySplines="0.4 0 0.2 1;0 0 1 1"><mpath href={`#${uid}-l${i}`} /></animateMotion>
                    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.08;0.42;0.5;1" dur={dur} begin={begin} repeatCount="indefinite" />
                  </circle>
                ); })}
              </g>
            </svg>

            {/* Each orbit carries its name as a tag at the top, in the gap its people leave. */}
            {RINGS.map((r, i) => layout.labelled[i] ? (
              <div key={r.label} className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2 orbit-tag inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-[3px]" style={{ left: layout.cx, top: layout.cy - layout.ry * layout.scale[i] }}>
                <span className="label-caps text-ink-muted">{r.label}</span>
                <span className="text-[10.5px] font-semibold leading-none text-ink">{layout.counts[i]}</span>
              </div>
            ) : null)}

            {/* You, at the centre: a soft halo and a two-part beat that sets the rhythm for everything else. */}
            <div className="pointer-events-none absolute z-[6] -translate-x-1/2 -translate-y-1/2" style={{ left: layout.cx, top: layout.cy, width: layout.hub, height: layout.hub }}>
              <span className="organism-halo absolute -inset-[70%] rounded-full" />
              <span className="organism-nucleus absolute inset-0 grid place-items-center rounded-full"><span className="label-caps !tracking-[0.1em]" style={layout.hub < 44 ? { fontSize: 8.5 } : undefined}>You</span></span>
            </div>

            {layout.placed.map((p, i) => {
              const dim = !matches(p) || !lit(p.id);
              const trusted = p.trust >= TRUSTED;
              const active = hover === p.id || selected === p.id;
              const dot = dotOf(p.ring, p.trust, layout.narrow);
              const st = nodeStyle(p, t0);
              const named = showNames && (p.ring === 0 || active);
              return (
                <button
                  key={p.id} type="button" aria-label={`${p.name}, trust ${Math.round(p.trust)}${isFresh(p) ? ", added this month" : ""}`} aria-pressed={selected === p.id}
                  ref={(el) => { if (el) nodeEls.current.set(p.id, el); else nodeEls.current.delete(p.id); }}
                  onClick={(e) => { e.stopPropagation(); setSelected(selected === p.id ? null : p.id); }}
                  onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)}
                  className={cn("group absolute left-0 top-0 grid cursor-pointer place-items-center rounded-full transition-opacity duration-300", dim ? "opacity-20" : "opacity-100")}
                  style={{ width: p.size, height: p.size, transform: st.transform, zIndex: active ? 60 : st.zIndex }}
                >
                  <span className="node-in relative block" style={{ width: dot, height: dot, animationDelay: `${Math.min(i * 14, 600)}ms` }}>
                    {/* Lights up as the wave from the centre reaches this person's circle. */}
                    {isFresh(p) ? <span className="orbit-bud" aria-hidden="true" /> : null}
                    {/* Each cell breathes in its own rhythm, a little out of step with its neighbours. */}
                    <span className="cell-breathe absolute inset-0" style={{ animationDelay: `${(-((i * 0.83) % BEAT)).toFixed(2)}s`, animationDuration: `${(BEAT - 1 + (i % 5) * 0.5).toFixed(1)}s` }} aria-hidden={dot < 22 ? true : undefined}>
                      <span className={cn("cell absolute inset-0 grid place-items-center rounded-full font-semibold leading-none transition-transform duration-200 group-hover:scale-[1.18]", trusted || p.ring === 0 ? "is-mint" : p.ring === 1 ? "is-white" : "is-faint", active && "scale-[1.18]", selected === p.id && "is-selected")} style={{ fontSize: Math.max(8.5, Math.round(dot * 0.36)) }}>{dot >= 22 ? initials(p.name) : ""}</span>
                    </span>
                    {p.open ? <span className="orbit-ping orbit-open absolute -right-[2px] -bottom-[2px] h-[11px] w-[11px] rounded-full" style={{ animationDelay: `${((i * 0.9) % BEAT).toFixed(2)}s` }} aria-hidden="true" /> : null}
                    {named ? <span className={cn("pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[11px] leading-none tracking-[0.01em] transition-colors duration-200", active ? "text-ink font-semibold" : "text-ink-muted")}>{shortName(p.name)}</span> : null}
                  </span>
                </button>
              );
            })}

            {hovered && hoveredAt ? (
              <div className="pointer-events-none absolute z-[70] -translate-x-1/2 -translate-y-full rounded-[14px] bg-surface text-ink px-3 py-2 shadow-[var(--shadow-pop)]" style={{ left: Math.min(Math.max(hoveredAt.x, 130), (box?.w ?? 0) - 130), top: hoveredAt.y - (hovered.size * hoveredAt.k) / 2 - 10 }}>
                <div className="text-[12.5px] font-semibold whitespace-nowrap">{hovered.name}</div>
                {hovered.headline ? <div className="text-[11.5px] text-ink-muted max-w-[230px] truncate">{hovered.headline}</div> : null}
                <div className="text-[11px] text-ink-faint mt-1">Trust {Math.round(hovered.trust)} · {RINGS[hovered.ring].label.toLowerCase()}{hovered.roles?.length ? ` · fits ${hovered.roles.length} open role${hovered.roles.length === 1 ? "" : "s"}` : ""}{isFresh(hovered) ? ` · added ${hovered.addedDays === 0 ? "today" : `${hovered.addedDays} day${hovered.addedDays === 1 ? "" : "s"} ago`}` : ""}</div>
              </div>
            ) : null}
          </>
        ) : null}

        <dl className={cn("pointer-events-none absolute left-6 top-5 flex flex-wrap items-end gap-x-7 gap-y-3", compact && "max-sm:hidden")}>
          {[[stats.total, "in the network"], [`+${stats.fresh}`, "added in 30 days"], ...(compact ? [] : [[stats.open, "open to work"], ...(openRoles != null ? [[openRoles, "open roles"]] : [])])].map(([v, l], k) => (
            <div key={String(l)}>
              <dd className="flex items-end gap-2.5 font-display num-grad text-[26px] leading-none">{v}
                {k === 1 ? (
                  // Where it has been growing: people added in each of the last six months.
                  <span className="mb-[2px] flex h-[20px] items-end gap-[3px]" role="img" aria-label={`People added in each of the last six months, oldest first: ${growth.map((m) => `${m.label} ${m.n}`).join(", ")}`}>
                    {growth.map((m, i) => { const top = Math.max(1, ...growth.map((x) => x.n)); return <span key={m.label + i} title={`${m.label}: ${m.n}`} className="w-[5px] rounded-full" style={{ height: m.n ? `${Math.max(22, (m.n / top) * 100)}%` : "3px", background: !m.n ? "rgba(255,255,255,0.16)" : i === 5 ? "#f2c46d" : "#7ee3bc" }} />; })}
                  </span>
                ) : null}
              </dd>
              <dt className="text-[11.5px] text-ink-muted mt-1.5">{l}</dt>
            </div>
          ))}
        </dl>

        {/* The person you clicked opens as a card floating over the map, so the map keeps the whole width. */}
        {card ? <div onClick={(e) => e.stopPropagation()} className="orbit-card absolute right-3 top-3 z-[80] w-[310px] max-w-[calc(100%-24px)] max-h-[calc(100%-24px)] overflow-y-auto rounded-[22px] text-ink">{card}</div> : null}

        <div className="pointer-events-none absolute inset-x-5 bottom-4 z-[65] flex items-end justify-between gap-3">
          <div className="pointer-events-auto flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            {topCaps.length ? (
              <>
                <button type="button" onClick={() => { setCap(null); setFresh(false); }} aria-pressed={cap === null && !fresh} className={cn("rounded-full border px-3 py-1 text-[12px] cursor-pointer transition-colors duration-200", cap === null && !fresh ? "bg-navy border-navy text-white font-semibold dark:text-canvas" : "border-transparent bg-white/[0.06] text-ink-muted hover:bg-white/[0.12] hover:text-ink")}>Everyone</button>
                {stats.fresh ? <button type="button" onClick={() => setFresh(!fresh)} aria-pressed={fresh} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] cursor-pointer transition-colors duration-200", fresh ? "border-amber bg-amber text-[#2b1d00] font-semibold" : "border-transparent bg-white/[0.06] text-ink-muted hover:bg-white/[0.12] hover:text-ink")}><span className="orbit-bud-key" aria-hidden="true" /> New this month</button> : null}
                {topCaps.map((c) => (
                  <button key={c.key} type="button" onClick={() => setCap(cap === c.key ? null : c.key)} aria-pressed={cap === c.key} className={cn("rounded-full border px-3 py-1 text-[12px] cursor-pointer transition-colors duration-200", cap === c.key ? "bg-navy border-navy text-white font-semibold dark:text-canvas" : "border-transparent bg-white/[0.06] text-ink-muted hover:bg-white/[0.12] hover:text-ink")}>{c.label}</button>
                ))}
              </>
            ) : null}
          </div>
          <div className="hidden md:flex flex-none items-center gap-4 text-[11.5px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5"><span className="cell is-mint h-3 w-3 rounded-full" /> worked together</span>
            <span className="inline-flex items-center gap-1.5"><span className="cell is-white h-3 w-3 rounded-full" /> known</span>
            <span className="inline-flex items-center gap-1.5"><span className="cell is-faint h-2.5 w-2.5 rounded-full" /> new</span>
            <span className="inline-flex items-center gap-1.5"><span className="orbit-open h-3 w-3 rounded-full" /> open to work</span>
            <span className="inline-flex items-center gap-1.5"><span className="orbit-bud-key" /> new this month</span>
          </div>
        </div>
      </div>

    </div>
  );
}

export function PersonCard({ n, connections, onClose }: { n: GNode; connections: number; onClose: () => void }) {
  const roles = n.roles ?? [];
  return (
    <div>
      <div className="flex items-start gap-3 p-4">
        <span className="h-11 w-11 flex-none rounded-full bg-surface-muted text-ink text-[13px] font-semibold inline-flex items-center justify-center ring-1 ring-line">{initials(n.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-[-0.01em] truncate">{n.name}</div>
          <div className="text-[12px] text-ink-muted leading-[1.4] line-clamp-2">{n.headline || "No headline yet"}</div>
        </div>
        <button type="button" onClick={onClose} className="flex-none -mr-1 -mt-1 p-1 rounded-md text-ink-faint hover:text-ink hover:bg-surface-muted cursor-pointer" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 border-t border-line">
        <span className="relative h-11 w-11 flex-none rounded-full" style={{ background: `conic-gradient(var(--color-navy) ${Math.round(n.trust)}%, var(--color-line-strong) 0)` }}>
          <span className="absolute inset-[4px] rounded-full bg-surface grid place-items-center text-[12.5px] font-semibold tabular">{Math.round(n.trust)}</span>
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium">{n.band ?? "Trust"}</div>
          <div className="text-[11.5px] text-ink-muted">{n.vouchedBy != null ? `Vouched by ${n.vouchedBy}` : "Trust score"}{n.worked ? " · you've worked together" : ""} · {connections} link{connections === 1 ? "" : "s"} on the map</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 py-3 border-t border-line">
        {n.availability ? <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", TONE[n.availabilityTone ?? "neutral"])}>{n.availability}</span> : null}
        {n.city ? <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", TONE.neutral)}>{n.city}</span> : null}
        {n.screened ? <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", TONE.neutral)}>screened</span> : n.member ? <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", TONE.amber)}>awaiting screening</span> : null}
      </div>

      {n.capabilities?.length ? (
        <div className="px-4 py-3 border-t border-line">
          <div className="text-[11px] text-ink-faint mb-1.5">Strong at</div>
          <div className="flex flex-wrap gap-1">{n.capabilities.map((c) => <span key={c} className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-muted">{c}</span>)}</div>
        </div>
      ) : null}

      <div className="px-4 py-3 border-t border-line">
        <div className="text-[11px] text-ink-faint mb-1">Open roles they fit</div>
        {roles.length ? (
          <ul className="divide-y divide-line">
            {roles.map((r) => (
              <li key={r.id}>
                <Link href={`/requirements/${r.id}`} className="group flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-medium truncate group-hover:text-navy">{r.title}</span>
                    <span className="block text-[11px] text-ink-faint truncate">{[r.route, r.location].filter(Boolean).join(" · ") || "Route to confirm"}</span>
                  </span>
                  <span className={cn("flex-none rounded-full border px-2 py-0.5 text-[10.5px]", r.tier === "meets" ? TONE.teal : TONE.amber)}>{r.tier === "meets" ? "Strong fit" : "Worth a call"} · {Math.round(r.fit)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <div className="text-[12px] text-ink-muted">Nothing live matches them right now.</div>}
      </div>

      <div className="p-4 border-t border-line">
        <Link href={`/network/${n.id}`} className="flex h-9 items-center justify-center gap-1.5 rounded-[12px] bg-navy text-white text-[13px] font-semibold transition-colors duration-200 hover:bg-navy-600 dark:text-canvas">Open profile <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>
    </div>
  );
}
