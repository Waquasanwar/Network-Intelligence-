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
};
export type GLink = { source: string; target: string; worked: boolean };

const TRUSTED = 60; // the "trusted" band and above — see lib/trust.ts
const initials = (name: string) => name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
const shortName = (name: string) => { const [first, ...rest] = name.split(/\s+/); return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first; };
const TONE: Record<string, string> = { teal: "text-teal border-teal/30 bg-teal-50", amber: "text-amber border-amber/30 bg-amber-50", neutral: "text-ink-muted border-line bg-surface-muted" };

const RINGS = CIRCLES;

/**
 * The map's heartbeat, in seconds. A wave leaves "You" on every beat and takes three beats to cross
 * the orbits, so three are always in flight. Each person glows as the wave reaches their circle.
 */
const BEAT = 2.4;
const WAVE = { from: 0.04, to: 1.1, beats: 3 };
/** When, within a beat, the wave reaches an orbit of the given relative size. */
const beatDelay = (scale: number) => (((scale - WAVE.from) / (WAVE.to - WAVE.from)) * WAVE.beats * BEAT) % BEAT;
const ringOf = circleOf;

type Placed = GNode & { ring: number; angle: number; size: number; a: number; b: number };
const base0 = (ring: number, compact: boolean, narrow = false) => (narrow ? [30, 26, 22] : compact ? [38, 34, 30] : [46, 40, 34])[ring];

// Each circle sways gently, in its own time and direction, so the map breathes instead of sitting still.
const SWAY = [{ amp: 0.085, period: 17 }, { amp: -0.06, period: 23 }, { amp: 0.045, period: 31 }];
const swayOf = (ring: number, t: number) => SWAY[ring].amp * Math.sin((t / SWAY[ring].period) * Math.PI * 2);

/**
 * The network as orbits of trust on a navy stage — no chart dependency. You are at the centre; the
 * people you have worked with circle closest, people the network knows in the middle, new
 * introductions on the edge. The orbits are tilted, so people at the front read larger than people
 * at the back, and each circle drifts slowly. A mint arc shows trust; a mint dot means open to work.
 * Hover to trace who introduced whom; filter by capability; click a person for the roles they fit.
 */
