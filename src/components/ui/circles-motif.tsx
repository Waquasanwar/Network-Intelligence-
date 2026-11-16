/**
 * The circles of trust as a quiet drawing for the navy panels: three rings, a few people on them,
 * and you at the centre. The same picture the network map draws from real data.
 */
const DOTS: [ring: number, angle: number, strong?: boolean][] = [
  [0, -40, true], [0, 95], [0, 200, true],
  [1, -75], [1, 10, true], [1, 60], [1, 150], [1, 235],
  [2, -110], [2, -20], [2, 35], [2, 120, true], [2, 185], [2, 265],
];
const R = [58, 108, 158];

export function CirclesMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 340" className={className} aria-hidden="true">
      {[2, 1, 0].map((i) => <circle key={i} cx="170" cy="170" r={R[i]} fill={i === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)"} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />)}
      {DOTS.map(([ring, deg, strong], i) => {
        const a = (deg * Math.PI) / 180, x = 170 + R[ring] * Math.cos(a), y = 170 + R[ring] * Math.sin(a);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={strong ? 7 : 5.5} fill="#0c1b33" stroke={strong ? "#7ee3bc" : "rgba(255,255,255,0.55)"} strokeWidth="1.5" />
            {strong ? <circle cx={x} cy={y} r="2.6" fill="#7ee3bc" /> : null}
          </g>
        );
      })}
      <circle cx="170" cy="170" r="15" fill="#ffffff" />
      <circle cx="170" cy="170" r="5" fill="#0c1b33" />
    </svg>
  );
}
