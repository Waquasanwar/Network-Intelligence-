"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Maximize2, Minus, Plus } from "lucide-react";
import DOTS from "@/data/land-dots.json";
import { cn } from "@/lib/utils";

export type GlobePerson = { id: string; name: string; headline: string; trust: number; worked: boolean; open: boolean };
export type GlobePlace = { key: string; label: string; lat: number; lng: number; people: GlobePerson[] };
export type GlobeArc = { from: string; to: string; intro: boolean };

/**
 * The network as a globe. Land is a field of dots and the routes are fine lines, both drawn on a
 * canvas at the screen's own resolution. The cities are real elements laid over it: a badge with
 * the number of people there, so the type and edges stay sharp at any size and each one can be
 * reached by keyboard. Cities too close to tell apart share one badge until you zoom in.
 *
 * Lines run from home to every city, and between two cities when someone in one introduced
 * someone in the other.
 */
type V3 = [number, number, number];
const RAD = Math.PI / 180;
const unit = (lat: number, lng: number): V3 => { const a = lat * RAD, o = lng * RAD; return [Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)]; };
// Land dots as unit vectors, worked out once. Natural Earth land (public domain), sampled every 1.8°.
const LAND = (() => { const src = DOTS as number[]; const n = src.length / 2; const out = new Float32Array(n * 3); for (let i = 0; i < n; i++) out.set(unit(src[i * 2 + 1] / 10, src[i * 2] / 10), i * 3); return out; })();
const SEGMENTS = 48;
// Two cities look closer on screen than they are on the sphere once they sit towards the edge. Badges are
// grouped as if every pair were that much closer, so they stay clear of each other wherever the globe is turned.
const NEAR = 0.72;
const MINT = "126, 227, 188", CORAL = "255, 102, 80";
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? "").join("");
/** A badge's width for the number of people it stands for. */
const badge = (n: number) => Math.round(Math.min(46, 20 + 6 * Math.sqrt(Math.max(1, n))));

type Route = { from: string; to: string; intro: boolean; pts: V3[]; lift: number[]; seed: number };
type Spot = GlobePlace & { v: V3 };
/** One badge: a city, or several that sit too close together at this zoom to show apart. */
type Box = { x: number; y: number; w: number; h: number };
type Group = { key: string; anchor: Spot; members: Spot[]; people: number; open: number; home: boolean; size: number };

