"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Maximize2 } from "lucide-react";
import DOTS from "@/data/land-dots.json";
import { cn } from "@/lib/utils";

export type GlobePerson = { id: string; name: string; headline: string; trust: number; worked: boolean; open: boolean };
export type GlobePlace = { key: string; label: string; lat: number; lng: number; people: GlobePerson[] };
export type GlobeArc = { from: string; to: string; intro: boolean };

/**
 * The network as a globe. Land is a field of dots, each city your people are in is a light, and the
 * lines are the routes between them: from home to every city, and between two cities when someone in
 * one introduced someone in the other. Drawn on a canvas at the screen's own resolution.
 *
 * The canvas is a picture; the list beside it holds the same places as buttons, so everything on the
 * globe can be reached by keyboard and read by a screen reader.
 */
type V3 = [number, number, number];
const RAD = Math.PI / 180;
const unit = (lat: number, lng: number): V3 => { const a = lat * RAD, o = lng * RAD; return [Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)]; };
// Land dots as unit vectors, worked out once. Natural Earth land (public domain), sampled every 1.8°.
const LAND = (() => { const src = DOTS as number[]; const n = src.length / 2; const out = new Float32Array(n * 3); for (let i = 0; i < n; i++) out.set(unit(src[i * 2 + 1] / 10, src[i * 2] / 10), i * 3); return out; })();
const SEGMENTS = 44;
const MINT = "126, 227, 188", CORAL = "255, 102, 80", ICE = "214, 228, 255";
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? "").join("");

type Route = { from: string; to: string; intro: boolean; pts: V3[]; lift: number[]; seed: number };
type Hit = { key: string; x: number; y: number; r: number };

