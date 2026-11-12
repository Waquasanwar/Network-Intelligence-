"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** An open requirement this person genuinely fits (from the matching engine, never a guess). */
export type GRole = { id: string; title: string; route: string | null; location: string | null; tier: "meets" | "conversation"; fit: number };
export type GNode = {
  id: string; name: string; headline: string; trust: number; worked: boolean; hub?: boolean;
  band?: string; vouchedBy?: number; capabilities?: string[]; city?: string | null;
  availability?: string; availabilityTone?: "teal" | "amber" | "neutral"; open?: boolean;
  member?: boolean; screened?: boolean; roles?: GRole[];
};
export type GLink = { source: string; target: string; worked: boolean };

type SimNode = GNode & { x: number; y: number; vx: number; vy: number; r: number; fx?: number; fy?: number };

const TRUSTED = 60; // the "trusted" band and above — see lib/trust.ts
const initials = (name: string) => name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
const TONE: Record<string, string> = { teal: "text-teal border-teal/30 bg-teal/10", amber: "text-amber border-amber/30 bg-amber/10", neutral: "text-ink-muted border-line bg-surface-muted" };

/**
 * The network as a living map — no chart dependency. People are sized by trust; edges are
 * provenance (who introduced whom) and the stronger "worked together" links, which carry a slow
 * pulse. Drag to reshape, hover to light up a neighbourhood, scroll to zoom, filter by capability,
 * and click a person to see why you'd trust them and which open roles they fit.
 */
