/** Server-rendered small charts: sparkline and score ring. */

export function Sparkline({ values, width = 96, height = 28, color = "var(--mint)" }: { values: (number | null)[]; width?: number; height?: number; color?: string }) {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return <svg width={width} height={height} aria-hidden />;
  const max = Math.max(...v) || 1;
  const min = Math.min(...v);
  const span = max - min || 1;
  const pts = v.map((y, i) => `${((i / (v.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 3 - ((y - min) / span) * (height - 6)).toFixed(1)}`);
  const last = pts[pts.length - 1].split(",");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}

export function ScoreRing({ score, size = 96 }: { score: number | null; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0)) / 100;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`Performance score ${score ?? "unknown"} out of 100`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--coral-mark)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <div className="ring-label">
        <div>
          <b>{score ?? "–"}</b>
          <span>score</span>
        </div>
      </div>
    </div>
  );
}
