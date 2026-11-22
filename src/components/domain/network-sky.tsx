"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { longitudeOf, cityName } from "@/lib/geo";
import { zoneFor, localTime } from "@/lib/place";
import { PersonCard, type GNode, type GLink } from "./network-graph";

/**
 * The network as a night sky over the places it lives. The horizon runs west to east, London to the
 * Gulf and on, with each city lit for day or night at its own local time. People rise above their
 * city: the more the network trusts them, the higher they sit. Arcs of light are introductions, who
 * brought whom in, so the constellations are the network's own lines of trust. Open to work twinkles
 * mint; someone new this month arrives gold, trailing light. Hover anyone to trace the chain of
 * introductions back to you; click for who they are and the open roles they fit.
 */

const FRESH_DAYS = 30;
const TRUSTED = 60;
const isFresh = (n: GNode) => n.addedDays != null && n.addedDays < FRESH_DAYS;
const unit = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967295; };
const shortName = (name: string) => { const [first, ...rest] = name.split(/\s+/); return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first; };
const ELSEWHERE = "elsewhere";

type City = { key: string; label: string; lon: number | null; x: number; zone: string | null; people: GNode[] };
type Star = GNode & { x: number; y: number; r: number; city: string };

export function NetworkSky({ nodes, links, openRoles, total, compact = false, heightClass = "h-[calc(100vh-250px)] min-h-[580px]" }: { nodes: GNode[]; links: GLink[]; openRoles?: number; total?: number; compact?: boolean; heightClass?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure(); const ro = new ResizeObserver(measure); ro.observe(el);
    setNow(new Date()); const id = setInterval(() => setNow(new Date()), 60_000);
    return () => { ro.disconnect(); clearInterval(id); };
  }, []);
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); }; addEventListener("keydown", esc); return () => removeEventListener("keydown", esc); }, []);

  const hub = useMemo(() => nodes.find((n) => n.hub) ?? null, [nodes]);
  const people = useMemo(() => nodes.filter((n) => !n.hub), [nodes]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const introducer = useMemo(() => new Map(links.map((l) => [l.target, l.source])), [links]);
  const stats = useMemo(() => ({ total: Math.max(total ?? 0, people.length), open: people.filter((n) => n.open).length, fresh: people.filter(isFresh).length }), [people, total]);
  const growth = useMemo(() => {
    const d = new Date(), months = Array.from({ length: 6 }, (_, i) => ({ label: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (5 - i), 1)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }), n: 0 }));
    for (const p of people) { if (p.addedDays == null) continue; const a = new Date(d.getTime() - p.addedDays * 86_400_000), back = (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + d.getUTCMonth() - a.getUTCMonth(); if (back >= 0 && back < 6) months[5 - back].n++; }
    return months;
  }, [people]);
  const topCaps = useMemo(() => {
    const seen = new Map<string, { label: string; n: number }>();
    for (const p of people) for (const c of p.capabilities ?? []) { const k = c.trim().toLowerCase(); if (!k) continue; const e = seen.get(k); if (e) e.n++; else seen.set(k, { label: c.trim(), n: 1 }); }
    return [...seen.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, compact ? 2 : 4).map(([key, v]) => ({ key, label: v.label }));
  }, [people, compact]);
  const matches = (n: GNode) => filter === "all" ? true : filter === "open" ? !!n.open : filter === "fresh" ? isFresh(n) : (n.capabilities ?? []).some((c) => c.trim().toLowerCase() === filter);

  const sky = useMemo(() => {
    if (!box || box.w < 200 || box.h < 200) return null;
    const { w, h } = box;
    const narrow = w < 640;
    const padX = narrow ? 34 : 88, top = compact ? 40 : narrow ? 160 : 104, horizon = h - (compact ? 122 : narrow ? 136 : 132);
    const bend = (x: number) => horizon + ((x - w / 2) ** 2) / (w * 5.2); // the curve of the earth
    // Cities, west to east. Close neighbours (Dubai and Abu Dhabi) are eased apart so both read.
    const groups = new Map<string, City>();
    for (const p of people) {
      const label = p.city ? cityName(p.city) : null, key = label ? label.toLowerCase() : ELSEWHERE;
      const g = groups.get(key) ?? { key, label: label ?? "Place not known", lon: label ? longitudeOf(p.city) : null, x: 0, zone: label ? zoneFor({ primaryCity: label }) : null, people: [] };
      g.people.push(p); groups.set(key, g);
    }
    const known = [...groups.values()].filter((c) => c.lon !== null).sort((a, b) => a.lon! - b.lon!);
    const unknown = [...groups.values()].filter((c) => c.lon === null);
    const list = [...known, ...unknown];
    const lo = known.length ? known[0].lon! : 0, hi = known.length ? known[known.length - 1].lon! : 1;
    const span = w - padX * 2, gap = Math.min(narrow ? 64 : 120, span / Math.max(1, list.length - 1 || 1));
    list.forEach((c, i) => { const geo = c.lon === null ? 1.08 : hi > lo ? (c.lon - lo) / (hi - lo) : 0.5; const rank = list.length > 1 ? i / (list.length - 1) : 0.5; c.x = padX + span * (0.55 * Math.min(1, geo) + 0.45 * rank); });
    for (let i = 1; i < list.length; i++) list[i].x = Math.max(list[i].x, list[i - 1].x + gap);
    const last = list[list.length - 1]?.x ?? 0, first = list[0]?.x ?? 0;
    if (list.length > 1 && (last > w - padX || first < padX)) { const k = span / (last - first); list.forEach((c) => (c.x = padX + (c.x - first) * k)); } else if (list.length === 1) list[0].x = w / 2;

    // People rise above their city by trust, spread sideways within the room their city has.
    const stars: Star[] = [];
    const skyH = horizon - top;
    const ceil = Math.max(70, ...people.map((p) => p.trust));
    const alt = (trust: number) => 30 + Math.pow(Math.max(0, Math.min(ceil, trust)) / ceil, 0.85) * (skyH - 44);
    list.forEach((c, ci) => {
      const room = Math.min(ci > 0 ? c.x - list[ci - 1].x : gap, ci < list.length - 1 ? list[ci + 1].x - c.x : gap) * 0.9;
      const sorted = [...c.people].sort((a, b) => b.trust - a.trust);
      const step = Math.min(narrow ? 18 : 30, room / Math.max(1, sorted.length));
      sorted.forEach((p, i) => {
        const side = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? -1 : 1);
        const t = Math.max(0, Math.min(100, p.trust)) / 100;
        const r = (p.worked ? (narrow ? 5.5 : 7) : narrow ? 4 : 5) + (narrow ? 0 : t * 2);
        stars.push({ ...p, city: c.key, r, x: c.x + side * step + (unit(p.id) - 0.5) * 10, y: bend(c.x) - alt(p.trust) + (unit(p.id + "y") - 0.5) * 18 });
      });
    });
    // Ease overlaps apart, a few passes, mostly sideways so height keeps meaning trust.
    for (let pass = 0; pass < 40; pass++) for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i], b = stars[j], dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r + (narrow ? 6 : 12), d = Math.hypot(dx, dy) || 0.01;
      if (d < min) { const push = (min - d) / 2, ux = dx / d || 1, uy = dy / d; a.x -= ux * push * 0.85; b.x += ux * push * 0.85; a.y -= uy * push * 0.15; b.y += uy * push * 0.15; }
    }
    for (const s of stars) { s.x = Math.max(16, Math.min(w - 16, s.x)); s.y = Math.max(top - 10, Math.min(bend(s.x) - 18, s.y)); }
    const at = new Map(stars.map((s) => [s.id, s]));
    const you = { x: w / 2, y: bend(w / 2) };
    // Names under the most trusted people, where they fit without colliding.
    const labels: { id: string; x: number; y: number; text: string }[] = [];
    if (!narrow && !compact) {
      const taken: { x0: number; x1: number; y0: number; y1: number }[] = [];
      for (const s of [...stars].sort((a, b) => b.trust - a.trust)) {
        const text = shortName(s.name), wd = text.length * 6.3, box2 = { x0: s.x - wd / 2, x1: s.x + wd / 2, y0: s.y + s.r + 3, y1: s.y + s.r + 17 };
        if (taken.some((t) => !(box2.x1 < t.x0 || box2.x0 > t.x1 || box2.y1 < t.y0 || box2.y0 > t.y1)) || stars.some((o) => o.id !== s.id && Math.abs(o.x - s.x) < wd / 2 + o.r && o.y > box2.y0 - o.r && o.y < box2.y1 + o.r)) continue;
        taken.push(box2); labels.push({ id: s.id, x: s.x, y: box2.y0 + 11, text });
        if (labels.length >= 14) break;
      }
    }
    const trustedY = bend(w / 2) - alt(TRUSTED);
    // City names where they fit, the busiest first; the rest keep their light on the horizon.
    const named = new Set<string>(); const placed: number[] = [];
    for (const c of [...list].sort((a, b) => b.people.length - a.people.length)) { if (placed.every((x) => Math.abs(x - c.x) > (narrow ? 62 : 74))) { named.add(c.key); placed.push(c.x); } }
    return { w, h, narrow, horizon, bend, cities: list, stars, at, you, labels, trustedY, named };
  }, [box, people, compact]);

  // The chain of introductions from someone back to you.
  const chain = useMemo(() => {
    const id = hover ?? selected; if (!id) return null;
    const ids = new Set<string>([id]); let cur = id;
    for (let k = 0; k < 12; k++) { const up = introducer.get(cur); if (!up) break; ids.add(up); if (up === hub?.id) break; cur = up; }
    return ids;
  }, [hover, selected, introducer, hub]);

  // A quiet field of background stars, the same every time.
  const field = useMemo(() => {
    if (!sky) return [];
    let seed = 0x9e3779b9; // a small, steady random sequence, so the field is the same every time and never lines up
    const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return Array.from({ length: sky.narrow ? 40 : 90 }, () => ({ x: rnd() * sky.w, y: rnd() * (sky.horizon - 10), r: rnd() < 0.85 ? 0.7 : 1.3, o: 0.15 + rnd() * 0.45 }));
  }, [sky]);

  const arc = (a: { x: number; y: number }, b: { x: number; y: number }) => { const mx = (a.x + b.x) / 2, lift = Math.min(a.y, b.y) - 26 - Math.abs(a.x - b.x) * 0.18; return `M${a.x},${a.y} Q${mx},${lift} ${b.x},${b.y}`; };
  const hovered = hover && sky ? sky.at.get(hover) ?? null : null;
  const selectedNode = selected ? byId.get(selected) ?? null : null;
  const filtering = filter !== "all";
  const dayAt = (zone: string | null) => { if (!zone || !now) return null; const [hh] = localTime(zone, now).split(":").map(Number); return hh >= 7 && hh < 19; };

  return (
    <div className={cn("sky", compact && "is-compact")} data-sky>
      <div ref={wrap} className={cn("sky-stage relative overflow-hidden", heightClass)} onClick={() => setSelected(null)}>
        {sky ? (
          <>
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${sky.w} ${sky.h}`} aria-hidden="true">
              <defs>
                <linearGradient id="sky-earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d2a3f" /><stop offset="1" stopColor="#050c1a" /></linearGradient>
                <linearGradient id="sky-rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7ee3bc" stopOpacity="0" /><stop offset=".5" stopColor="#7ee3bc" stopOpacity=".85" /><stop offset="1" stopColor="#7ee3bc" stopOpacity="0" /></linearGradient>
                <radialGradient id="sky-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff6d6" /><stop offset=".35" stopColor="#f2c46d" stopOpacity=".9" /><stop offset="1" stopColor="#f2c46d" stopOpacity="0" /></radialGradient>
              </defs>
              {field.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r={f.r} fill="#fff" opacity={f.o} className={i % 7 === 0 ? "sky-flicker" : undefined} style={i % 7 === 0 ? { animationDelay: `${(i % 11) * 0.7}s` } : undefined} />)}
              {!compact ? <g className="sky-guide"><line x1={0} x2={sky.w} y1={sky.trustedY} y2={sky.trustedY} /><text x={14} y={sky.trustedY - 6}>trusted</text></g> : null}
              {/* Introductions: who brought whom in. Lines from you show only when you trace a chain. */}
              {links.map((l, i) => {
                const a = l.source === hub?.id ? sky.you : sky.at.get(l.source), b = sky.at.get(l.target);
                if (!a || !b) return null;
                const lit = chain ? chain.has(l.source) && chain.has(l.target) : false;
                if (l.source === hub?.id && !lit) return null;
                const dim = (chain && !lit) || (filtering && !(matches(b as GNode)));
                return <path key={i} d={arc(a, b)} pathLength={1} className={cn("sky-arc", l.worked && "is-worked", lit && "is-lit", dim && "is-dim")} style={{ animationDelay: `${(i % 9) * 0.25}s` }} />;
              })}
              <path d={`M0,${sky.bend(0)} Q${sky.w / 2},${2 * sky.horizon - (sky.bend(0) + sky.bend(sky.w)) / 2} ${sky.w},${sky.bend(sky.w)} L${sky.w},${sky.h} L0,${sky.h} Z`} fill="url(#sky-earth)" />
              <path d={`M0,${sky.bend(0)} Q${sky.w / 2},${2 * sky.horizon - (sky.bend(0) + sky.bend(sky.w)) / 2} ${sky.w},${sky.bend(sky.w)}`} fill="none" stroke="url(#sky-rim)" strokeWidth="1.5" />
              {sky.cities.map((c) => { const day = dayAt(c.zone), y = sky.bend(c.x); return (
                <g key={c.key} className="sky-city">
                  <circle cx={c.x} cy={y} r={day ? 14 : 10} className={day ? "is-day" : "is-night"} />
                  <circle cx={c.x} cy={y} r={2.6} fill={day ? "#f2c46d" : "#a9c6ff"} />
                </g>
              ); })}
              <circle cx={sky.you.x} cy={sky.you.y + 2} r={compact ? 26 : 34} fill="url(#sky-sun)" className="sky-you-glow" />
            </svg>

            {/* City names and their local time, under the horizon. */}
            {sky.cities.filter((c) => sky.named.has(c.key)).map((c) => { const day = dayAt(c.zone); return (
              <div key={c.key} className="sky-city-label" style={{ left: c.x, top: sky.bend(c.x) + 10 }}>
                <b>{c.label}</b>
                <span suppressHydrationWarning>{c.zone && now ? `${localTime(c.zone, now)}${sky.narrow ? "" : day ? " day" : " night"} · ` : ""}{c.people.length}</span>
              </div>
            ); })}
            <div className="sky-you" style={{ left: sky.you.x, top: sky.you.y - 9 }} aria-hidden="true">You</div>

            {sky.stars.map((s) => {
              const lit = chain?.has(s.id), dim = (chain && !lit) || (filtering && !matches(s));
              return (
                <button
                  key={s.id} type="button"
                  className={cn("sky-star", s.worked && "is-worked", s.open && "is-open", isFresh(s) && "is-new", s.trust >= TRUSTED && "is-trusted", lit && "is-lit", dim && "is-dim", selected === s.id && "is-selected")}
                  style={{ left: s.x, top: s.y, width: s.r * 2 + 14, height: s.r * 2 + 14, ["--r" as string]: `${s.r}px`, animationDelay: `${unit(s.id) * 4}s` }}
                  aria-label={`${s.name}${s.headline ? `, ${s.headline}` : ""}${s.city ? `, ${s.city}` : ""}. Trust ${Math.round(s.trust)}${s.open ? ", open to work" : ""}${isFresh(s) ? ", new this month" : ""}`}
                  aria-pressed={selected === s.id}
                  onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(s.id)} onBlur={() => setHover(null)}
                  onClick={(e) => { e.stopPropagation(); setSelected(selected === s.id ? null : s.id); }}
                >
                  <span className="sky-dot" />
                  {isFresh(s) ? <span className="sky-trail" /> : null}
                </button>
              );
            })}
            {sky.labels.map((l) => { const s = sky.at.get(l.id)!; const dim = (chain && !chain.has(l.id)) || (filtering && !matches(s)); return <div key={l.id} className={cn("sky-name", dim && "is-dim")} style={{ left: l.x, top: l.y }} aria-hidden="true">{l.text}</div>; })}

            {hovered && !selected ? (
              <div className="sky-tip" style={{ left: Math.min(Math.max(hovered.x, 140), sky.w - 140), top: hovered.y - hovered.r - 12 }} role="presentation">
                <b>{hovered.name}</b>
                {hovered.headline ? <span className="block truncate">{hovered.headline}</span> : null}
                <small>Trust {Math.round(hovered.trust)}{(() => { const up = introducer.get(hovered.id); const who = up && up !== hub?.id ? byId.get(up) : null; return who ? ` · brought in by ${shortName(who.name)}` : up === hub?.id ? " · you brought them in" : ""; })()}{hovered.roles?.length ? ` · fits ${hovered.roles.length} open role${hovered.roles.length === 1 ? "" : "s"}` : ""}</small>
              </div>
            ) : null}
          </>
        ) : null}

        <dl className={cn("pointer-events-none absolute left-5 top-4 flex flex-wrap items-end gap-x-7 gap-y-2 sm:left-6 sm:top-5", compact && "max-sm:hidden")}>
          {[[stats.total, "in the network"], [`+${stats.fresh}`, "added in 30 days"], ...(compact ? [] : [[stats.open, "open to work"], ...(openRoles != null ? [[openRoles, "open roles"]] : [])])].map(([v, l], k) => (
            <div key={String(l)}>
              <dd className="flex items-end gap-2.5 font-display text-[26px] leading-none text-white">{v}
                {k === 1 ? (
                  <span className="mb-[2px] flex h-[20px] items-end gap-[3px]" role="img" aria-label={`People added in each of the last six months, oldest first: ${growth.map((m) => `${m.label} ${m.n}`).join(", ")}`}>
                    {growth.map((m, i) => { const topN = Math.max(1, ...growth.map((x) => x.n)); return <span key={m.label + i} title={`${m.label}: ${m.n}`} className="w-[5px] rounded-full" style={{ height: m.n ? `${Math.max(22, (m.n / topN) * 100)}%` : "3px", background: !m.n ? "rgba(255,255,255,0.16)" : i === 5 ? "#f2c46d" : "#7ee3bc" }} />; })}
                  </span>
                ) : null}
              </dd>
              <dt className="mt-1.5 text-[11.5px] text-white/60">{l}</dt>
            </div>
          ))}
        </dl>

        {selectedNode ? <div onClick={(e) => e.stopPropagation()} className="orbit-card absolute right-3 top-3 z-[80] w-[310px] max-w-[calc(100%-24px)] max-h-[calc(100%-24px)] overflow-y-auto rounded-[22px] text-ink"><PersonCard n={selectedNode} connections={links.filter((l) => l.source === selectedNode.id || l.target === selectedNode.id).length} onClose={() => setSelected(null)} /></div> : null}

        <div className="pointer-events-none absolute inset-x-4 bottom-3 z-[65] flex items-end justify-between gap-3 sm:inset-x-5 sm:bottom-4">
          <div className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto" onClick={(e) => e.stopPropagation()} role="group" aria-label="Show">
            {[["all", "Everyone"], ["open", "Open to work"], ...(stats.fresh ? [["fresh", "New this month"]] : []), ...topCaps.map((c) => [c.key, c.label])].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(filter === k && k !== "all" ? "all" : k)} aria-pressed={filter === k} className={cn("sky-filter", filter === k && "is-on", k === "fresh" && "is-gold")}>{l}</button>
            ))}
          </div>
          {!compact ? (
            <div className="sky-legend hidden lg:flex">
              <span><i className="is-height" />higher is more trusted</span>
              <span><i className="is-arc" />who introduced whom</span>
              <span><i className="is-open" />open to work</span>
              <span><i className="is-new" />new this month</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
