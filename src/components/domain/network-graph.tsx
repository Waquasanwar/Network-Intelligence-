"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type GNode = { id: string; name: string; headline: string; trust: number; worked: boolean; hub?: boolean };
export type GLink = { source: string; target: string; worked: boolean };

type SimNode = GNode & { x: number; y: number; vx: number; vy: number; r: number; fx?: number; fy?: number };

/**
 * Self-contained force-directed graph of the network — no chart dependency.
 * Nodes are people sized by trust; edges are provenance (who introduced whom) and the
 * stronger "worked together" links. Drag, hover to focus a neighbourhood, scroll to zoom,
 * click a node to open the profile.
 */
export function NetworkGraph({ nodes, links }: { nodes: GNode[]; links: GLink[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [tip, setTip] = useState<{ x: number; y: number; node: SimNode } | null>(null);

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
      faint: C("--color-ink-faint", "#9498a5"),
      navy: C("--color-navy", "#3b3ba8"),
      navy400: C("--color-navy-400", "#6b6bf0"),
      navy50: C("--color-navy-50", "#f1f1fc"),
      line: C("--color-line-strong", "rgba(20,24,45,0.13)"),
      surface: C("--color-surface", "#ffffff"),
    };

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

    const view = { x: 0, y: 0, k: 1 };
    let W = 0, H = 0, dpr = 1;
    let alpha = 1;
    let hover: SimNode | null = null;
    let drag: SimNode | null = null;
    let dragMoved = false;
    let panning = false;
    let last = { x: 0, y: 0 };
    let raf = 0;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      W = rect.width; H = rect.height; dpr = Math.min(2, devicePixelRatio || 1);
      canvas!.width = W * dpr; canvas!.height = H * dpr;
      canvas!.style.width = W + "px"; canvas!.style.height = H + "px";
      view.x = W / 2; view.y = H / 2;
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
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, W, H);
      ctx!.save();
      ctx!.translate(view.x, view.y); ctx!.scale(view.k, view.k);
      const active = hover ? new Set([hover.id, ...(neighbours.get(hover.id) ?? [])]) : null;

      for (const e of edges) {
        const on = !active || (active.has(e.s.id) && active.has(e.t.id));
        ctx!.beginPath();
        ctx!.moveTo(e.s.x, e.s.y); ctx!.lineTo(e.t.x, e.t.y);
        ctx!.lineWidth = (e.worked ? 1.6 : 1) / view.k;
        ctx!.strokeStyle = e.worked ? col.navy400 : col.line;
        ctx!.globalAlpha = on ? (e.worked ? 0.5 : 0.35) : 0.06;
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;

      for (const n of sim) {
        const on = !active || active.has(n.id);
        ctx!.globalAlpha = on ? 1 : 0.2;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        if (n.hub) { ctx!.fillStyle = col.navy; ctx!.fill(); ctx!.lineWidth = 3 / view.k; ctx!.strokeStyle = col.surface; ctx!.stroke(); }
        else if (n.worked) { ctx!.fillStyle = col.navy400; ctx!.fill(); }
        else { ctx!.fillStyle = col.surface; ctx!.fill(); ctx!.lineWidth = 1.5 / view.k; ctx!.strokeStyle = col.navy400; ctx!.stroke(); }
        if (hover === n) { ctx!.lineWidth = 2 / view.k; ctx!.strokeStyle = col.navy; ctx!.stroke(); }
      }

      // Labels: hub, hovered + neighbours, and the most trusted, so it never clutters.
      ctx!.globalAlpha = 1; ctx!.textAlign = "center"; ctx!.textBaseline = "top";
      const topTrust = [...sim].filter((n) => !n.hub).sort((a, b) => b.trust - a.trust).slice(0, 8).map((n) => n.id);
      for (const n of sim) {
        const show = n.hub || hover === n || (active?.has(n.id)) || (!hover && topTrust.includes(n.id));
        if (!show) continue;
        ctx!.font = `${(n.hub ? 12 : 10.5) / view.k}px Inter, system-ui, sans-serif`;
        ctx!.fillStyle = n.hub || hover === n ? col.ink : col.muted;
        ctx!.fillText(n.name, n.x, n.y + n.r + 3 / view.k);
      }
      ctx!.restore();
    }

    function frame() {
      if (alpha > 0.004 || drag) { if (!reduce) tick(); else { for (let i = 0; i < 300; i++) tick(); alpha = 0; } }
      draw();
      if (alpha > 0.004 || drag) raf = requestAnimationFrame(frame); else raf = 0;
    }
    function kick(a = 0.5) { alpha = Math.max(alpha, a); if (!raf) raf = requestAnimationFrame(frame); }

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
      if (drag) { drag.fx = p.x; drag.fy = p.y; dragMoved = true; kick(0.3); setTip(null); return; }
      if (panning) { view.x += ev.clientX - last.x; view.y += ev.clientY - last.y; last = { x: ev.clientX, y: ev.clientY }; draw(); return; }
      const hit = pick(p.x, p.y);
      if (hit !== hover) { hover = hit; canvas!.style.cursor = hit ? "pointer" : "grab"; draw(); }
      if (hit) { const s = toScreen(hit); setTip({ x: s.x, y: s.y - hit.r - 6, node: hit }); } else setTip(null);
    };
    const onDown = (ev: PointerEvent) => {
      canvas!.setPointerCapture(ev.pointerId);
      const p = worldPos(ev); const hit = pick(p.x, p.y);
      if (hit && !hit.hub) { drag = hit; dragMoved = false; hit.fx = hit.x; hit.fy = hit.y; }
      else { panning = true; last = { x: ev.clientX, y: ev.clientY }; canvas!.style.cursor = "grabbing"; }
    };
    const onUp = (ev: PointerEvent) => {
      if (drag) { const d = drag; if (!d.hub) { d.fx = undefined; d.fy = undefined; } if (!dragMoved) router.push(`/network/${d.id}`); drag = null; }
      panning = false; canvas!.style.cursor = hover ? "pointer" : "grab";
      try { canvas!.releasePointerCapture(ev.pointerId); } catch {}
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const p = worldPos(ev); const k = Math.min(3, Math.max(0.3, view.k * (ev.deltaY < 0 ? 1.1 : 0.9)));
      view.x = p.sx - p.x * k; view.y = p.sy - p.y * k; view.k = k; draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    kick(1);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [nodes, links, router]);

  return (
    <div ref={wrapRef} className="relative w-full h-[calc(100vh-180px)] min-h-[460px] rounded-[16px] border border-line bg-surface overflow-hidden">
      <canvas ref={canvasRef} className="block" />
      {tip ? (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[10px] border border-line bg-surface px-2.5 py-1.5 shadow-[var(--shadow-card)]" style={{ left: tip.x, top: tip.y }}>
          <div className="text-[12.5px] font-semibold text-ink whitespace-nowrap">{tip.node.name}</div>
          {tip.node.headline ? <div className="text-[11px] text-ink-muted max-w-[220px] truncate">{tip.node.headline}</div> : null}
          <div className="text-[10.5px] text-ink-faint mt-0.5">Trust {Math.round(tip.node.trust)}{tip.node.worked ? " · worked together" : ""}</div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute left-3 bottom-3 flex items-center gap-3 text-[11px] text-ink-faint bg-surface/80 rounded-full border border-line px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-navy-400" /> worked together</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-navy-400 bg-surface" /> introduced</span>
        <span>· size = trust · drag, scroll to zoom, click to open</span>
      </div>
    </div>
  );
}
