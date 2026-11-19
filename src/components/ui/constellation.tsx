"use client";
import { useEffect, useRef } from "react";

type Node = { x: number; y: number; r: number; kind: 0 | 1 | 2; phase: number; amp: number; flash: number };
type Pulse = { a: number; b: number; t: number; speed: number };

const COLOURS = { white: [222, 232, 252], mint: [126, 227, 188], gold: [242, 196, 109], coral: [255, 102, 80], line: [150, 176, 228] };
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/**
 * The brand, drawn live: people as points of light, the threads between people who know each other,
 * and introductions travelling along those threads (coral), lighting the person they reach (mint).
 * Canvas only, sized to its parent, paused when off screen or in a background tab, and a still
 * picture for anyone who prefers reduced motion. Purely decorative, so hidden from assistive tech.
 */
export function Constellation({ className = "", density = 1, focus = 0.62 }: { className?: string; density?: number; focus?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, nodes: Node[] = [], edges: [number, number][] = [], pulses: Pulse[] = [];
    let raf = 0, visible = true, last = performance.now(), spawn = 0;

    // A small seeded random, so the picture is the same on every visit.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

    function build() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, rect.width); h = Math.max(1, rect.height); dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed = 7;
      const count = Math.round(Math.min(150, Math.max(26, (w * h) / 9000)) * density);
      nodes = Array.from({ length: count }, () => {
        // Denser towards the focus point, so the network has a heart rather than an even spray.
        const near = rand() < 0.55;
        const x = near ? w * focus + (rand() - 0.5) * w * 0.55 : rand() * w;
        const y = near ? h * 0.5 + (rand() - 0.5) * h * 0.7 : rand() * h;
        const roll = rand();
        return { x, y, r: roll > 0.93 ? 2.8 : roll > 0.7 ? 1.9 : 1.2, kind: roll > 0.95 ? 2 : roll > 0.72 ? 1 : 0, phase: rand() * Math.PI * 2, amp: 2 + rand() * 5, flash: 0 } as Node;
      });
      edges = [];
      const seen = new Set<string>();
      nodes.forEach((n, i) => {
        const near = nodes.map((m, j) => ({ j, d: (m.x - n.x) ** 2 + (m.y - n.y) ** 2 })).filter((o) => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 2);
        for (const o of near) {
          if (o.d > (Math.min(w, h) * 0.32) ** 2) continue;
          const k = i < o.j ? `${i}-${o.j}` : `${o.j}-${i}`;
          if (!seen.has(k)) { seen.add(k); edges.push([i, o.j]); }
        }
      });
      pulses = [];
    }

    const pos = (n: Node, t: number) => (calm ? [n.x, n.y] : [n.x + Math.sin(t / 2600 + n.phase) * n.amp, n.y + Math.cos(t / 3100 + n.phase) * n.amp * 0.7]);

    function frame(t: number) {
      const dt = Math.min(64, t - last); last = t;
      ctx!.clearRect(0, 0, w, h);
      const P = nodes.map((n) => pos(n, t));
      // Threads.
      ctx!.lineWidth = 1;
      for (const [a, b] of edges) {
        ctx!.strokeStyle = rgba(COLOURS.line, 0.13);
        ctx!.beginPath(); ctx!.moveTo(P[a][0], P[a][1]); ctx!.lineTo(P[b][0], P[b][1]); ctx!.stroke();
      }
      // Introductions in flight.
      if (!calm) {
        spawn -= dt;
        if (spawn <= 0 && edges.length) {
          const [a, b] = edges[Math.floor(Math.random() * edges.length)];
          pulses.push(Math.random() < 0.5 ? { a, b, t: 0, speed: 0.00055 + Math.random() * 0.0004 } : { a: b, b: a, t: 0, speed: 0.00055 + Math.random() * 0.0004 });
          spawn = 520 + Math.random() * 700;
        }
        pulses = pulses.filter((p) => {
          p.t += p.speed * dt;
          if (p.t >= 1) { nodes[p.b].flash = 1; return false; }
          const [ax, ay] = P[p.a], [bx, by] = P[p.b];
          const x = ax + (bx - ax) * p.t, y = ay + (by - ay) * p.t;
          const tx = ax + (bx - ax) * Math.max(0, p.t - 0.22), ty = ay + (by - ay) * Math.max(0, p.t - 0.22);
          const g = ctx!.createLinearGradient(tx, ty, x, y);
          g.addColorStop(0, rgba(COLOURS.coral, 0)); g.addColorStop(1, rgba(COLOURS.coral, 0.85));
          ctx!.strokeStyle = g; ctx!.lineWidth = 1.6;
          ctx!.beginPath(); ctx!.moveTo(tx, ty); ctx!.lineTo(x, y); ctx!.stroke();
          ctx!.fillStyle = rgba(COLOURS.coral, 1);
          ctx!.beginPath(); ctx!.arc(x, y, 1.8, 0, Math.PI * 2); ctx!.fill();
          return true;
        });
      }
      // People.
      nodes.forEach((n, i) => {
        const [x, y] = P[i];
        const c = n.kind === 1 ? COLOURS.mint : n.kind === 2 ? COLOURS.gold : COLOURS.white;
        if (n.r > 2) { ctx!.fillStyle = rgba(c, 0.12); ctx!.beginPath(); ctx!.arc(x, y, n.r * 3.2, 0, Math.PI * 2); ctx!.fill(); }
        ctx!.fillStyle = rgba(c, n.kind === 0 ? 0.7 : 0.95);
        ctx!.beginPath(); ctx!.arc(x, y, n.r, 0, Math.PI * 2); ctx!.fill();
        if (n.flash > 0) {
          ctx!.strokeStyle = rgba(COLOURS.mint, n.flash * 0.8); ctx!.lineWidth = 1.4;
          ctx!.beginPath(); ctx!.arc(x, y, n.r + (1 - n.flash) * 14, 0, Math.PI * 2); ctx!.stroke();
          n.flash = Math.max(0, n.flash - dt / 900);
        }
      });
      if (!calm && visible) raf = requestAnimationFrame(frame);
    }

    const start = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); };
    build(); start();
    const ro = new ResizeObserver(() => { build(); if (calm) frame(performance.now()); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; if (visible && !calm) start(); });
    io.observe(canvas);
    const onVis = () => { visible = !document.hidden; if (visible && !calm) start(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [density, focus]);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
