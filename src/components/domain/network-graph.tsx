"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
const ringOf = circleOf;

type Placed = GNode & { ring: number; x: number; y: number; size: number; angle: number };
const base0 = (ring: number, compact: boolean, narrow = false) => (narrow ? [30, 26, 22] : compact ? [36, 32, 28] : [44, 38, 32])[ring];

/**
 * The network as circles of trust — no chart dependency. You are at the centre; the people you have
 * worked with sit closest, people the network knows in the middle, new introductions on the edge.
 * Each person carries a ring showing their trust score and a mint dot when they are open to work.
 * Hover to see who introduced whom; filter by capability; click a person for the open roles they fit.
 */
export function NetworkGraph({ nodes, links, heightClass = "h-[calc(100vh-180px)] min-h-[560px]", openRoles, compact = false }: { nodes: GNode[]; links: GLink[]; heightClass?: string; openRoles?: number; compact?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [cap, setCap] = useState<string | null>(null);

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

  // Geometry: three ellipses that fill the frame, so a wide card gets wide orbits rather than a small circle.
  const layout = useMemo(() => {
    if (!box || box.w < 120 || box.h < 120) return null;
    const narrow = box.w < 560; // a phone: smaller people, no name captions, circles never taller than wide
    const padX = narrow ? 26 : compact ? 46 : 64, padTop = compact ? 30 : 92, padBottom = compact ? 80 : 108;
    const cx = box.w / 2, cy = padTop + (box.h - padTop - padBottom) / 2;
    const rx0 = Math.max(60, box.w / 2 - padX);
    const ry = Math.max(60, Math.min((box.h - padTop - padBottom) / 2, rx0 * 1.12));
    const rx = Math.min(rx0, ry * 2.1);
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
      // Each circle keeps a gap at the top for its name tag; people are spread round the rest.
      const need = RINGS[ring].label.length * 8.2 + 44 + base0(ring, compact, narrow);
      const gap = need / a <= 1.7 ? need / a : 0;
      labelled[ring] = gap > 0;
      const span = Math.PI * 2 - gap;
      const step = gap && n > 1 ? span / (n - 1) : span / n;
      const circumference = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
      const base = base0(ring, compact, narrow);
      const size = Math.round(Math.max(14, Math.min(base, (circumference / n) * 0.62)));
      ordered.forEach((p, i) => {
        const angle = gap ? (n > 1 ? -Math.PI / 2 + gap / 2 + i * step : Math.PI / 2) : -Math.PI / 2 + step / 2 + i * step;
        where.set(p.id, angle);
        placed.push({ ...p, ring, angle, size, x: cx + a * Math.cos(angle), y: cy + b * Math.sin(angle) });
      });
    });
    return { cx, cy, rx, ry, scale, placed, labelled, narrow, hub: Math.round(Math.max(30, Math.min(compact ? 44 : 56, rx * scale[0] * 0.62))), counts: groups.map((g) => g.length) };
  }, [box, people, links, hub, compact]);

  const byId = useMemo(() => new Map((layout?.placed ?? []).map((p) => [p.id, p])), [layout]);
  const focus = hover ?? selected;
  const showNames = !layout?.narrow && people.length <= (compact ? 26 : 44);
  const matches = (n: GNode) => !cap || (n.capabilities ?? []).some((c) => c.trim().toLowerCase() === cap);
  const lit = (id: string) => !focus || id === focus || neighbours.get(focus)?.has(id);

  const card = selectedNode ? <PersonCard n={selectedNode} connections={degree.get(selectedNode.id) ?? 0} onClose={() => setSelected(null)} /> : null;
  const hovered = hover ? byId.get(hover) : null;

  return (
    <div className={cn("relative w-full flex rounded-[8px] border border-line bg-surface overflow-hidden", heightClass)}>
      <div ref={wrapRef} className="relative flex-1 min-w-0" onClick={() => setSelected(null)}>
        {layout ? (
          <>
            <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
              {/* The circles, widest first so each sits on the one outside it. */}
              {[2, 1, 0].map((r) => (
                <ellipse key={r} cx={layout.cx} cy={layout.cy} rx={layout.rx * layout.scale[r]} ry={layout.ry * layout.scale[r]} fill={r === 2 ? "var(--color-surface-muted)" : r === 1 ? "var(--color-canvas)" : "var(--color-surface)"} stroke="var(--color-line)" strokeWidth={1} />
              ))}
              {/* Who introduced whom: a quiet curve by default, drawn in ink for the person in focus. */}
              {links.map((l, i) => {
                const a = l.source === hub?.id ? { x: layout.cx, y: layout.cy } : byId.get(l.source);
                const b = byId.get(l.target);
                if (!a || !b) return null;
                const fromHub = l.source === hub?.id;
                const on = !!focus && (l.source === focus || l.target === focus);
                if (fromHub && !on) return null;
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                const qx = mx + (layout.cx - mx) * 0.28, qy = my + (layout.cy - my) * 0.28;
                return <path key={i} d={`M${a.x},${a.y} Q${qx},${qy} ${b.x},${b.y}`} fill="none" stroke={on ? "var(--color-ink)" : "var(--color-navy-400)"} strokeWidth={on ? 1.5 : 1} strokeOpacity={on ? 0.9 : focus ? 0.08 : 0.28} strokeDasharray={l.worked || on ? undefined : "2 4"} strokeLinecap="round" />;
              })}
            </svg>

            {/* Each circle carries its name as a tag at the top, in the gap its people leave. */}
            {RINGS.map((r, i) => layout.labelled[i] ? (
              <div key={r.label} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-2.5 py-[5px]" style={{ left: layout.cx, top: layout.cy - layout.ry * layout.scale[i] }}>
                <span className="label-caps text-ink-muted">{r.label}</span>
                <span className="text-[10.5px] font-semibold leading-none text-ink">{layout.counts[i]}</span>
              </div>
            ) : null)}

            {/* You, at the centre. */}
            <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 grid place-items-center rounded-full bg-stage text-stage-ink ring-4 ring-surface" style={{ left: layout.cx, top: layout.cy, width: layout.hub, height: layout.hub }}>
              <span className="label-caps !tracking-[0.1em]" style={layout.hub < 40 ? { fontSize: 8.5 } : undefined}>You</span>
            </div>

            {layout.placed.map((p, i) => {
              const dim = !matches(p) || !lit(p.id);
              const trusted = p.trust >= TRUSTED;
              const r = p.size / 2 - 1.5, c = 2 * Math.PI * r;
              return (
                <button
                  key={p.id} type="button" aria-label={`${p.name}, trust ${Math.round(p.trust)}`} aria-pressed={selected === p.id}
                  onClick={(e) => { e.stopPropagation(); setSelected(selected === p.id ? null : p.id); }}
                  onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)}
                  className={cn("node-in group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full transition-opacity duration-200", dim ? "opacity-25" : "opacity-100", (hover === p.id || selected === p.id) && "z-10")}
                  style={{ left: p.x, top: p.y, width: p.size, height: p.size, animationDelay: `${Math.min(i * 18, 500)}ms` }}
                >
                  <svg viewBox={`0 0 ${p.size} ${p.size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
                    <circle cx={p.size / 2} cy={p.size / 2} r={r} fill="var(--color-surface)" stroke="var(--color-line-strong)" strokeWidth={1.5} />
                    {p.trust > 0 ? <circle cx={p.size / 2} cy={p.size / 2} r={r} fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeLinecap="round" strokeDasharray={`${(Math.min(100, p.trust) / 100) * c} ${c}`} /> : null}
                  </svg>
                  <span className={cn("absolute inset-[4px] grid place-items-center rounded-full font-semibold leading-none transition-transform duration-200 group-hover:scale-[1.06]", trusted ? "bg-stage text-stage-ink" : "bg-surface-muted text-ink", selected === p.id && "ring-2 ring-accent ring-offset-2 ring-offset-surface")} style={{ fontSize: Math.max(8, Math.round(p.size * 0.29)) }}>
                    {p.size >= 22 ? initials(p.name) : ""}
                  </span>
                  {p.open ? <span className="absolute right-0 bottom-0 h-[9px] w-[9px] rounded-full bg-accent ring-2 ring-surface" aria-hidden="true" /> : null}
                  {showNames ? <span className={cn("pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10.5px] leading-none transition-colors", hover === p.id || selected === p.id ? "text-ink font-semibold" : "text-ink-faint")}>{shortName(p.name)}</span> : null}
                </button>
              );
            })}

            {hovered ? (
              <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-[6px] border border-line bg-surface px-3 py-2 shadow-[var(--shadow-pop)]" style={{ left: Math.min(Math.max(hovered.x, 120), (box?.w ?? 0) - 120), top: hovered.y - hovered.size / 2 - 8 }}>
                <div className="text-[12.5px] font-semibold text-ink whitespace-nowrap">{hovered.name}</div>
                {hovered.headline ? <div className="text-[11.5px] text-ink-muted max-w-[230px] truncate">{hovered.headline}</div> : null}
                <div className="text-[11px] text-ink-faint mt-1 tabular">Trust {Math.round(hovered.trust)} · {RINGS[hovered.ring].label.toLowerCase()}{hovered.roles?.length ? ` · fits ${hovered.roles.length} open role${hovered.roles.length === 1 ? "" : "s"}` : ""}</div>
              </div>
            ) : null}
          </>
        ) : null}

        {!compact ? (
          <dl className="pointer-events-none absolute left-5 top-4 flex gap-6">
            {[[stats.total, "in the network"], [stats.trusted, "trusted"], [stats.open, "open to work"], ...(openRoles != null ? [[openRoles, "open roles"]] : [])].map(([v, l]) => (
              <div key={String(l)}>
                <dd className="font-display text-[22px] tabular leading-none text-ink">{v}</dd>
                <dt className="text-[11.5px] text-ink-faint mt-1">{l}</dt>
              </div>
            ))}
          </dl>
        ) : null}

        {/* On the home page and on small screens the person opens as a floating card. */}
        {card ? <div onClick={(e) => e.stopPropagation()} className={cn("absolute right-3 top-3 z-30 w-[300px] max-w-[calc(100%-24px)] max-h-[calc(100%-24px)] overflow-y-auto rounded-[6px] border border-line bg-surface shadow-[var(--shadow-pop)]", compact ? "" : "lg:hidden")}>{card}</div> : null}

        <div className="pointer-events-none absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-3">
          <div className="pointer-events-auto flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            {topCaps.length ? (
              <>
                <button type="button" onClick={() => setCap(null)} className={cn("rounded-full border px-3 py-1 text-[12px] cursor-pointer transition-colors duration-200", cap === null ? "bg-navy border-navy text-white font-semibold dark:text-canvas" : "bg-surface border-line text-ink-muted hover:border-ink hover:text-ink")}>Everyone</button>
                {topCaps.map((c) => (
                  <button key={c.key} type="button" onClick={() => setCap(cap === c.key ? null : c.key)} aria-pressed={cap === c.key} className={cn("rounded-full border px-3 py-1 text-[12px] cursor-pointer transition-colors duration-200", cap === c.key ? "bg-navy border-navy text-white font-semibold dark:text-canvas" : "bg-surface border-line text-ink-muted hover:border-ink hover:text-ink")}>{c.label}</button>
                ))}
              </>
            ) : null}
          </div>
          <div className="hidden md:flex flex-none items-center gap-4 text-[11.5px] text-ink-faint">
            <span className="inline-flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 14 14" className="-rotate-90" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--color-line-strong)" strokeWidth="1.5" /><circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeDasharray="20 40" strokeLinecap="round" /></svg> ring shows trust</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-stage" /> trusted</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent" /> open to work</span>
          </div>
        </div>
      </div>

      {!compact ? (
        <aside className="hidden lg:block w-[320px] flex-none border-l border-line overflow-y-auto">
          {card ?? (
            <div className="h-full flex flex-col justify-center px-7">
              <div className="label-caps text-ink-faint">How to read it</div>
              <ul className="mt-4 space-y-4">
                {RINGS.map((r, i) => (
                  <li key={r.label} className="flex gap-3">
                    <span className="mt-0.5 font-display text-[18px] tabular leading-none text-ink w-6 flex-none">{layout?.counts[i] ?? 0}</span>
                    <span><span className="block text-[13px] font-semibold text-ink">{r.label}</span><span className="block text-[12px] text-ink-muted leading-[1.45] mt-0.5">{r.hint}</span></span>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] text-ink-muted mt-6 pt-5 border-t border-line leading-[1.5]">Click anyone to see why you&apos;d trust them, whether they&apos;re free, and the open roles they fit. Hover to see who introduced them.</p>
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
        <Link href={`/network/${n.id}`} className="flex h-9 items-center justify-center gap-1.5 rounded-[6px] bg-navy text-white text-[13px] font-semibold transition-colors duration-200 hover:bg-navy-600 dark:text-canvas">Open profile <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>
    </div>
  );
}