export function NetworkGlobe({ places, arcs, home, unplaced = 0, heightClass = "lg:h-[calc(100vh-270px)] lg:min-h-[540px]", compact = false }: { places: GlobePlace[]; arcs: GlobeArc[]; home: string | null; unplaced?: number; heightClass?: string; compact?: boolean }) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = React.useState<Hit | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  // Zoom: null means "fit the network"; the buttons set a level of their own.
  const zoom = React.useRef<{ goal: number | null; fit: number }>({ goal: null, fit: 1 });
  const zoomBy = (k: number) => { zoom.current.goal = k === 0 ? null : clamp((zoom.current.goal ?? zoom.current.fit) * k, 0.8, 4.5); };
  const live = React.useRef({ hover: null as string | null, selected: null as string | null });
  live.current.hover = hover?.key ?? null; live.current.selected = selected;

  const byKey = React.useMemo(() => new Map(places.map((p) => [p.key, p])), [places]);
  const total = React.useMemo(() => places.reduce((a, p) => a + p.people.length, 0), [places]);
  const open = React.useMemo(() => places.reduce((a, p) => a + p.people.filter((x) => x.open).length, 0), [places]);
  const listed = React.useMemo(() => places.filter((p) => p.people.length), [places]);
  const most = Math.max(1, ...listed.map((p) => p.people.length));

  // Each route as points along the great circle, lifted off the surface in the middle.
  const routes = React.useMemo<Route[]>(() => arcs.flatMap((a, i) => {
    const pa = byKey.get(a.from), pb = byKey.get(a.to); if (!pa || !pb) return [];
    const u = unit(pa.lat, pa.lng), v = unit(pb.lat, pb.lng);
    const w = Math.acos(clamp(u[0] * v[0] + u[1] * v[1] + u[2] * v[2], -1, 1)); if (w < 1e-4) return [];
    const height = 0.05 + 0.26 * (w / Math.PI), s = Math.sin(w), pts: V3[] = [], lift: number[] = [];
    for (let k = 0; k <= SEGMENTS; k++) { const t = k / SEGMENTS, ka = Math.sin((1 - t) * w) / s, kb = Math.sin(t * w) / s; pts.push([ka * u[0] + kb * v[0], ka * u[1] + kb * v[1], ka * u[2] + kb * v[2]]); lift.push(1 + height * Math.sin(Math.PI * t)); }
    return [{ ...a, pts, lift, seed: (i * 0.37) % 1 }];
  }), [arcs, byKey]);

  // Start facing the middle of the network, so the first view holds as much of it as possible.
  const start = React.useMemo(() => {
    let x = 0, y = 0, z = 0;
    for (const p of places) { const v = unit(p.lat, p.lng), n = Math.max(1, p.people.length); x += v[0] * n; y += v[1] * n; z += v[2] * n; }
    const len = Math.hypot(x, y, z) || 1;
    const lng = Math.atan2(x / len, z / len) / RAD, lat = clamp((Math.asin(y / len) / RAD) * 0.85, -30, 42), c = unit(lat, lng);
    // How far the furthest city is from that middle, so the first view can be sized to hold them all.
    const spread = Math.max(0.2, ...places.map((p) => { const v = unit(p.lat, p.lng); return Math.acos(clamp(v[0] * c[0] + v[1] * c[1] + v[2] * c[2], -1, 1)); }));
    return { lng, lat, spread };
  }, [places]);

  React.useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current; if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    const base = { lng: start.lng, lat: start.lat }; let goal: { lng: number; lat: number } | null = null;
    let w = 0, h = 0, dpr = 1, sway = still ? 0 : 1, raf = 0, hits: Hit[] = [], lastSel: string | null = null, zoomNow = 0, R = 1;
    const drag = { on: false, x: 0, y: 0, moved: 0, id: -1 };
    const t0 = performance.now();

    // Layout size, not the on-screen box: the two differ when the page is magnified, and everything
    // here is drawn in layout pixels. The magnification goes into the pixel ratio instead, so it stays sharp.
    const size = () => { w = wrap.clientWidth; h = wrap.clientHeight; const mag = w ? wrap.getBoundingClientRect().width / w : 1; dpr = Math.min((window.devicePixelRatio || 1) * mag, 3); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const baseR = Math.min(w * 0.46, h * 0.43) || 1; zoom.current.fit = clamp((0.4 * Math.min(w, h)) / (Math.sin(Math.min(start.spread + 0.1, Math.PI / 2)) * baseR), 1, 2.6); if (!zoomNow) zoomNow = zoom.current.fit; };
    const ro = new ResizeObserver(size); ro.observe(wrap); size();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!w || !h) return;
      const t = still ? 0 : Math.max(0, (now - t0) / 1000);
      const { hover: hov, selected: sel } = live.current;
      if (sel !== lastSel) { lastSel = sel; const p = sel ? byKey.get(sel) : null; goal = p ? { lng: start.lng + ((((p.lng - start.lng + 540) % 360) - 180) * 0.6), lat: clamp(start.lat + (p.lat - start.lat) * 0.6, -45, 50) } : { lng: start.lng, lat: start.lat }; }
      if (goal && !drag.on) { let d = ((goal.lng - base.lng + 540) % 360) - 180; base.lng += d * 0.07; base.lat += (goal.lat - base.lat) * 0.07; if (Math.abs(d) < 0.05 && Math.abs(goal.lat - base.lat) < 0.05) goal = null; d = 0; }
      const calm = drag.on || !!hov || !!sel;
      if (!still) sway += ((calm ? 0 : 1) - sway) * 0.04;
      const lng = base.lng + sway * 13 * Math.sin(t * 0.17), lat = base.lat + sway * 2.5 * Math.sin(t * 0.11);
      const cl = Math.cos(lng * RAD), sl = Math.sin(lng * RAD), cp = Math.cos(lat * RAD), sp = Math.sin(lat * RAD);
      zoomNow += ((zoom.current.goal ?? zoom.current.fit) - zoomNow) * (still ? 1 : 0.12);
      R = Math.min(w * 0.46, h * 0.43) * zoomNow; const cx = w / 2, cy = h / 2 + 6;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      // The glow around the sphere, then the sphere itself, lit from the upper left.
      let g = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.42);
      g.addColorStop(0, "rgba(72, 132, 255, 0.30)"); g.addColorStop(0.35, "rgba(72, 132, 255, 0.10)"); g.addColorStop(1, "rgba(72, 132, 255, 0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.42, 0, 7); ctx.fill();
      g = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.5, R * 0.08, cx, cy, R);
      g.addColorStop(0, "#1b3a73"); g.addColorStop(0.55, "#0f2247"); g.addColorStop(1, "#091530");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(150, 190, 255, 0.28)"; ctx.lineWidth = 1; ctx.stroke();

      // Land, as dots. Three passes by depth so the far side of the curve fades without per-dot styles.
      const tiers = [new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < LAND.length; i += 3) {
        const x = LAND[i], y = LAND[i + 1], z = LAND[i + 2];
        const x1 = x * cl - z * sl, z1 = x * sl + z * cl, y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        if (z2 <= 0.03) continue;
        const px = cx + R * x1, py = cy - R * y2, r = Math.max(0.55, Math.min(2.6, R * 0.0056) * (0.5 + 0.5 * z2));
        const tier = tiers[z2 > 0.62 ? 2 : z2 > 0.3 ? 1 : 0]; tier.moveTo(px + r, py); tier.arc(px, py, r, 0, 7);
      }
      ctx.fillStyle = "rgba(130, 165, 235, 0.26)"; ctx.fill(tiers[0]);
      ctx.fillStyle = "rgba(150, 185, 245, 0.46)"; ctx.fill(tiers[1]);
      ctx.fillStyle = "rgba(176, 205, 255, 0.72)"; ctx.fill(tiers[2]);

      const focus = sel ?? hov;
      const project = (v: V3, s: number) => { const x1 = v[0] * cl - v[2] * sl, z1 = v[0] * sl + v[2] * cl, y2 = v[1] * cp - z1 * sp, z2 = v[1] * sp + z1 * cp; return { x: cx + R * x1 * s, y: cy - R * y2 * s, shown: z2 >= 0 || (x1 * s) ** 2 + (y2 * s) ** 2 > 1, z: z2 }; };

      // Routes: a quiet line each, brighter for the place in focus, with one light travelling along it.
      ctx.lineCap = "round";
      for (const r of routes) {
        const on = !!focus && (r.from === focus || r.to === focus), tone = r.intro ? CORAL : MINT;
        const alpha = focus ? (on ? 0.95 : 0.1) : r.intro ? 0.55 : 0.42;
        ctx.strokeStyle = `rgba(${tone}, ${alpha})`; ctx.lineWidth = on ? 1.8 : 1.1; ctx.beginPath();
        let pen = false;
        for (let k = 0; k <= SEGMENTS; k++) { const p = project(r.pts[k], r.lift[k]); if (!p.shown) { pen = false; continue; } if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); pen = true; }
        ctx.stroke();
        if (still || (focus && !on)) continue;
        const f = ((t * 0.19 + r.seed) % 1) * SEGMENTS, k = Math.floor(f), m = f - k, a = r.pts[k], b = r.pts[Math.min(SEGMENTS, k + 1)];
        const p = project([a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m], r.lift[k] + (r.lift[Math.min(SEGMENTS, k + 1)] - r.lift[k]) * m);
        if (!p.shown) continue;
        const fade = Math.sin(Math.PI * (f / SEGMENTS));
        ctx.fillStyle = `rgba(${tone}, ${0.22 * fade})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * fade})`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.9, 0, 7); ctx.fill();
      }

      // Cities, far ones first.
      const spots = places.map((p, i) => ({ p, i, at: project(unit(p.lat, p.lng), 1) })).filter((s) => s.at.z > 0.04).sort((a, b) => a.at.z - b.at.z);
      hits = [];
      const labels: { x: number; y: number; w: number; h: number }[] = [];
      const top = new Set(listed.slice(0, 8).map((p) => p.key));
      for (const { p, i, at } of spots) {
        const n = p.people.length, isHome = p.key === home, on = p.key === focus;
        const depth = clamp((at.z - 0.04) / 0.28, 0, 1), fadeOut = focus && !on ? 0.45 : 1, a = depth * fadeOut;
        const r = (isHome ? 4.4 : 3) + 1.9 * Math.sqrt(n) + (on ? 1.2 : 0);
        hits.push({ key: p.key, x: at.x, y: at.y, r: r + 9 });
        const halo = ctx.createRadialGradient(at.x, at.y, r * 0.6, at.x, at.y, r * 3.4);
        halo.addColorStop(0, `rgba(${MINT}, ${0.34 * a})`); halo.addColorStop(1, `rgba(${MINT}, 0)`);
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(at.x, at.y, r * 3.4, 0, 7); ctx.fill();
        if (!still) { const ph = (t * 0.42 + i * 0.23) % 1; ctx.strokeStyle = `rgba(${MINT}, ${(1 - ph) * 0.5 * a})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(at.x, at.y, r * (1 + ph * 1.9), 0, 7); ctx.stroke(); }
        ctx.fillStyle = isHome ? `rgba(255, 255, 255, ${a})` : `rgba(${MINT}, ${a})`; ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(9, 21, 48, ${0.9 * a})`; ctx.lineWidth = 1.5; ctx.stroke();
        if (isHome || on) { ctx.strokeStyle = `rgba(${isHome && !on ? MINT : "255, 255, 255"}, ${0.9 * a})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(at.x, at.y, r + 3.4, 0, 7); ctx.stroke(); }
        if (p.people.some((x) => x.open)) { ctx.fillStyle = `rgba(${CORAL}, ${a})`; ctx.beginPath(); ctx.arc(at.x + r * 0.78, at.y - r * 0.78, 3, 0, 7); ctx.fill(); ctx.strokeStyle = `rgba(9, 21, 48, ${a})`; ctx.lineWidth = 1.4; ctx.stroke(); }
      }
      // Names: home, the place in focus and the largest few, wherever they do not run into each other.
      ctx.textBaseline = "middle";
      for (const { p, at } of [...spots].sort((a, b) => Number(b.p.key === focus) - Number(a.p.key === focus) || Number(b.p.key === home) - Number(a.p.key === home) || b.p.people.length - a.p.people.length)) {
        const on = p.key === focus; if (!(on || p.key === home || top.has(p.key)) || at.z < 0.22) continue;
        const r = 3 + 1.9 * Math.sqrt(p.people.length), text = p.key === home && !on ? `${p.label} · you` : p.label, count = p.people.length ? String(p.people.length) : "";
        ctx.font = `600 ${on ? 13 : 12}px ${font}`; const tw = ctx.measureText(text).width; ctx.font = `500 11px ${font}`; const cw = count ? ctx.measureText(count).width + 7 : 0;
        const left = at.x + r + 9 + tw + cw > w - 8, x = left ? at.x - r - 9 - tw - cw : at.x + r + 9, box = { x: x - 3, y: at.y - 9, w: tw + cw + 6, h: 18 };
        if (!on && labels.some((b) => box.x < b.x + b.w && b.x < box.x + box.w && box.y < b.y + b.h && b.y < box.y + box.h)) continue;
        labels.push(box);
        const a = clamp((at.z - 0.22) / 0.2, 0, 1) * (focus && !on ? 0.5 : 1);
        ctx.font = `600 ${on ? 13 : 12}px ${font}`; ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(9, 21, 48, ${0.85 * a})`; ctx.strokeText(text, x, at.y); ctx.fillStyle = `rgba(238, 243, 252, ${a})`; ctx.fillText(text, x, at.y);
        if (count) { ctx.font = `500 11px ${font}`; ctx.strokeText(count, x + tw + 7, at.y); ctx.fillStyle = `rgba(${ICE}, ${0.75 * a})`; ctx.fillText(count, x + tw + 7, at.y); }
      }
    };
    raf = requestAnimationFrame(draw);

    const pick = (e: PointerEvent) => { const b = canvas.getBoundingClientRect(), k = b.width ? w / b.width : 1, x = (e.clientX - b.left) * k, y = (e.clientY - b.top) * k; let best: Hit | null = null, d = Infinity; for (const hit of hits) { const q = Math.hypot(hit.x - x, hit.y - y); if (q < hit.r && q < d) { best = hit; d = q; } } return best; };
    const down = (e: PointerEvent) => { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; drag.id = e.pointerId; canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (drag.on) {
        const b = canvas.getBoundingClientRect(), k = b.width ? w / b.width : 1, dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
        base.lng -= (dx / R) * 57.3; base.lat = clamp(base.lat + (dy / R) * 57.3, -70, 70); goal = null;
        if (drag.moved > 4) { canvas.style.cursor = "grabbing"; setHover(null); }
        return;
      }
      const hit = pick(e); canvas.style.cursor = hit ? "pointer" : "grab";
      setHover((was) => (was?.key === hit?.key ? was : hit ? { ...hit } : null));
    };
    const up = (e: PointerEvent) => { if (!drag.on) return; drag.on = false; canvas.style.cursor = "grab"; if (drag.moved <= 4) { const hit = pick(e); setSelected((was) => (hit ? (was === hit.key ? null : hit.key) : null)); } };
    const leave = () => { if (!drag.on) setHover(null); };
    const cancel = () => { drag.on = false; };
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointerleave", leave); canvas.addEventListener("pointercancel", cancel);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointerleave", leave); canvas.removeEventListener("pointercancel", cancel); };
  }, [places, routes, home, start, byKey, listed]);

  const at = selected ? byKey.get(selected) ?? null : null;
  const tip = hover && hover.key !== selected ? byKey.get(hover.key) : null;

  return (
    <div className={cn("ink-stage widget relative w-full overflow-hidden lg:flex", heightClass)}>
      <div ref={wrapRef} className="globe-stage relative h-[min(92vw,460px)] min-w-0 flex-1 select-none lg:h-auto">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: "pan-y", cursor: "grab" }} aria-hidden="true" />
        <dl className="pointer-events-none absolute left-3 top-3 flex gap-6 rounded-[20px] bg-[#0b1a3a]/60 px-4 py-3 backdrop-blur-sm sm:left-4 sm:top-4 sm:gap-7">
          {[[total, total === 1 ? "person on the map" : "people on the map"], [listed.length, listed.length === 1 ? "city" : "cities"], [open, "open to work"]].map(([v, l]) => (
            <div key={String(l)}>
              <dd className="font-display text-[26px] leading-none text-ink">{v}</dd>
              <dt className="mt-1.5 text-[11.5px] text-ink-muted">{l}</dt>
            </div>
          ))}
        </dl>
        {tip && hover ? (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[14px] border border-line bg-surface px-3 py-2 shadow-[var(--shadow-pop)]" style={{ left: hover.x, top: hover.y - hover.r - 4 }}>
            <div className="whitespace-nowrap text-[12.5px] font-semibold text-ink">{tip.label}</div>
            <div className="whitespace-nowrap text-[11.5px] text-ink-muted">{tip.people.length ? `${tip.people.length} ${tip.people.length === 1 ? "person" : "people"}${tip.people.some((x) => x.open) ? ` · ${tip.people.filter((x) => x.open).length} open to work` : ""}` : "Your base"}</div>
          </div>
        ) : null}
        <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-full border border-line bg-surface/80 backdrop-blur sm:right-5 sm:top-5">
          {[["+", "Zoom in", 1.35], ["\u2212", "Zoom out", 1 / 1.35]].map(([glyph, name, k]) => <button key={String(name)} type="button" aria-label={String(name)} onClick={() => zoomBy(Number(k))} className="grid h-9 w-9 cursor-pointer place-items-center text-[17px] leading-none text-ink-muted transition-colors duration-200 hover:bg-surface-muted hover:text-ink">{glyph}</button>)}
          <button type="button" aria-label="Fit the whole network" onClick={() => zoomBy(0)} className="grid h-9 w-9 cursor-pointer place-items-center border-t border-line text-ink-muted transition-colors duration-200 hover:bg-surface-muted hover:text-ink"><Maximize2 className="h-3.5 w-3.5" /></button>
        </div>
        <div className={cn("pointer-events-none absolute inset-x-5 bottom-4 flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-ink-muted sm:inset-x-6", compact ? "hidden md:flex" : "flex")}>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#7ee3bc]" /> a city your people are in</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-coral" /> someone there is open to work</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-[2px] w-4 rounded-full bg-coral" /> an introduction between cities</span>
        </div>
      </div>

      <aside className="flex-none overflow-y-auto border-t max-lg:!basis-auto border-line bg-surface/70 text-ink lg:border-l lg:border-t-0" style={{ flexBasis: compact ? 300 : 340 }} aria-label="Places in your network">
        {at ? (
          <div className="p-5 sm:p-6">
            <button type="button" onClick={() => setSelected(null)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full text-[12.5px] font-medium text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> All places</button>
            <h2 className="mt-3 font-display text-[22px] leading-tight text-ink">{at.label}</h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">{at.people.length ? `${at.people.length} ${at.people.length === 1 ? "person" : "people"} here, strongest first.` : "Your base. Nobody in the network is recorded here yet."}</p>
            <ul className="mt-4 space-y-1.5">
              {at.people.map((p) => (
                <li key={p.id}>
                  <Link href={`/network/${p.id}`} className="group flex items-center gap-3 rounded-[16px] border border-transparent px-2.5 py-2 transition-colors duration-200 hover:border-line hover:bg-surface-muted">
                    <span className={cn("relative grid h-9 w-9 flex-none place-items-center rounded-full text-[11.5px] font-semibold", p.worked ? "bg-[#7ee3bc] text-[#06231a]" : "bg-surface-muted text-ink ring-1 ring-line")}>{initials(p.name)}{p.open ? <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-surface" /> : null}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold text-ink">{p.name}</span><span className="block truncate text-[12px] text-ink-muted">{p.headline || (p.worked ? "Worked together" : "In your network")}</span></span>
                    <span className="flex-none text-right"><span className="block text-[13px] font-semibold tabular text-ink">{p.trust}</span><span className="block text-[10.5px] text-ink-faint">trust</span></span>
                    <ArrowUpRight className="h-3.5 w-3.5 flex-none text-ink-faint transition-colors group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <div className="label-caps text-ink-faint">Where your network is</div>
            <ul className="mt-3 space-y-0.5">
              {listed.map((p) => { const openHere = p.people.filter((x) => x.open).length; return (
                <li key={p.key}>
                  <button type="button" onClick={() => setSelected(p.key)} onPointerEnter={() => setHover(null)} className="group grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-3 rounded-[14px] px-2.5 py-2 text-left transition-colors duration-200 hover:bg-surface-muted">
                    <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold text-ink"><span className="truncate">{p.label}</span>{p.key === home ? <span className="flex-none rounded-full border border-line px-1.5 py-px text-[10px] font-medium text-ink-muted">home</span> : null}{openHere ? <span className="h-2 w-2 flex-none rounded-full bg-coral" title={`${openHere} open to work`} /> : null}</span>
                    <span className="text-[13px] font-semibold tabular text-ink">{p.people.length}</span>
                    <span className="col-span-2 mt-1.5 h-[3px] rounded-full bg-surface-muted"><span className="block h-full rounded-full bg-[#7ee3bc]" style={{ width: `${Math.max(6, (p.people.length / most) * 100)}%` }} /></span>
                  </button>
                </li>
              ); })}
            </ul>
            <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-[1.5] text-ink-muted">Pick a city to see who is there, or drag the globe to turn it. Lines run from your base to each city; a coral line means someone in one city introduced someone in the other.{unplaced ? ` ${unplaced} ${unplaced === 1 ? "person has" : "people have"} no location yet and ${unplaced === 1 ? "is" : "are"} not on the map.` : ""}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