export function NetworkGraph({ nodes, links, heightClass = "h-[calc(100vh-180px)] min-h-[520px]", openRoles, compact = false }: { nodes: GNode[]; links: GLink[]; heightClass?: string; openRoles?: number; compact?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; node: SimNode } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [cap, setCap] = useState<string | null>(null);
  const selRef = useRef<string | null>(null);
  const capRef = useRef<string | null>(null);
  const drawRef = useRef<(() => void) | null>(null);

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
  const selectedNode = useMemo(() => (selected ? nodes.find((n) => n.id === selected) ?? null : null), [nodes, selected]);

  // Selection and filter live in React; the canvas reads them through refs so the simulation never restarts.
  useEffect(() => { selRef.current = selected; capRef.current = cap; drawRef.current?.(); }, [selected, cap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cs = getComputedStyle(canvas);
    const C = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
    const col = {
      ink: C("--color-ink", "#1a1d29"),
      muted: C("--color-ink-muted", "#5a5f6e"),
      navy: C("--color-navy", "#3d3f7a"),
      navy400: C("--color-navy-400", "#7276b2"),
      line: C("--color-line-strong", "rgba(20,24,45,0.13)"),
      surface: C("--color-surface", "#ffffff"),
    };
    const stage = C("--graph-glow", "") === "1"; // on the dark stage, trusted people are drawn as light

    const byId = new Map<string, SimNode>();
    const sim: SimNode[] = nodes.map((n, i) => {
      const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      const node: SimNode = { ...n, x: Math.cos(a) * 240 + (Math.random() - 0.5) * 40, y: Math.sin(a) * 240 + (Math.random() - 0.5) * 40, vx: 0, vy: 0, r: n.hub ? 20 : 4.5 + Math.sqrt(Math.max(0, n.trust)) * 1.35 };
      if (n.hub) { node.x = 0; node.y = 0; node.fx = 0; node.fy = 0; }
      byId.set(n.id, node);
      return node;
    });
    const edges = links.map((l) => ({ s: byId.get(l.source), t: byId.get(l.target), worked: l.worked })).filter((e): e is { s: SimNode; t: SimNode; worked: boolean } => !!e.s && !!e.t);
    const neighbours = new Map<string, Set<string>>();
    for (const e of edges) {
      (neighbours.get(e.s.id) ?? neighbours.set(e.s.id, new Set()).get(e.s.id)!).add(e.t.id);
      (neighbours.get(e.t.id) ?? neighbours.set(e.t.id, new Set()).get(e.t.id)!).add(e.s.id);
    }
    const capKeys = new Map<string, Set<string>>(sim.map((n) => [n.id, new Set((n.capabilities ?? []).map((c) => c.trim().toLowerCase()))]));
    const topTrust = new Set([...sim].filter((n) => !n.hub).sort((a, b) => b.trust - a.trust).slice(0, 8).map((n) => n.id));

    const view = { x: 0, y: 0, k: 1 };
    let W = 0, H = 0, dpr = 1;
    let alpha = 1, clock = 0;
    let hover: SimNode | null = null;
    let drag: SimNode | null = null;
    let dragMoved = false;
    let downAt = { x: 0, y: 0 };
    let panning = false;
    let last = { x: 0, y: 0 };
    let raf = 0;
    let visible = true;
    let autoFit = true; // frame the whole network until the person takes the camera themselves
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dimmed = (n: SimNode) => { const c = capRef.current; return !!c && !n.hub && !capKeys.get(n.id)?.has(c); };

    /** Scale and centre so every node sits inside the frame, clear of the overlays. */
    function fit(instant = false) {
      if (!autoFit || !W || !sim.length) return;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const n of sim) { minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r); minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r + 16); }
      const padX = 56, padT = compact ? 24 : 92, padB = 62;
      const availW = Math.max(120, W - padX * 2), availH = Math.max(120, H - padT - padB);
      const k = Math.min(1.7, Math.max(0.3, Math.min(availW / Math.max(1, maxX - minX), availH / Math.max(1, maxY - minY))));
      const tx = padX + availW / 2 - ((minX + maxX) / 2) * k, ty = padT + availH / 2 - ((minY + maxY) / 2) * k;
      if (instant) { view.k = k; view.x = tx; view.y = ty; }
      else { view.k += (k - view.k) * 0.12; view.x += (tx - view.x) * 0.12; view.y += (ty - view.y) * 0.12; }
    }

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      const first = !W;
      W = rect.width; H = rect.height; dpr = Math.min(2, devicePixelRatio || 1);
      canvas!.width = W * dpr; canvas!.height = H * dpr;
      canvas!.style.width = W + "px"; canvas!.style.height = H + "px";
      if (first) { view.x = W / 2; view.y = H / 2; }
      fit(true);
      draw();
    }

    function tick() {
      // Repulsion (all pairs) + spring (edges) + mild centering.
      for (let i = 0; i < sim.length; i++) {
        const a = sim[i];
        for (let j = i + 1; j < sim.length; j++) {
          const b = sim[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy || 0.01;
          const f = (1600 * alpha) / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
        a.vx -= a.x * 0.002 * alpha; a.vy -= a.y * 0.002 * alpha;
      }
      for (const e of edges) {
        const target = e.worked ? 64 : 92;
        const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = ((d - target) / d) * 0.045 * (e.worked ? 1.5 : 1) * alpha;
        const fx = dx * f, fy = dy * f;
        e.s.vx += fx; e.s.vy += fy; e.t.vx -= fx; e.t.vy -= fy;
      }
      for (const n of sim) {
        if (n.fx != null) { n.x = n.fx; n.vx = 0; } else { n.vx *= 0.82; n.x += n.vx; }
        if (n.fy != null) { n.y = n.fy; n.vy = 0; } else { n.vy *= 0.82; n.y += n.vy; }
      }
      alpha *= 0.985;
    }

    function toScreen(n: SimNode) { return { x: n.x * view.k + view.x, y: n.y * view.k + view.y }; }

    function draw() {
      if (!W) return;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, W, H);
      ctx!.save();
      ctx!.translate(view.x, view.y); ctx!.scale(view.k, view.k);
      // Hover focuses a neighbourhood and quietens the rest; a selection only marks the person, so
      // the map stays readable while their card is open.
      const sel = selRef.current;
      const active = hover ? new Set([hover.id, ...(neighbours.get(hover.id) ?? [])]) : null;

      edges.forEach((e, i) => {
        const on = !active || (active.has(e.s.id) && active.has(e.t.id));
        const off = dimmed(e.s) || dimmed(e.t);
        const mine = !!sel && (e.s.id === sel || e.t.id === sel);
        ctx!.beginPath();
        ctx!.moveTo(e.s.x, e.s.y); ctx!.lineTo(e.t.x, e.t.y);
        ctx!.lineWidth = (e.worked || mine ? 1.8 : 1.1) / view.k;
        ctx!.strokeStyle = mine ? col.navy : col.navy400;
        ctx!.globalAlpha = off ? 0.05 : !on ? 0.07 : mine ? 0.85 : e.worked ? 0.6 : 0.3;
        ctx!.stroke();
        // A slow pulse travels the links you've actually worked across — the map is alive, not a diagram.
        if (e.worked && on && !off && !reduce) {
          const m = (Math.sin(clock * 1.2 + i * 1.7) + 1) / 2;
          ctx!.globalAlpha = 0.85; ctx!.fillStyle = col.navy;
          ctx!.beginPath(); ctx!.arc(e.s.x + (e.t.x - e.s.x) * m, e.s.y + (e.t.y - e.s.y) * m, 1.8 / view.k, 0, Math.PI * 2); ctx!.fill();
        }
      });

      for (const n of sim) {
        const on = !active || active.has(n.id);
        const off = dimmed(n);
        const a = off ? 0.12 : on ? 1 : 0.2;
        const trusted = n.hub || n.trust >= TRUSTED;
        if (trusted && !off && on) { ctx!.globalAlpha = stage ? 0.2 : 0.16; ctx!.fillStyle = stage ? col.navy : col.navy400; ctx!.beginPath(); ctx!.arc(n.x, n.y, n.r + 6, 0, Math.PI * 2); ctx!.fill(); }
        ctx!.globalAlpha = a;
        if (stage && trusted && !off && on) { ctx!.shadowColor = col.navy; ctx!.shadowBlur = 22 * dpr; }
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        if (n.hub) { ctx!.fillStyle = col.navy; ctx!.fill(); ctx!.lineWidth = 3 / view.k; ctx!.strokeStyle = col.surface; ctx!.stroke(); }
        else if (trusted) { ctx!.fillStyle = col.navy; ctx!.fill(); }
        else if (n.worked) { ctx!.fillStyle = col.navy400; ctx!.fill(); }
        else { ctx!.fillStyle = col.surface; ctx!.fill(); ctx!.lineWidth = 1.8 / view.k; ctx!.strokeStyle = col.navy400; ctx!.stroke(); }
        ctx!.shadowBlur = 0;
        if (hover === n || sel === n.id) {
          ctx!.globalAlpha = 1;
          ctx!.beginPath(); ctx!.arc(n.x, n.y, n.r + 4 / view.k, 0, Math.PI * 2); ctx!.lineWidth = (sel === n.id ? 2.4 : 1.6) / view.k; ctx!.strokeStyle = col.navy; ctx!.stroke();
        }
      }

      // Labels, most important first, skipping any that would sit on top of one already placed:
      // the hub, whoever is selected or hovered, their neighbourhood, then everyone by trust.
      ctx!.globalAlpha = 1; ctx!.textAlign = "center"; ctx!.textBaseline = "top";
      const rank = (n: SimNode) => (n.hub ? 0 : sel === n.id || hover === n ? 1 : active?.has(n.id) ? 2 : 3);
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      const wantAll = sim.length <= 60 || !!capRef.current;
      for (const n of [...sim].sort((a, b) => rank(a) - rank(b) || b.trust - a.trust)) {
        if (dimmed(n) || (active && !active.has(n.id) && !n.hub && sel !== n.id)) continue;
        const r = rank(n);
        if (r === 3 && !wantAll && !topTrust.has(n.id)) continue;
        const size = (n.hub ? 12 : 10.5) / view.k;
        ctx!.font = `${r <= 1 ? "600 " : ""}${size}px Inter, system-ui, sans-serif`;
        const w = ctx!.measureText(n.name).width + 8 / view.k, h = size * 1.35;
        const box = { x: n.x - w / 2, y: n.y + n.r + 5 / view.k, w, h };
        if (r > 1 && placed.some((p) => box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h && box.y + box.h > p.y)) continue;
        placed.push(box);
        ctx!.fillStyle = r <= 1 ? col.ink : col.muted;
        ctx!.fillText(n.name, n.x, box.y);
      }
      ctx!.restore();
    }
    drawRef.current = draw;

    function frame() {
      raf = 0;
      if (alpha > 0.004 || drag) { tick(); fit(); }
      clock += 0.016;
      draw();
      if (visible) raf = requestAnimationFrame(frame);
    }
    function ensure() { if (!reduce && visible && !raf) raf = requestAnimationFrame(frame); }
    function kick(a = 0.5) {
      alpha = Math.max(alpha, a);
      if (reduce) { for (let i = 0; i < 40; i++) tick(); draw(); } else ensure();
    }

    function worldPos(ev: PointerEvent | WheelEvent) {
      const rect = canvas!.getBoundingClientRect();
      return { x: (ev.clientX - rect.left - view.x) / view.k, y: (ev.clientY - rect.top - view.y) / view.k, sx: ev.clientX - rect.left, sy: ev.clientY - rect.top };
    }
    function pick(wx: number, wy: number): SimNode | null {
      for (let i = sim.length - 1; i >= 0; i--) { const n = sim[i]; const dx = n.x - wx, dy = n.y - wy; if (dx * dx + dy * dy <= (n.r + 4) * (n.r + 4)) return n; }
      return null;
    }

    const onMove = (ev: PointerEvent) => {
      const p = worldPos(ev);
      if (drag) {
        if (!dragMoved && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) < 4) return; // a click, not a drag
        drag.fx = p.x; drag.fy = p.y; dragMoved = true; autoFit = false; kick(0.3); setTip(null); return;
      }
      if (panning) { autoFit = false; view.x += ev.clientX - last.x; view.y += ev.clientY - last.y; last = { x: ev.clientX, y: ev.clientY }; draw(); return; }
      const hit = pick(p.x, p.y);
      if (hit !== hover) { hover = hit; canvas!.style.cursor = hit ? "pointer" : "grab"; draw(); }
      if (hit) { const s = toScreen(hit); setTip({ x: s.x, y: s.y - hit.r * view.k - 8, node: hit }); } else setTip(null);
    };
    const onDown = (ev: PointerEvent) => {
      canvas!.setPointerCapture(ev.pointerId);
      const p = worldPos(ev); const hit = pick(p.x, p.y);
      downAt = { x: ev.clientX, y: ev.clientY };
      if (hit && !hit.hub) { drag = hit; dragMoved = false; hit.fx = hit.x; hit.fy = hit.y; }
      else { panning = true; last = { x: ev.clientX, y: ev.clientY }; canvas!.style.cursor = "grabbing"; }
    };
    const onUp = (ev: PointerEvent) => {
      if (drag) { const d = drag; d.fx = undefined; d.fy = undefined; if (!dragMoved) { setSelected(d.id); setTip(null); } drag = null; }
      panning = false; canvas!.style.cursor = hover ? "pointer" : "grab";
      try { canvas!.releasePointerCapture(ev.pointerId); } catch {}
    };
    const onLeave = () => { if (hover) { hover = null; draw(); } setTip(null); };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault(); autoFit = false;
      const p = worldPos(ev); const k = Math.min(3, Math.max(0.3, view.k * (ev.deltaY < 0 ? 1.1 : 0.9)));
      view.x = p.sx - p.x * k; view.y = p.sy - p.y * k; view.k = k; draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) ensure(); });
    io.observe(wrap);
    resize();
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    if (reduce) { for (let i = 0; i < 300; i++) tick(); alpha = 0; fit(true); draw(); } else ensure();

    return () => {
      drawRef.current = null;
      ro.disconnect(); io.disconnect();
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [nodes, links, compact]);

  const card =selectedNode ? <PersonCard n={selectedNode} connections={degree.get(selectedNode.id) ?? 0} onClose={() => setSelected(null)} /> : null;

  return (
    <div className={cn("relative w-full flex rounded-[16px] border border-line bg-surface overflow-hidden", heightClass)}>
      <div ref={wrapRef} className="graph-stage brand-panel relative flex-1 min-w-0">
        <canvas ref={canvasRef} className="block touch-none" />

        {!compact ? (
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
            {[[stats.total, "in the network"], [stats.trusted, "trusted"], [stats.open, "open to work"], ...(openRoles != null ? [[openRoles, "open roles"]] : [])].map(([v, l]) => (
              <div key={String(l)} className="glass-tile rounded-[13px] px-4 py-2.5">
                <div className="font-display text-[22px] font-semibold tabular leading-7 tracking-[-0.02em] text-white">{v}</div>
                <div className="text-[11px] text-white/55">{l}</div>
              </div>
            ))}
          </div>
        ) : null}

        {tip ? (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[10px] border border-line bg-surface px-2.5 py-1.5 shadow-[var(--shadow-card)]" style={{ left: tip.x, top: tip.y }}>
            <div className="text-[12.5px] font-semibold text-ink whitespace-nowrap">{tip.node.name}</div>
            {tip.node.headline ? <div className="text-[11px] text-ink-muted max-w-[220px] truncate">{tip.node.headline}</div> : null}
            {tip.node.hub ? null : <div className="text-[10.5px] text-ink-faint mt-0.5">Trust {Math.round(tip.node.trust)}{tip.node.worked ? " · worked together" : ""}{tip.node.roles?.length ? ` · fits ${tip.node.roles.length} open role${tip.node.roles.length === 1 ? "" : "s"}` : ""}</div>}
          </div>
        ) : null}

        {/* On the home page and on small screens the person opens as a floating card. */}
        {card ? <div className={cn("absolute right-3 top-3 z-20 w-[300px] max-w-[calc(100%-24px)] max-h-[calc(100%-24px)] overflow-y-auto rounded-[14px] border border-line bg-surface shadow-[var(--shadow-card)]", compact ? "" : "lg:hidden")}>{card}</div> : null}

        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
          <div className="pointer-events-auto flex flex-wrap gap-1.5">
            {topCaps.length ? (
              <>
                <button type="button" onClick={() => setCap(null)} className={cn("rounded-full border px-2.5 py-1 text-[11.5px] cursor-pointer transition-colors", cap === null ? "bg-accent border-accent text-accent-ink font-semibold shadow-[0_0_18px_-6px_var(--color-accent)]" : "bg-white/[0.07] backdrop-blur border-white/15 text-white/75 hover:border-white/35 hover:text-white")}>Everyone</button>
                {topCaps.map((c) => (
                  <button key={c.key} type="button" onClick={() => setCap(cap === c.key ? null : c.key)} aria-pressed={cap === c.key} className={cn("rounded-full border px-2.5 py-1 text-[11.5px] cursor-pointer transition-colors", cap === c.key ? "bg-accent border-accent text-accent-ink font-semibold shadow-[0_0_18px_-6px_var(--color-accent)]" : "bg-white/[0.07] backdrop-blur border-white/15 text-white/75 hover:border-white/35 hover:text-white")}>{c.label}</button>
                ))}
              </>
            ) : null}
          </div>
          <div className="hidden md:flex flex-none items-center gap-3 text-[11px] text-white/60 bg-white/[0.07] backdrop-blur rounded-full border border-white/15 px-3 py-1.5">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" /> trusted</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#a3a6ec]" /> worked together</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[#a3a6ec]" /> introduced</span>
            {compact ? null : <span>· size = trust</span>}
          </div>
        </div>
      </div>

      {!compact ? (
        <aside className="hidden lg:block w-[320px] flex-none border-l border-line overflow-y-auto">
          {card ?? (
            <div className="h-full flex flex-col items-center justify-center text-center px-7">
              <div className="h-10 w-10 rounded-full border border-dashed border-line-strong mb-3" aria-hidden="true" />
              <div className="text-[13px] font-medium text-ink">Pick a person</div>
              <p className="text-[12px] text-ink-muted mt-1 leading-[1.5]">Click anyone on the map to see why you&apos;d trust them, whether they&apos;re free, and the open roles they fit. Drag to reshape; hover to light up who they know.</p>
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
      <div className="flex items-start gap-3 p-4 bg-[radial-gradient(420px_160px_at_0%_0%,var(--color-navy-50),transparent)]">
        <span className="h-11 w-11 flex-none rounded-[13px] bg-gradient-to-br from-navy-400 to-navy text-white text-[14px] font-semibold inline-flex items-center justify-center">{initials(n.name)}</span>
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
        <Link href={`/network/${n.id}`} className="flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-navy text-white text-[13px] font-medium hover:bg-navy-600 dark:text-canvas">Open profile <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>
    </div>
  );
}
