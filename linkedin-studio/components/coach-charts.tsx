"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const nf = (v: number, dp = 0) => v.toLocaleString("en-GB", { maximumFractionDigits: dp, minimumFractionDigits: 0 });
type Fmt = "compact" | "pct" | "int";
const format = (f: Fmt, v: number) => (f === "pct" ? `${nf(v, 1)}%` : f === "int" ? String(Math.round(v)) : compact(v));
const compact = (v: number) => (Math.abs(v) >= 1000 ? `${nf(v / 1000, v >= 10000 ? 0 : 1)}K` : nf(v, v < 10 && v % 1 ? 1 : 0));

function niceScale(v: number) {
  if (v <= 0) return { max: 1, step: 1 };
  const p = 10 ** Math.floor(Math.log10(v / 4));
  for (const m of [1, 2, 2.5, 5, 10, 20]) {
    const step = m * p;
    if (Math.ceil(v / step) <= 4) return { max: Math.ceil(v / step) * step, step };
  }
  return { max: v, step: v / 4 };
}

export function Legend({ items }: { items: { label: string; color: string; kind?: "dot" | "line" | "bar" }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label}>
          <i className={i.kind ?? "dot"} style={{ background: i.color }} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ── scatter ─────────────────────────────────────────────────────────

export interface ScatterPoint {
  id: string;
  x: number;
  y: number;
  label: string;
  detail: string;
  href?: string;
  highlight?: boolean;
}

export function Scatter({
  points,
  xLabel,
  yLabel,
  xFmt = "compact",
  yFmt = "compact",
  quadrants,
  fitLine = false,
  yMax,
  height = 280,
  width = 640,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xFmt?: Fmt;
  yFmt?: Fmt;
  quadrants?: [string, string, string, string]; // top-left, top-right, bottom-left, bottom-right
  fitLine?: boolean;
  yMax?: number;
  height?: number;
  width?: number;
}) {
  const router = useRouter();
  const [hover, setHover] = useState<ScatterPoint | null>(null);
  if (points.length < 2) return <div className="empty small">Needs a few posts with numbers.</div>;
  const W = width;
  const pad = { l: 46, r: 14, t: 24, b: 40 };
  const xs = niceScale(Math.max(...points.map((p) => p.x)));
  const ys = yMax ? { max: yMax, step: yMax / 4 } : niceScale(Math.max(...points.map((p) => p.y)));
  const sx = (v: number) => pad.l + (v / xs.max) * (W - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - v / ys.max) * (height - pad.t - pad.b);
  const med = (vals: number[]) => {
    const s = [...vals].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const mx = med(points.map((p) => p.x));
  const my = med(points.map((p) => p.y));
  let fit: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (fitLine && points.length >= 3) {
    const ax = points.reduce((a, p) => a + p.x, 0) / points.length;
    const ay = points.reduce((a, p) => a + p.y, 0) / points.length;
    const num = points.reduce((a, p) => a + (p.x - ax) * (p.y - ay), 0);
    const den = points.reduce((a, p) => a + (p.x - ax) ** 2, 0);
    if (den) {
      const b = num / den;
      const a = ay - b * ax;
      const clampY = (v: number) => Math.max(0, Math.min(ys.max, v));
      const x0 = Math.min(...points.map((p) => p.x));
      const x1 = Math.max(...points.map((p) => p.x));
      fit = { x1: sx(x0), y1: sy(clampY(a + b * x0)), x2: sx(x1), y2: sy(clampY(a + b * x1)) };
    }
  }
  const xt = Array.from({ length: Math.round(xs.max / xs.step) + 1 }, (_, i) => i * xs.step);
  const yt = Array.from({ length: Math.round(ys.max / ys.step) + 1 }, (_, i) => i * ys.step);
  const ordered = [...points].sort((a, b) => Number(!!a.highlight) - Number(!!b.highlight));
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={`${yLabel} against ${xLabel} for ${points.length} posts`} style={{ display: "block" }} onMouseLeave={() => setHover(null)}>
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={pad.l - 8} y={sy(t) + 4} textAnchor="end">{format(yFmt, t)}</text>
          </g>
        ))}
        {xt.map((t) => (
          <text key={`x${t}`} x={sx(t)} y={height - pad.b + 16} textAnchor="middle">{format(xFmt, t)}</text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={height - 4} textAnchor="middle" style={{ fontWeight: 600 }}>{xLabel} →</text>
        <text x={pad.l} y={12} textAnchor="start" style={{ fontWeight: 600 }}>↑ {yLabel}</text>
        {quadrants ? (
          <>
            <line x1={sx(mx)} x2={sx(mx)} y1={pad.t} y2={height - pad.b} stroke="var(--line-strong)" strokeDasharray="0" strokeWidth="1" opacity=".7" />
            <line x1={pad.l} x2={W - pad.r} y1={sy(my)} y2={sy(my)} stroke="var(--line-strong)" strokeWidth="1" opacity=".7" />
            <text x={pad.l + 6} y={pad.t + 14} className="q">{quadrants[0]}</text>
            <text x={W - pad.r - 6} y={pad.t + 14} textAnchor="end" className="q">{quadrants[1]}</text>
            <text x={pad.l + 6} y={height - pad.b - 8} className="q">{quadrants[2]}</text>
            <text x={W - pad.r - 6} y={height - pad.b - 8} textAnchor="end" className="q">{quadrants[3]}</text>
          </>
        ) : null}
        {fit ? <line {...fit} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" opacity=".55" /> : null}
        {ordered.map((p) => (
          <g key={p.id} style={{ cursor: p.href ? "pointer" : "default" }} onMouseEnter={() => setHover(p)} onClick={() => p.href && router.push(p.href)}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={hover?.id === p.id ? 7 : 5.5} fill={p.highlight ? "var(--coral-mark)" : "var(--series)"} stroke="var(--panel)" strokeWidth="2" style={{ transition: "r 120ms ease" }} />
            <circle cx={sx(p.x)} cy={sy(p.y)} r="13" fill="transparent" />
          </g>
        ))}
      </svg>
      {hover ? (
        <div className="chart-tip" style={{ left: `${(sx(hover.x) / W) * 100}%`, top: `calc(${(sy(hover.y) / height) * 100}% - 64px)` }}>
          <strong style={{ fontSize: 13, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{hover.label}</strong>
          <span className="faint">{hover.detail}</span>
        </div>
      ) : null}
    </div>
  );
}

// ── score columns + rolling average ─────────────────────────────────

export interface TrendBar {
  id: string;
  title: string;
  day: string;
  score: number;
  rolling: number;
  winner: boolean;
}

export function TrendColumns({ bars, height = 240 }: { bars: TrendBar[]; height?: number }) {
  const router = useRouter();
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (bars.length < 2) return <div className="empty small">Needs two or more scored posts.</div>;
  const W = 640;
  const pad = { l: 34, r: 8, t: 12, b: 26 };
  const band = (W - pad.l - pad.r) / bars.length;
  const bw = Math.min(24, band - 2);
  const cx = (i: number) => pad.l + band * i + band / 2;
  const sy = (v: number) => pad.t + (1 - v / 100) * (height - pad.t - pad.b);
  const line = bars.map((b, i) => `${i ? "L" : "M"}${cx(i)},${sy(b.rolling)}`).join(" ");
  const h = hover != null ? bars[hover] : null;
  return (
    <div className="chart-wrap">
      <svg ref={ref} viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={`Score of each post in order, with a rolling average`} style={{ display: "block" }} onMouseLeave={() => setHover(null)}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={pad.l - 8} y={sy(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const y = sy(b.score);
          const x = cx(i) - bw / 2;
          const hgt = sy(0) - y;
          const r = Math.min(4, hgt);
          return (
            <g key={b.id} onMouseEnter={() => setHover(i)} onClick={() => router.push(`/posts/${b.id}`)} style={{ cursor: "pointer" }}>
              <rect x={pad.l + band * i} y={pad.t} width={band} height={height - pad.t - pad.b} fill={hover === i ? "var(--panel-hover)" : "transparent"} />
              <path
                d={`M${x},${sy(0)} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${sy(0)} Z`}
                fill={b.winner ? "var(--coral-mark)" : "var(--series)"}
                opacity={hover == null || hover === i ? 1 : 0.55}
              />
            </g>
          );
        })}
        <path d={line} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />
        <circle cx={cx(bars.length - 1)} cy={sy(bars[bars.length - 1].rolling)} r="4.5" fill="var(--ink)" stroke="var(--panel)" strokeWidth="2" pointerEvents="none" />
        <text x={cx(0)} y={height - 6} textAnchor="start">{bars[0].day.slice(5)}</text>
        <text x={cx(bars.length - 1)} y={height - 6} textAnchor="end">{bars[bars.length - 1].day.slice(5)}</text>
      </svg>
      {h && hover != null ? (
        <div className="chart-tip" style={{ left: `${(cx(hover) / W) * 100}%`, top: -10 }}>
          <span className="faint">{h.day}</span>
          <strong style={{ fontSize: 13, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>{h.title}</strong>
          <span>Score <b>{h.score}</b> · 3-post average <b>{h.rolling}</b></span>
        </div>
      ) : null}
    </div>
  );
}