export function NetworkGlobe({ places, arcs, home, unplaced = 0, heightClass = "lg:h-[calc(100vh-270px)] lg:min-h-[540px]", compact = false }: { places: GlobePlace[]; arcs: GlobeArc[]; home: string | null; unplaced?: number; heightClass?: string; compact?: boolean }) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const pins = React.useRef(new Map<string, HTMLButtonElement>());
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [hover, setHover] = React.useState<string | null>(null); // a group's key
  const [selected, setSelected] = React.useState<string | null>(null); // a place's key
  // What the drawing loop reads. Kept in a ref so pointing at something never restarts the loop.
  const live = React.useRef({ focus: [] as string[], selected: null as string | null, groups: [] as Group[], fly: null as { lng: number; lat: number; zoom?: number } | null });
  // Zoom: null means "fit the network"; the buttons set a level of their own.
  const zoom = React.useRef<{ goal: number | null; fit: number }>({ goal: null, fit: 1 });
  const zoomBy = (k: number) => { zoom.current.goal = k === 0 ? null : clamp((zoom.current.goal ?? zoom.current.fit) * k, 0.8, 6); };

  const spots = React.useMemo<Spot[]>(() => places.map((p) => ({ ...p, v: unit(p.lat, p.lng) })), [places]);
  const byKey = React.useMemo(() => new Map(spots.map((p) => [p.key, p])), [spots]);
  const total = React.useMemo(() => places.reduce((a, p) => a + p.people.length, 0), [places]);
  const open = React.useMemo(() => places.reduce((a, p) => a + p.people.filter((x) => x.open).length, 0), [places]);
  const listed = React.useMemo(() => places.filter((p) => p.people.length), [places]);
  const most = Math.max(1, ...listed.map((p) => p.people.length));

  const hovered = hover ? groups.find((g) => g.key === hover) ?? null : null;
  live.current.selected = selected; live.current.groups = groups;
  live.current.focus = selected ? [selected] : hovered ? hovered.members.map((m) => m.key) : [];

  // Each route as points along the great circle, lifted off the surface in the middle.
  const routes = React.useMemo<Route[]>(() => arcs.flatMap((a, i) => {
    const pa = byKey.get(a.from), pb = byKey.get(a.to); if (!pa || !pb) return [];
    const u = pa.v, v = pb.v, w = Math.acos(clamp(u[0] * v[0] + u[1] * v[1] + u[2] * v[2], -1, 1)); if (w < 1e-4) return [];
    const height = 0.05 + 0.26 * (w / Math.PI), s = Math.sin(w), pts: V3[] = [], lift: number[] = [];
    for (let k = 0; k <= SEGMENTS; k++) { const t = k / SEGMENTS, ka = Math.sin((1 - t) * w) / s, kb = Math.sin(t * w) / s; pts.push([ka * u[0] + kb * v[0], ka * u[1] + kb * v[1], ka * u[2] + kb * v[2]]); lift.push(1 + height * Math.sin(Math.PI * t)); }
    return [{ ...a, pts, lift, seed: (i * 0.37) % 1 }];
  }), [arcs, byKey]);

  // Start facing the middle of the network, so the first view holds as much of it as possible.
  const start = React.useMemo(() => {
    let x = 0, y = 0, z = 0;
    for (const p of spots) { const n = Math.max(1, p.people.length); x += p.v[0] * n; y += p.v[1] * n; z += p.v[2] * n; }
    const len = Math.hypot(x, y, z) || 1;
    const lng = Math.atan2(x / len, z / len) / RAD, lat = clamp((Math.asin(y / len) / RAD) * 0.85, -30, 42), c = unit(lat, lng);
    // How far the furthest city is from that middle, so the first view can be sized to hold them all.
    const spread = Math.max(0.2, ...spots.map((p) => Math.acos(clamp(p.v[0] * c[0] + p.v[1] * c[1] + p.v[2] * c[2], -1, 1))));
    return { lng, lat, spread };
  }, [spots]);

  React.useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current; if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const base = { lng: start.lng, lat: start.lat }; let goal: { lng: number; lat: number } | null = null;
    let w = 0, h = 0, dpr = 1, sway = still ? 0 : 1, raf = 0, lastSel: string | null = null, zoomNow = 0, R = 1, signature = "";
    const drag = { on: false, x: 0, y: 0, moved: 0 };
    const t0 = performance.now();
    // Biggest first, home ahead of the rest: the order badges are formed in, so the name on a shared badge is the main city.
    const ranked = [...spots].sort((a, b) => Number(b.key === home) - Number(a.key === home) || b.people.length - a.people.length || a.label.localeCompare(b.label));

    // Layout size, not the on-screen box: the two differ when the page is magnified, and everything
    // here is drawn in layout pixels. The magnification goes into the pixel ratio instead, so it stays sharp.
    const size = () => {
      w = wrap.clientWidth; h = wrap.clientHeight; const mag = w ? wrap.getBoundingClientRect().width / w : 1; dpr = Math.min((window.devicePixelRatio || 1) * mag, 3);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const baseR = Math.min(w * 0.46, h * 0.43) || 1; zoom.current.fit = clamp((0.4 * Math.min(w, h)) / (Math.sin(Math.min(start.spread + 0.1, Math.PI / 2)) * baseR), 1, 2.6); if (!zoomNow) zoomNow = zoom.current.fit;
    };
    const ro = new ResizeObserver(size); ro.observe(wrap); size();

    // Which cities share a badge at this zoom. Worked out on the sphere, not the screen, so it changes
    // when you zoom and never while the globe turns.
    const group = () => {
      const out: Group[] = [];
      for (const p of ranked) {
        const n = p.people.length, mine = badge(n) / 2;
        const into = out.find((g) => Math.acos(clamp(g.anchor.v[0] * p.v[0] + g.anchor.v[1] * p.v[1] + g.anchor.v[2] * p.v[2], -1, 1)) * R * NEAR < (g.size / 2 + mine) * 1.1 + 4);
        if (into) { into.members.push(p); into.people += n; into.open += p.people.filter((x) => x.open).length; into.home ||= p.key === home; into.size = badge(into.people); }
        else out.push({ key: p.key, anchor: p, members: [p], people: n, open: p.people.filter((x) => x.open).length, home: p.key === home, size: badge(n) });
      }
      // A badge grows as it takes cities in, so it can come to touch a neighbour it cleared at first.
      // Join any that still touch, largest first, until none do.
      const apart = (a: Group, b: Group) => Math.acos(clamp(a.anchor.v[0] * b.anchor.v[0] + a.anchor.v[1] * b.anchor.v[1] + a.anchor.v[2] * b.anchor.v[2], -1, 1)) * R * NEAR;
      for (let pass = 0; pass < 24; pass++) {
        let joined = false;
        for (let i = 0; i < out.length && !joined; i++) for (let j = i + 1; j < out.length && !joined; j++) {
          const a = out[i], b = out[j];
          if (apart(a, b) >= (a.size + b.size) / 2 + 5) continue;
          a.members.push(...b.members); a.people += b.people; a.open += b.open; a.home ||= b.home; a.size = badge(a.people); out.splice(j, 1); joined = true;
        }
        if (!joined) break;
      }
      for (const g of out) g.key = g.members.map((m) => m.key).join("+");
      const sig = out.map((g) => g.key).join("|");
      if (sig !== signature) { signature = sig; live.current.groups = out; setGroups(out); }
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!w || !h) return;
      const t = still ? 0 : Math.max(0, (now - t0) / 1000);
      const { focus, selected: sel, fly } = live.current;
      if (fly) { goal = { lng: fly.lng, lat: fly.lat }; if (fly.zoom) zoom.current.goal = fly.zoom; live.current.fly = null; lastSel = sel; }
      else if (sel !== lastSel) { lastSel = sel; const p = sel ? byKey.get(sel) : null; goal = p ? { lng: start.lng + (((p.lng - start.lng + 540) % 360) - 180) * 0.6, lat: clamp(start.lat + (p.lat - start.lat) * 0.6, -45, 50) } : { lng: start.lng, lat: start.lat }; }
      if (goal && !drag.on) { const d = ((goal.lng - base.lng + 540) % 360) - 180; base.lng += d * 0.07; base.lat += (goal.lat - base.lat) * 0.07; if (Math.abs(d) < 0.05 && Math.abs(goal.lat - base.lat) < 0.05) goal = null; }
      const calm = drag.on || focus.length > 0;
      if (!still) sway += ((calm ? 0 : 1) - sway) * 0.04;
      const lng = base.lng + sway * 11 * Math.sin(t * 0.17), lat = base.lat + sway * 2.2 * Math.sin(t * 0.11);
      const cl = Math.cos(lng * RAD), sl = Math.sin(lng * RAD), cp = Math.cos(lat * RAD), sp = Math.sin(lat * RAD);
      zoomNow += ((zoom.current.goal ?? zoom.current.fit) - zoomNow) * (still ? 1 : 0.12);
      R = Math.min(w * 0.46, h * 0.43) * zoomNow; const cx = w / 2, cy = h / 2 + 6;
      group();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      // The glow around the sphere, then the sphere itself, lit from the upper left.
      let g = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.42);
      g.addColorStop(0, "rgba(72, 132, 255, 0.30)"); g.addColorStop(0.35, "rgba(72, 132, 255, 0.10)"); g.addColorStop(1, "rgba(72, 132, 255, 0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.42, 0, 7); ctx.fill();
      g = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.5, R * 0.08, cx, cy, R);
      g.addColorStop(0, "#1b3a73"); g.addColorStop(0.55, "#0f2247"); g.addColorStop(1, "#091530");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(150, 190, 255, 0.28)"; ctx.lineWidth = 1; ctx.stroke();

      // Land, as dots of one clean size. Three passes by depth so the far side of the curve fades.
      const tiers = [new Path2D(), new Path2D(), new Path2D()], dot = clamp(R * 0.0058, 1.15, 2.5);
      for (let i = 0; i < LAND.length; i += 3) {
        const x = LAND[i], y = LAND[i + 1], z = LAND[i + 2];
        const x1 = x * cl - z * sl, z1 = x * sl + z * cl, y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        if (z2 <= 0.03) continue;
        const px = cx + R * x1, py = cy - R * y2, r = dot * (0.62 + 0.38 * z2);
        const tier = tiers[z2 > 0.62 ? 2 : z2 > 0.3 ? 1 : 0]; tier.moveTo(px + r, py); tier.arc(px, py, r, 0, 7);
      }
      ctx.fillStyle = "rgba(128, 162, 232, 0.22)"; ctx.fill(tiers[0]);
      ctx.fillStyle = "rgba(146, 180, 244, 0.40)"; ctx.fill(tiers[1]);
      ctx.fillStyle = "rgba(170, 200, 255, 0.62)"; ctx.fill(tiers[2]);

      const project = (v: V3, s: number) => { const x1 = v[0] * cl - v[2] * sl, z1 = v[0] * sl + v[2] * cl, y2 = v[1] * cp - z1 * sp, z2 = v[1] * sp + z1 * cp; return { x: cx + R * x1 * s, y: cy - R * y2 * s, shown: z2 >= 0 || (x1 * s) ** 2 + (y2 * s) ** 2 > 1, z: z2 }; };

      // Routes: a quiet line each, brighter for the place in focus, with one light travelling along it.
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const r of routes) {
        const on = focus.includes(r.from) || focus.includes(r.to), tone = r.intro ? CORAL : MINT;
        const alpha = focus.length ? (on ? 0.95 : 0.09) : r.intro ? 0.6 : 0.44;
        ctx.strokeStyle = `rgba(${tone}, ${alpha})`; ctx.lineWidth = on ? 1.9 : 1.25; ctx.beginPath();
        let pen = false;
        for (let k = 0; k <= SEGMENTS; k++) { const p = project(r.pts[k], r.lift[k]); if (!p.shown) { pen = false; continue; } if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); pen = true; }
        ctx.stroke();
        if (still || (focus.length && !on)) continue;
        const f = ((t * 0.19 + r.seed) % 1) * SEGMENTS, k = Math.min(SEGMENTS - 1, Math.floor(f)), m = f - k, a = r.pts[k], b = r.pts[k + 1];
        const p = project([a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m], r.lift[k] + (r.lift[k + 1] - r.lift[k]) * m);
        if (!p.shown) continue;
        const fade = Math.sin(Math.PI * (f / SEGMENTS));
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 7); glow.addColorStop(0, `rgba(${tone}, ${0.55 * fade})`); glow.addColorStop(1, `rgba(${tone}, 0)`);
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * fade})`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 7); ctx.fill();
      }

      // Put each badge where its city is now.
      const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const holds = (grp: Group) => focus.some((k) => grp.members.some((m) => m.key === k));
      const order = [...live.current.groups].sort((a, b) => Number(holds(b)) - Number(holds(a)) || Number(b.home) - Number(a.home) || b.people - a.people);
      const shown: { grp: Group; el: HTMLButtonElement; x: number; y: number; z: number; on: boolean }[] = [];
      for (const grp of order) {
        const el = pins.current.get(grp.key); if (!el) continue;
        const at = project(grp.anchor.v, 1);
        if (at.z <= 0.06) { if (el.style.visibility !== "hidden") el.style.visibility = "hidden"; continue; }
        const on = holds(grp), depth = clamp((at.z - 0.06) / 0.22, 0, 1);
        el.style.visibility = "visible";
        el.style.transform = `translate3d(${(at.x - grp.size / 2).toFixed(1)}px, ${(at.y - grp.size / 2).toFixed(1)}px, 0)`;
        el.style.opacity = String(depth);
        const dim = focus.length > 0 && !on; if ((el.dataset.dim === "1") !== dim) { if (dim) el.dataset.dim = "1"; else delete el.dataset.dim; }
        el.style.zIndex = on ? "30" : String(10 + Math.round(at.z * 10));
        shown.push({ grp, el, x: at.x, y: at.y, z: at.z, on });
      }
      // Names go to the main cities first, on whichever side is clear of every badge and every other name.
      const discs: (Box & { key: string })[] = shown.map((s) => ({ key: s.grp.key, x: s.x - s.grp.size / 2 - 3, y: s.y - s.grp.size / 2 - 3, w: s.grp.size + 6, h: s.grp.size + 6 }));
      const names: Box[] = [];
      for (const s of shown) {
        const wide = 26 + (s.el.dataset.name ?? "").length * 6.9, half = s.grp.size / 2;
        const right: Box = { x: s.x + half + 6, y: s.y - 12, w: wide, h: 24 }, left: Box = { x: s.x - half - 6 - wide, y: s.y - 12, w: wide, h: 24 };
        const free = (bx: Box) => s.z > 0.2 && bx.x > 4 && bx.x + bx.w < w - 4 && !discs.some((d) => d.key !== s.grp.key && hit(bx, d)) && !names.some((n) => hit(bx, n));
        let named = false, onLeft = false;
        if (free(right)) { named = true; names.push(right); } else if (free(left)) { named = true; onLeft = true; names.push(left); } else if (s.on) { named = true; onLeft = right.x + right.w > w - 4; names.push(onLeft ? left : right); }
        if ((s.el.dataset.named === "1") !== named) s.el.dataset.named = named ? "1" : "0";
        if ((s.el.dataset.left === "1") !== onLeft) s.el.dataset.left = onLeft ? "1" : "0";
      }
    };
    raf = requestAnimationFrame(draw);

    const down = (e: PointerEvent) => { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag.on) return;
      const b = canvas.getBoundingClientRect(), k = b.width ? w / b.width : 1, dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      base.lng -= (dx / R) * 57.3; base.lat = clamp(base.lat + (dy / R) * 57.3, -70, 70); goal = null;
      if (drag.moved > 4) canvas.style.cursor = "grabbing";
    };
    const up = () => { if (!drag.on) return; drag.on = false; canvas.style.cursor = "grab"; if (drag.moved <= 4) setSelected(null); };
    const cancel = () => { drag.on = false; canvas.style.cursor = "grab"; };
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", cancel);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", cancel); };
  }, [spots, routes, home, start, byKey]);

  // A badge for one city opens it. A badge for several moves in until they come apart.
  const choose = (g: Group) => {
    if (g.members.length === 1) { setSelected((was) => (was === g.anchor.key ? null : g.anchor.key)); return; }
    let x = 0, y = 0, z = 0; for (const m of g.members) { x += m.v[0]; y += m.v[1]; z += m.v[2]; } const len = Math.hypot(x, y, z) || 1;
    setSelected(null); setHover(null);
    live.current.fly = { lng: Math.atan2(x / len, z / len) / RAD, lat: clamp(Math.asin(y / len) / RAD, -60, 60), zoom: clamp((zoom.current.goal ?? zoom.current.fit) * 2.1, 0.8, 6) };
  };

  const at = selected ? byKey.get(selected) ?? null : null;

  return (
    <div className={cn("ink-stage widget relative w-full overflow-hidden lg:flex", heightClass)}>
      <div ref={wrapRef} className="globe-stage relative h-[min(92vw,460px)] min-w-0 flex-1 select-none overflow-hidden lg:h-auto">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: "pan-y", cursor: "grab" }} aria-hidden="true" />

        {groups.map((g, i) => {
          const holds = !!selected && g.members.some((m) => m.key === selected), shown = holds ? byKey.get(selected!)! : g.anchor, others = g.members.length - 1;
          const name = `${shown.label}${g.home && shown.key === home ? " home" : ""}${others ? ` +${others}` : ""}`;
          const said = g.members.length === 1 ? `${g.anchor.label}, ${g.people} ${g.people === 1 ? "person" : "people"}${g.home ? ", your base" : ""}` : `${g.anchor.label} and ${others} ${others === 1 ? "city" : "cities"} nearby, ${g.people} people. Zoom in.`;
          return (
            <button
              key={g.key} type="button" ref={(el) => { if (el) pins.current.set(g.key, el); else pins.current.delete(g.key); }}
              className="globe-pin" data-name={name} data-home={g.home ? "1" : undefined} data-on={holds || hover === g.key ? "1" : undefined} data-named="0" aria-label={said} aria-pressed={g.members.length === 1 ? holds : undefined}
              style={{ width: g.size, height: g.size, opacity: 0, ["--pin-delay" as string]: `${((i * 0.47) % 2.6).toFixed(2)}s` }}
              onClick={() => choose(g)} onPointerEnter={() => setHover(g.key)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(g.key)} onBlur={() => setHover(null)}
            >
              <span className="globe-pin-disc" style={{ fontSize: g.size >= 38 ? 14 : g.size >= 30 ? 12.5 : 11.5 }}>{g.people || ""}</span>
              {g.open ? <span className="globe-pin-open" aria-hidden="true" /> : null}
              <span className="globe-pin-name" aria-hidden="true">{shown.label}{g.home && shown.key === home ? <i>home</i> : null}{others ? <i>+{others}</i> : null}</span>
              {hover === g.key && !holds ? (
                <span className="globe-pin-card" aria-hidden="true">
                  {g.members.slice(0, 5).map((m) => <span key={m.key}><b>{m.label}</b><em>{m.people.length ? `${m.people.length} ${m.people.length === 1 ? "person" : "people"}` : "your base"}</em></span>)}
                  {g.members.length > 5 ? <span><em>and {g.members.length - 5} more</em></span> : null}
                  <small>{g.members.length > 1 ? "Click to zoom in" : g.open ? `${g.open} open to work · click to see who` : "Click to see who is here"}</small>
                </span>
              ) : null}
            </button>
          );
        })}

        <dl className="pointer-events-none absolute left-3 top-3 z-40 flex gap-6 rounded-[20px] border border-line bg-[#0b1a3a]/65 px-4 py-3 backdrop-blur-md sm:left-4 sm:top-4 sm:gap-7">
          {[[total, total === 1 ? "person on the map" : "people on the map"], [listed.length, listed.length === 1 ? "city" : "cities"], [open, "open to work"]].map(([v, l]) => (
            <div key={String(l)}>
              <dd className="font-display text-[26px] leading-none text-ink">{v}</dd>
              <dt className="mt-1.5 text-[11.5px] text-ink-muted">{l}</dt>
            </div>
          ))}
        </dl>
        <div className="absolute right-3 top-3 z-40 flex flex-col overflow-hidden rounded-full border border-line bg-[#0b1a3a]/65 backdrop-blur-md sm:right-4 sm:top-4">
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.4)} className="grid h-9 w-9 cursor-pointer place-items-center text-ink-muted transition-colors duration-200 hover:bg-surface-muted hover:text-ink"><Plus className="h-4 w-4" strokeWidth={2} /></button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.4)} className="grid h-9 w-9 cursor-pointer place-items-center border-t border-line text-ink-muted transition-colors duration-200 hover:bg-surface-muted hover:text-ink"><Minus className="h-4 w-4" strokeWidth={2} /></button>
          <button type="button" aria-label="Fit the whole network" onClick={() => { zoomBy(0); setSelected(null); live.current.fly = { lng: start.lng, lat: start.lat }; }} className="grid h-9 w-9 cursor-pointer place-items-center border-t border-line text-ink-muted transition-colors duration-200 hover:bg-surface-muted hover:text-ink"><Maximize2 className="h-3.5 w-3.5" strokeWidth={2} /></button>
        </div>
        <div className={cn("pointer-events-none absolute inset-x-5 bottom-4 z-40 flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-ink-muted sm:inset-x-6", compact ? "hidden lg:flex" : "hidden md:flex")}>
          <span className="inline-flex items-center gap-2"><span className="globe-key">3</span> people in a city</span>
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-coral ring-2 ring-[#0b1a3a]" /> someone there is open to work</span>
          <span className="inline-flex items-center gap-2"><span className="h-[2px] w-5 rounded-full bg-[#7ee3bc]" /> from your base</span>
          <span className="inline-flex items-center gap-2"><span className="h-[2px] w-5 rounded-full bg-coral" /> an introduction between cities</span>
        </div>
      </div>

      <aside className="flex-none overflow-y-auto border-t border-line bg-surface/70 text-ink max-lg:!basis-auto lg:border-l lg:border-t-0" style={{ flexBasis: compact ? 300 : 340 }} aria-label="Places in your network">
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
                  <button type="button" onClick={() => setSelected(p.key)} className="group grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-3 rounded-[14px] px-2.5 py-2 text-left transition-colors duration-200 hover:bg-surface-muted">
                    <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold text-ink"><span className="truncate">{p.label}</span>{p.key === home ? <span className="flex-none rounded-full border border-line px-1.5 py-px text-[10px] font-medium text-ink-muted">home</span> : null}{openHere ? <span className="h-2 w-2 flex-none rounded-full bg-coral" title={`${openHere} open to work`} /> : null}</span>
                    <span className="text-[13px] font-semibold tabular text-ink">{p.people.length}</span>
                    <span className="col-span-2 mt-1.5 h-[3px] rounded-full bg-surface-muted"><span className="block h-full rounded-full bg-[#7ee3bc]" style={{ width: `${Math.max(6, (p.people.length / most) * 100)}%` }} /></span>
                  </button>
                </li>
              ); })}
            </ul>
            <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-[1.5] text-ink-muted">Pick a city to see who is there, or drag the globe to turn it. Cities close together share one badge until you zoom in. Lines run from your base to each city; a coral line means someone in one city introduced someone in the other.{unplaced ? ` ${unplaced} ${unplaced === 1 ? "person has" : "people have"} no location yet and ${unplaced === 1 ? "is" : "are"} not on the map.` : ""}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
