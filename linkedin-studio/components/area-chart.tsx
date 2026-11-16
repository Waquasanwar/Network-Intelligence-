"use client";

import { useId, useMemo, useRef, useState } from "react";

export interface Point {
  x: string; // YYYY-MM-DD
  y: number | null;
}

const compact = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}K` : v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}K` : String(Math.round(v)));
/** Smallest 1/2/5 step that covers the data in at most four intervals, so every tick is a round number. */
function niceScale(v: number) {
  if (v <= 0) return { max: 1, step: 1 };
  const p = 10 ** Math.floor(Math.log10(v / 4));
  for (const m of [1, 2, 5, 10, 20]) {
    const step = m * p;
    if (Math.ceil(v / step) <= 4) return { max: Math.ceil(v / step) * step, step };
  }
  return { max: v, step: v };
}
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * One series over time. Hover (or touch) shows a crosshair and the exact value.
 * `tone="stage"` draws it in mint for the navy hero.
 */
export function AreaChart({
  points,
  height = 200,
  label,
  unit = "",
  tone = "default",
}: {
  points: Point[];
  height?: number;
  label: string;
  unit?: string;
  tone?: "default" | "stage";
}) {
  const pts = useMemo(() => points.filter((p): p is { x: string; y: number } => p.y != null), [points]);
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");

  if (pts.length < 2) return <div className="empty small">Not enough data for a chart yet.</div>;

  const W = 720;
  const pad = { l: 38, r: 10, t: 12, b: 24 };
  const { max, step } = niceScale(Math.max(...pts.map((p) => p.y)));
  const sx = (i: number) => pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  // Smooth with a monotone-ish curve: midpoints as control points.
  let d = `M${sx(0)},${sy(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) {
    const x0 = sx(i - 1), x1 = sx(i), y0 = sy(pts[i - 1].y), y1 = sy(pts[i].y);
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L${sx(pts.length - 1)},${sy(0)} L${sx(0)},${sy(0)} Z`;
  const stroke = tone === "stage" ? "var(--mint)" : "var(--series)";
  const grid = tone === "stage" ? "var(--stage-line)" : "var(--line)";
  const surface = tone === "stage" ? "var(--stage)" : "var(--panel)";
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const xTicks = [0, Math.round((pts.length - 1) / 2), pts.length - 1];

  function onMove(clientX: number) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((x - pad.l) / (W - pad.l - pad.r)) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  }

  const h = hover != null ? pts[hover] : null;
  return (
    <div className="chart-wrap">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        role="img"
        aria-label={`${label}: ${pts.length} days, peak ${Math.max(...pts.map((p) => p.y)).toLocaleString("en-GB")}`}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
        style={{ display: "block", touchAction: "pan-y" }}
      >
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={tone === "stage" ? 0.28 : 0.16} />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke={grid} strokeWidth="1" />
            <text x={pad.l - 8} y={sy(t) + 4} textAnchor="end">{compact(t)}</text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text key={i} x={sx(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}>
            {dayLabel(pts[i].x)}
          </text>
        ))}
        <path d={area} fill={`url(#g${gid})`} />
        <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="draw" style={{ ["--len" as string]: 3000 }} />
        {h && hover != null ? (
          <g>
            <line x1={sx(hover)} x2={sx(hover)} y1={pad.t} y2={sy(0)} stroke={tone === "stage" ? "rgba(255,255,255,.35)" : "var(--line-strong)"} strokeWidth="1" />
            <circle cx={sx(hover)} cy={sy(h.y)} r="5" fill={stroke} stroke={surface} strokeWidth="2" />
          </g>
        ) : (
          <circle cx={sx(pts.length - 1)} cy={sy(pts[pts.length - 1].y)} r="4.5" fill={stroke} stroke={surface} strokeWidth="2" />
        )}
      </svg>
      {h && hover != null ? (
        <div className="chart-tip" style={{ left: `${(sx(hover) / W) * 100}%`, top: -6 }}>
          <span className="faint">{dayLabel(h.x)}</span>
          <strong>
            {h.y.toLocaleString("en-GB")} {unit}
          </strong>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr><th>Day</th><th>{unit || "Value"}</th></tr>
        </thead>
        <tbody>
          {pts.map((p) => (
            <tr key={p.x}><td>{p.x}</td><td>{p.y}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
