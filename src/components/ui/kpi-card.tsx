import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

type Tone = "teal" | "amber" | "neutral";

/** Inline SVG sparkline — no chart dependency. Scales to its container width. */
function Sparkline({ data, tone }: { data: number[]; tone: Tone }) {
  if (!data || data.length < 2) return null;
  const w = 240;
  const h = 34;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const area = `${line} L${last[0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const color = tone === "amber" ? "var(--color-amber)" : tone === "neutral" ? "var(--color-ink-faint)" : "var(--color-teal)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-[30px] mt-3 block" style={{ color }} aria-hidden="true">
      <path d={area} fill="currentColor" opacity={0.08} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  href,
  series,
  delta,
  tone = "teal",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  series?: number[];
  /** Confirmed change over the trailing window — never a projection. */
  delta?: { value: number; suffix?: string };
  tone?: Tone;
}) {
  const dir = delta ? (delta.value > 0 ? "up" : delta.value < 0 ? "down" : "flat") : null;
  const DeltaIcon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const sparkTone: Tone = dir === "down" ? "amber" : tone;

  const body = (
    <div className={cn("rounded-[16px] border border-line bg-surface shadow-[var(--shadow-card)] px-5 py-[18px] h-full flex flex-col", href && "lift")}>
      <div className="text-[12px] font-medium text-ink-muted whitespace-nowrap truncate">{label}</div>
      <div className="flex items-end justify-between gap-2 mt-2">
        <div className="text-[26px] font-semibold tabular leading-9 tracking-[-0.03em] whitespace-nowrap text-ink">{value}</div>
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium rounded-full px-1.5 py-[3px] tabular",
              dir === "up" && "bg-teal/10 text-teal",
              dir === "down" && "bg-amber/10 text-amber",
              dir === "flat" && "bg-surface-muted text-ink-muted",
            )}
          >
            <DeltaIcon className="h-3 w-3" strokeWidth={2.25} />
            {delta.value > 0 ? "+" : ""}
            {delta.value}
            {delta.suffix ? <span className="text-ink-faint font-normal ml-0.5">{delta.suffix}</span> : null}
          </span>
        ) : null}
      </div>
      {series && series.length >= 2 ? <Sparkline data={series} tone={sparkTone} /> : <div className="flex-1" />}
      {hint ? <div className="text-[11.5px] text-ink-faint mt-2 truncate">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
