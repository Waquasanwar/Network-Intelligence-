/**
 * Your posting rhythm drawn as a heartbeat: a flat line across the last 30 days with one beat per post.
 * Taller beat = higher performance score. A coral pulse sweeps along it on a loop.
 */
interface Beat {
  index: number;
  day: string;
  score: number | null;
  title: string;
}

export function PulseLine({ days, beats, height = 64 }: { days: number; beats: Beat[]; height?: number }) {
  const W = 720;
  const base = height * 0.62;
  const x = (i: number) => 6 + (i / Math.max(1, days - 1)) * (W - 12);
  let d = `M0,${base}`;
  const tops: { cx: number; cy: number; b: Beat }[] = [];
  for (const b of beats) {
    const cx = x(b.index);
    const amp = (0.35 + 0.65 * ((b.score ?? 40) / 100)) * (base - 4);
    // P wave, Q dip, R spike, S dip, T wave: a recognisable heartbeat.
    d += ` L${cx - 16},${base} q4,-5 8,0 L${cx - 4},${base + 3} L${cx},${base - amp} L${cx + 4},${base + 9} L${cx + 7},${base} q6,-7 12,0`;
    tops.push({ cx, cy: base - amp, b });
  }
  d += ` L${W},${base}`;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" aria-label={`Posting rhythm: ${beats.length} posts in ${days} days`} style={{ display: "block", overflow: "visible" }}>
      <path d={d} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="var(--coral-mark-stage)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity=".55" />
      <path d={d} pathLength={1000} fill="none" stroke="#ffd2cc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pulse-comet" />
      {tops.map(({ cx, cy, b }) => (
        <g key={`${b.day}-${b.title}`}>
          <circle cx={cx} cy={cy} r="4" fill="var(--coral-mark-stage)" stroke="var(--stage)" strokeWidth="2" />
          <circle cx={cx} cy={cy} r="14" fill="transparent">
            <title>{`${b.day} · ${b.title}${b.score != null ? ` · score ${b.score}` : ""}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