export function NetworkGraph({ nodes, links, heightClass = "h-[calc(100vh-180px)] min-h-[580px]", openRoles, compact = false }: { nodes: GNode[]; links: GLink[]; heightClass?: string; openRoles?: number; compact?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [cap, setCap] = useState<string | null>(null);
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
  const stats = useMemo(() => ({ total: people.length, trusted: people.filter((n) => n.trust >= TRUSTED).length, open: people.filter((n) => n.open).length }), [people]);
  const topCaps = useMemo(() => {
    const seen = new Map<string, { label: string; n: number }>();
    for (const p of people) for (const c of p.capabilities ?? []) { const k = c.trim().toLowerCase(); if (!k) continue; const e = seen.get(k); if (e) e.n += 1; else seen.set(k, { label: c.trim(), n: 1 }); }
    return [...seen.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, compact ? 4 : 6).map(([key, v]) => ({ key, label: v.label }));
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
    return { cx, cy, rx, ry, scale, placed, labelled, narrow, hub: Math.round(Math.max(34, Math.min(compact ? 50 : 64, rx * scale[0] * 0.62))), counts: groups.map((g) => g.length) };
  }, [box, people, links, hub, compact]);

  const byId = useMemo(() => new Map((layout?.placed ?? []).map((p) => [p.id, p])), [layout]);
  // Where someone is at time t. Depth runs 0 (back of the orbit) to 1 (front): front reads larger and sits on top.
  const at = (p: Placed, t: number) => {
    const th = p.angle + swayOf(p.ring, t);
    const depth = (Math.sin(th) + 1) / 2;
    return { x: layout!.cx + p.a * Math.cos(th), y: layout!.cy + p.b * Math.sin(th), depth, k: 0.86 + 0.24 * depth };
  };
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
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, paused, links]);

  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // A handful of introductions carry a moving signal, so the threads between people read as live.
  const signals = useMemo(() => { const step = Math.max(1, Math.ceil(links.length / 16)); return links.map((_, i) => i).filter((i) => i % step === 0); }, [links]);
  const showNames = !layout?.narrow && people.length <= (compact ? 26 : 44);
  const matches = (n: GNode) => !cap || (n.capabilities ?? []).some((c) => c.trim().toLowerCase() === cap);
  const lit = (id: string) => !focus || id === focus || neighbours.get(focus)?.has(id);

  const card = selectedNode ? <PersonCard n={selectedNode} connections={degree.get(selectedNode.id) ?? 0} onClose={() => setSelected(null)} /> : null;
  const hovered = hover ? byId.get(hover) : null;
  const hoveredAt = hovered && layout ? at(hovered, clock.current) : null;
  const t0 = clock.current;

  return (
    <div className={cn("relative w-full flex rounded-[22px] border border-line overflow-hidden", heightClass)}>
      <div ref={wrapRef} className="orbit-stage relative flex-1 min-w-0 bg-stage text-stage-ink" onClick={() => setSelected(null)}>
        {layout ? (
          <>
            {/* A slow radar sweep across the orbits. It is squashed to the same tilt as they are. */}
            <div className="pointer-events-none absolute" aria-hidden="true" style={{ left: layout.cx, top: layout.cy, width: layout.rx * 2, height: layout.rx * 2, transform: `translate(-50%, -50%) scaleY(${(layout.ry / layout.rx).toFixed(4)})` }}><div className="orbit-sweep" /></div>
            {/* The heartbeat: a wave leaves the centre on every beat and crosses the three circles. */}
            <div className="pointer-events-none absolute" aria-hidden="true" style={{ left: layout.cx, top: layout.cy, width: layout.rx * 2, height: layout.rx * 2, transform: `translate(-50%, -50%) scaleY(${(layout.ry / layout.rx).toFixed(4)})` }}>
              {[0, 1, 2].map((k) => <span key={k} className="orbit-ripple" style={{ animationDelay: `${k * BEAT}s` }} />)}
            </div>
            <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
              {/* The orbits, widest first: each a faint plate with a fine edge, so the three bands read as depth. */}
              {[2, 1, 0].map((r) => (
                <ellipse key={r} cx={layout.cx} cy={layout.cy} rx={layout.rx * layout.scale[r]} ry={layout.ry * layout.scale[r]} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray={r === 2 ? "1 7" : undefined} strokeLinecap="round" className={r === 2 ? "orbit-drift" : undefined} />
              ))}
              {/* Who introduced whom: a faint thread by default, a moving mint line for the person in focus. */}
              {links.map((l, i) => {
                const fromHub = l.source === hub?.id;
                const on = !!focus && (l.source === focus || l.target === focus);
                return <path key={i} id={`${uid}-l${i}`} ref={(el) => { if (el) linkEls.current.set(i, el); else linkEls.current.delete(i); }} d={pathFor(l, t0)} fill="none" className={on ? "orbit-flow" : undefined} stroke={on ? "var(--color-coral)" : "rgba(255,255,255,0.55)"} strokeWidth={on ? 1.8 : 1} strokeOpacity={on ? 1 : fromHub ? 0 : focus ? 0.07 : 0.2} strokeLinecap="round" />;
              })}
              {/* Signals running along the threads, from whoever made the introduction to the person. */}
              <g className="orbit-signals" opacity={focus ? 0.12 : 1}>
                {signals.map((i, k) => { const begin = `${((k * 0.53) % (BEAT * 2)).toFixed(2)}s`; const dur = `${BEAT * 2}s`; return (
                  <circle key={i} r={2.3} opacity={0} fill={links[i].source === hub?.id ? "var(--color-accent)" : "var(--color-coral)"}>
                    <animateMotion dur={dur} begin={begin} repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keyPoints="0;1;1" keySplines="0.4 0 0.2 1;0 0 1 1"><mpath href={`#${uid}-l${i}`} /></animateMotion>
                    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.08;0.42;0.5;1" dur={dur} begin={begin} repeatCount="indefinite" />
                  </circle>
                ); })}
              </g>
            </svg>

            {/* Each orbit carries its name as a tag at the top, in the gap its people leave. */}
            {RINGS.map((r, i) => layout.labelled[i] ? (
              <div key={r.label} className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-stage-line bg-stage px-2.5 py-[5px]" style={{ left: layout.cx, top: layout.cy - layout.ry * layout.scale[i] }}>
                <span className="label-caps text-stage-muted">{r.label}</span>
                <span className="text-[10.5px] font-semibold leading-none text-stage-ink">{layout.counts[i]}</span>
              </div>
            ) : null)}

            {/* You, at the centre: a soft halo and a two-part beat that sets the rhythm for everything else. */}
            <div className="pointer-events-none absolute z-[6] -translate-x-1/2 -translate-y-1/2" style={{ left: layout.cx, top: layout.cy, width: layout.hub, height: layout.hub }}>
              <span className="orbit-halo absolute -inset-[55%] rounded-full" />
              <span className="orbit-beat absolute inset-0 grid place-items-center rounded-full text-accent-ink"><span className="label-caps !tracking-[0.1em]" style={layout.hub < 44 ? { fontSize: 8.5 } : undefined}>You</span></span>
            </div>

            {layout.placed.map((p, i) => {
              const dim = !matches(p) || !lit(p.id);
              const trusted = p.trust >= TRUSTED;
              const active = hover === p.id || selected === p.id;
              const r = p.size / 2 - 1.5, c = 2 * Math.PI * r;
              const st = nodeStyle(p, t0);
              return (
                <button
                  key={p.id} type="button" aria-label={`${p.name}, trust ${Math.round(p.trust)}`} aria-pressed={selected === p.id}
                  ref={(el) => { if (el) nodeEls.current.set(p.id, el); else nodeEls.current.delete(p.id); }}
                  onClick={(e) => { e.stopPropagation(); setSelected(selected === p.id ? null : p.id); }}
                  onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)}
                  className={cn("group absolute left-0 top-0 cursor-pointer rounded-full transition-opacity duration-300", dim ? "opacity-20" : "opacity-100")}
                  style={{ width: p.size, height: p.size, transform: st.transform, zIndex: active ? 60 : st.zIndex }}
                >
                  <span className="node-in absolute inset-0 block" style={{ animationDelay: `${Math.min(i * 22, 600)}ms` }}>
                    {/* Lights up as the wave from the centre reaches this person's circle. */}
                    <span className={cn("orbit-glow", p.ring === 0 ? "is-near" : p.ring === 2 ? "is-far" : "")} style={{ animationDelay: `${beatDelay(layout.scale[p.ring]).toFixed(2)}s` }} aria-hidden="true" />
                    <svg viewBox={`0 0 ${p.size} ${p.size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
                      <circle cx={p.size / 2} cy={p.size / 2} r={r} fill="var(--color-stage)" stroke="rgba(255,255,255,0.22)" strokeWidth={1.5} />
                      {p.trust > 0 ? <circle cx={p.size / 2} cy={p.size / 2} r={r} fill="none" stroke="var(--color-accent)" strokeWidth={2.2} strokeLinecap="round" strokeDasharray={`${(Math.min(100, p.trust) / 100) * c} ${c}`} /> : null}
                    </svg>
                    <span className={cn("absolute inset-[4.5px] grid place-items-center rounded-full font-semibold leading-none transition-[transform,background-color,color] duration-200 group-hover:scale-110", trusted ? "bg-accent text-accent-ink" : active ? "bg-white text-[#0c1b33]" : "bg-white/[0.12] text-stage-ink", selected === p.id && "ring-2 ring-white ring-offset-2 ring-offset-stage")} style={{ fontSize: Math.max(8, Math.round(p.size * 0.29)) }}>
                      {p.size >= 22 ? initials(p.name) : ""}
                    </span>
                    {p.open ? <span className="orbit-ping absolute right-0 bottom-0 h-[10px] w-[10px] rounded-full bg-coral ring-2 ring-stage" style={{ animationDelay: `${((i * 0.41) % BEAT).toFixed(2)}s` }} aria-hidden="true" /> : null}
                    {showNames ? <span className={cn("pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-[11px] leading-none transition-colors duration-200", active ? "text-white font-semibold" : "text-stage-muted")}>{shortName(p.name)}</span> : null}
                  </span>
                </button>
              );
            })}

            {hovered && hoveredAt ? (
              <div className="pointer-events-none absolute z-[70] -translate-x-1/2 -translate-y-full rounded-[14px] bg-surface text-ink px-3 py-2 shadow-[var(--shadow-pop)]" style={{ left: Math.min(Math.max(hoveredAt.x, 130), (box?.w ?? 0) - 130), top: hoveredAt.y - (hovered.size * hoveredAt.k) / 2 - 10 }}>
                <div className="text-[12.5px] font-semibold whitespace-nowrap">{hovered.name}</div>
                {hovered.headline ? <div className="text-[11.5px] text-ink-muted max-w-[230px] truncate">{hovered.headline}</div> : null}
                <div className="text-[11px] text-ink-faint mt-1">Trust {Math.round(hovered.trust)} · {RINGS[hovered.ring].label.toLowerCase()}{hovered.roles?.length ? ` · fits ${hovered.roles.length} open role${hovered.roles.length === 1 ? "" : "s"}` : ""}</div>
              </div>
            ) : null}
          </>
        ) : null}

        {!compact ? (
          <dl className="pointer-events-none absolute left-6 top-5 flex gap-7">
            {[[stats.total, "in the network"], [stats.trusted, "trusted"], [stats.open, "open to work"], ...(openRoles != null ? [[openRoles, "open roles"]] : [])].map(([v, l]) => (
              <div key={String(l)}>
                <dd className="font-display text-[26px] leading-none text-stage-ink">{v}</dd>
                <dt className="text-[11.5px] text-stage-muted mt-1.5">{l}</dt>
              </div>
            ))}
          </dl>
        ) : null}

        {/* On the home page and on small screens the person opens as a floating card. */}
        {card ? <div onClick={(e) => e.stopPropagation()} className={cn("absolute right-3 top-3 z-[80] w-[300px] max-w-[calc(100%-24px)] max-h-[calc(100%-24px)] overflow-y-auto rounded-[22px] bg-surface text-ink shadow-[var(--shadow-pop)]", compact ? "" : "lg:hidden")}>{card}</div> : null}

        <div className="pointer-events-none absolute inset-x-5 bottom-4 z-[65] flex items-end justify-between gap-3">
          <div className="pointer-events-auto flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            {topCaps.length ? (
              <>
                <button type="button" onClick={() => setCap(null)} className={cn("rounded-full border px-3 py-1 text-[12px] cursor-pointer transition-colors duration-200", cap === null ? "bg-accent border-accent text-accent-ink font-semibold" : "bg-stage border-stage-line text-stage-ink hover:border-white/60")}>Everyone</button>
                {topCaps.map((c) => (
                  <button key={c.key} type="button" onClick={() => setCap(cap === c.key ? null : c.key)} aria-pressed={cap === c.key} className={cn("rounded-full border px-3 py-1 text-[12px] cursor-pointer transition-colors duration-200", cap === c.key ? "bg-accent border-accent text-accent-ink font-semibold" : "bg-stage border-stage-line text-stage-ink hover:border-white/60")}>{c.label}</button>
                ))}
              </>
            ) : null}
          </div>
          <div className="hidden md:flex flex-none items-center gap-4 text-[11.5px] text-stage-muted">
            <span className="inline-flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 14 14" className="-rotate-90" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" /><circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="20 40" strokeLinecap="round" /></svg> arc shows trust</span>
            <span className="inline-flex items-center gap-1.5"><span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-accent text-[7px] font-bold text-accent-ink">A</span> trusted</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-white/20" /> open to work</span>
          </div>
        </div>
      </div>

      {!compact ? (
        <aside className="hidden lg:block w-[320px] flex-none border-l border-line bg-surface overflow-y-auto">
          {card ?? (
            <div className="h-full flex flex-col justify-center px-7">
              <div className="label-caps text-ink-faint">How to read it</div>
              <ul className="mt-4 space-y-4">
                {RINGS.map((r, i) => (
                  <li key={r.label} className="flex gap-3">
                    <span className="mt-0.5 font-display text-[18px] leading-none text-ink w-6 flex-none">{layout?.counts[i] ?? 0}</span>
                    <span><span className="block text-[13px] font-semibold text-ink">{r.label}</span><span className="block text-[12.5px] text-ink-muted leading-[1.45] mt-0.5">{r.hint}</span></span>
                  </li>
                ))}
              </ul>
              <p className="text-[12.5px] text-ink-muted mt-6 pt-5 border-t border-line leading-[1.5]">Click anyone to see why you&apos;d trust them, whether they&apos;re free, and the open roles they fit. Hover to trace who introduced them.</p>
            </div>
          )}
        </aside>
      ) : null}
    </div>
  );
}

function PersonCard({ n, connections, onClose }: { n: GNode; connections: number; onClose: () => void }) {
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
