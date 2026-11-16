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

/** Two dots per row, your top posts (coral) vs the rest (blue), with the multiple at the end. */
export function Dumbbell({
  rows,
}: {
  rows: { key: string; label: string; winners: number; rest: number; ratio: number | null; format: "rate" | "int" | "chars"; hint: string }[];
}) {
  const fmt = (v: number, f: string) => (f === "rate" ? v.toFixed(1) : Math.round(v).toLocaleString("en-GB"));
  return (
    <div className="dumbbells">
      {rows.map((r) => {
        const max = Math.max(r.winners, r.rest) * 1.08 || 1;
        const a = (r.rest / max) * 100;
        const b = (r.winners / max) * 100;
        return (
          <div key={r.key} className="db-row" data-tip={r.hint}>
            <div className="db-label">{r.label}</div>
            <div className="db-track">
              <span className="db-link" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }} />
              <span className="db-dot rest" style={{ left: `${a}%` }} title={`The rest: ${fmt(r.rest, r.format)}`} />
              <span className="db-dot win" style={{ left: `${b}%` }} title={`Top posts: ${fmt(r.winners, r.format)}`} />
            </div>
            <div className="db-val">
              <b>{fmt(r.winners, r.format)}</b> <span className="faint">vs {fmt(r.rest, r.format)}</span>
            </div>
            <div className={`db-ratio ${r.ratio != null && r.ratio >= 1 ? "up" : "down"}`}>{r.ratio != null ? `${r.ratio.toFixed(1)}×` : "–"}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Above / below your typical post, centred on zero. Each bar carries its signed label. */
export function Diverging({ rows }: { rows: { key: string; label: string; pct: number; value: number; typical: number }[] }) {
  const cap = Math.max(50, ...rows.map((r) => Math.min(300, Math.abs(r.pct))));
  return (
    <div className="div-bars">
      {rows.map((r) => {
        const w = (Math.min(Math.abs(r.pct), cap) / cap) * 50;
        const up = r.pct >= 0;
        const fmt = (v: number) => (v % 1 ? v.toFixed(1) : Math.round(v).toLocaleString("en-GB"));
        return (
          <div key={r.key} className="div-row" data-tip={`This post ${fmt(r.value)} vs your typical ${fmt(r.typical)}`}>
            <div className="name">{r.label}</div>
            <div className="div-track">
              <span className="mid" />
              <span className={`div-bar ${up ? "up" : "down"}`} style={up ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
            </div>
            <div className={`val ${up ? "up" : "down"}`}>{up ? "+" : "−"}{Math.abs(r.pct)}%</div>
          </div>
        );
      })}
    </div>
  );
}
