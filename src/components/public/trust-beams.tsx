import { BrandMark } from "@/components/ui/brand-mark";
import { cn } from "@/lib/utils";

/**
 * The front door's picture of the business: three consultants, each with the proofs they hold,
 * their light running through Amana to a client's need. Everything goes through the middle; no
 * name crosses until the person says yes. Invented examples only: no real person is on it.
 *
 * Beams adapted from 21st.dev / Magic UI "Animated Beam" (MIT) and drawn in one fixed-ratio SVG,
 * so nothing has to be measured and it renders on the server.
 */
const PEOPLE = [
  { code: "NI-7Q2K", role: "Programme director", where: "Core banking · Dubai", held: 5, note: "Free in 3 weeks", y: 21 },
  { code: "NI-4MD8", role: "Interim CFO", where: "Energy · London", held: 6, note: "Available now", y: 50 },
  { code: "NI-R31X", role: "Transformation lead", where: "Payments · Riyadh", held: 4, note: "Open to SOW", y: 79 },
];
// viewBox 1000 × 520; card edges and the core sit on these points.
const PATHS = [
  "M276,109 C390,109 380,260 452,260",
  "M276,260 C360,260 380,260 452,260",
  "M276,411 C390,411 380,260 452,260",
];

function Pips({ held }: { held: number }) {
  return (
    <span className="inline-flex items-center gap-[3px]" role="img" aria-label={`${held} of 6 proofs held`}>
      {Array.from({ length: 6 }, (_, i) => <i key={i} className={cn("h-[10px] w-[5px] rounded-full", i < held ? "bg-teal" : "bg-line-strong")} />)}
    </span>
  );
}

export function TrustBeams() {
  return (
    <div className="spot widget relative overflow-hidden rounded-[22px] p-0" aria-label="How an introduction travels: consultants, through Amana, to a client's need">
      <span className="beam is-slow" aria-hidden="true" />
      {/* window chrome, so it reads as the product rather than an illustration */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <i className="h-2.5 w-2.5 rounded-full bg-line-strong" /><i className="h-2.5 w-2.5 rounded-full bg-line-strong" /><i className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 mono text-[11.5px] text-ink-faint">amana · requirements · finance transformation lead</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted"><span className="live-dot !h-1.5 !w-1.5" />Matching</span>
      </div>

      <div className="relative flex flex-col gap-3 p-4 md:block md:aspect-[1000/520] md:p-0">
        <svg viewBox="0 0 1000 520" className="absolute inset-0 hidden h-full w-full md:block" aria-hidden="true">
          <defs>
            <linearGradient id="tb-in" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#7ee3bc" stopOpacity="0" /><stop offset="0.4" stopColor="#7ee3bc" /><stop offset="1" stopColor="#8b94ff" /></linearGradient>
            <linearGradient id="tb-out" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#8b94ff" /><stop offset="1" stopColor="#ff8a78" /></linearGradient>
            <radialGradient id="tb-halo"><stop offset="0" stopColor="#7ee3bc" stopOpacity="0.28" /><stop offset="1" stopColor="#7ee3bc" stopOpacity="0" /></radialGradient>
          </defs>
          <circle cx="500" cy="260" r="150" fill="url(#tb-halo)" />
          <circle cx="500" cy="260" r="92" fill="none" stroke="var(--color-line)" strokeDasharray="2 6" />
          {PATHS.map((d, i) => (
            <g key={d}>
              <path d={d} className="trace" />
              <path d={d} pathLength={566} className="trace-pulse" stroke="url(#tb-in)" style={{ ["--t" as string]: `${i * 0.9}s`, ["--d" as string]: "3.6s" }} />
            </g>
          ))}
          <path d="M548,260 L708,260" className="trace" />
          <path d="M548,260 L708,260" pathLength={566} className="trace-pulse" stroke="url(#tb-out)" style={{ ["--t" as string]: "1.6s", ["--d" as string]: "3.6s" }} />
        </svg>

        {PEOPLE.map((p) => (
          <div key={p.code} className="relative rounded-[14px] border border-line bg-surface/90 p-3.5 backdrop-blur md:absolute md:left-[15%] md:top-[var(--y)] md:w-[25.2%] md:-translate-x-1/2 md:-translate-y-1/2 lg:p-4" style={{ ["--y" as string]: `${p.y}%` }}>
            <div className="flex items-center justify-between gap-2"><code className="mono text-[11px] text-ink-faint">{p.code}</code><Pips held={p.held} /></div>
            <div className="mt-1.5 text-[13.5px] font-semibold leading-tight lg:text-[14.5px]">{p.role}</div>
            <div className="mt-0.5 text-[12px] text-ink-muted">{p.where}</div>
            <div className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-teal"><span className="h-1.5 w-1.5 rounded-full bg-teal" />{p.note}</div>
          </div>
        ))}

        <div className="hidden md:absolute md:left-1/2 md:top-1/2 md:block md:-translate-x-1/2 md:-translate-y-1/2" aria-hidden="true">
          <span className="orbit-beat grid h-[84px] w-[84px] place-items-center rounded-full lg:h-[96px] lg:w-[96px]"><BrandMark className="h-6 w-auto text-[#0c1b33]" /></span>
          <span className="absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-surface/80 px-3 py-1 text-[11px] text-ink-muted backdrop-blur">Known · Screened · Vouched</span>
        </div>

        <div className="relative rounded-[16px] border border-line-strong bg-surface p-4 shadow-[var(--shadow-pop)] md:absolute md:left-[85%] md:top-1/2 md:w-[27%] md:-translate-x-1/2 md:-translate-y-1/2 lg:p-5">
          <div className="label-caps text-coral-ink">New need</div>
          <div className="mt-2 text-[15px] font-semibold leading-snug lg:text-[16.5px]">Finance transformation lead</div>
          <div className="mt-1 text-[12.5px] text-ink-muted">Dubai · six months · three days a week</div>
          <div className="mt-3 flex flex-wrap gap-1.5">{["Contract", "SOW"].map((t) => <span key={t} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">{t}</span>)}</div>
          <div className="mt-3 border-t border-line pt-3 text-[12px] leading-[1.45] text-ink-muted"><b className="text-ink">3 matched.</b> Names stay private until each person says yes.</div>
        </div>
      </div>
    </div>
  );
}
