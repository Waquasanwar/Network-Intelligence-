"use client";

import { useEffect, useRef } from "react";

/**
 * Your network as a drifting constellation behind the dashboard banner: one node per (sampled)
 * connection, coral for people who engaged, linked to near neighbours. Decorative; hidden from
 * assistive tech, paused off-screen, frozen under reduced motion.
 */
export function Constellation({ nodes = 60, warm = 6 }: { nodes?: number; warm?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0, h = 0;
    const resize = () => {
      const r = c.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const n = Math.max(24, Math.min(90, nodes));
    const pts = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
      r: 1 + Math.random() * 1.6, hot: i < Math.min(warm, 12),
    }));
    let raf = 0, visible = true;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduce) { p.x += p.vx; p.y += p.vy; }
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 110) {
            ctx.strokeStyle = a.hot || b.hot ? `rgba(255,106,77,${0.22 * (1 - d / 110)})` : `rgba(169,200,232,${0.16 * (1 - d / 110)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      for (const p of pts) {
        ctx.fillStyle = p.hot ? "rgba(255,106,77,.9)" : "rgba(244,243,239,.55)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.hot ? p.r + 1 : p.r, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduce && visible) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && document.visibilityState === "visible";
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(draw);
    });
    io.observe(c);
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    draw();
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", onResize); };
  }, [nodes, warm]);
  return <canvas ref={ref} className="constellation" aria-hidden />;
}
