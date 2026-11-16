import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Ticker } from "./ticker";

type Tone = "teal" | "amber" | "neutral";

/** Inline SVG sparkline — no chart dependency. Scales to its container width. */
function Sparkline({ data, tone, glass }: { data: number[]; tone: Tone; glass?: boolean }) {
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
  const color = glass ? "var(--color-accent-ink)" : tone === "amber" ? "var(--color-amber)" : tone === "neutral" ? "var(--color-ink-faint)" : "var(--color-ink)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-[30px] mt-3 block" style={{ color }} aria-hidden="true">
      <path d={area} fill="currentColor" opacity={glass ? 0.12 : 0.07} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
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
  variant = "card",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  series?: number[];
  /** Confirmed change over the trailing window — never a projection. */
  delta?: { value: number; suffix?: string };
  tone?: Tone;
  /** "mint" is the accent tile — one per group, for the number that leads. */
  variant?: "card" | "mint";
}) {
  const glass = variant === "mint";
  const dir = delta ? (delta.value > 0 ? "up" : delta.value < 0 ? "down" : "flat") : null;
  const DeltaIcon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const sparkTone: Tone = dir === "down" ? "amber" : tone;

  const body = (
    <div className={cn("rounded-[8px] px-6 py-5 h-full flex flex-col transition-[border-color,box-shadow,transform] duration-200", glass ? "bg-accent text-accent-ink" : "border border-line bg-surface shadow-[var(--shadow-card)]", href && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]")}>
      <div className="flex items-center justify-between gap-2">
        <div className={cn("text-[12.5px] font-semibold leading-tight", glass ? "text-accent-ink" : "text-ink-muted")}>{label}</div>
        {delta ? (
          <span
            className={cn(
              "inline-flex flex-none items-center gap-0.5 text-[11px] font-semibold rounded-full px-2 py-[3px] tabular",
              glass ? "bg-accent-ink/10 text-accent-ink" : dir === "up" ? "bg-teal-100 text-teal" : dir === "down" ? "bg-amber-100 text-amber" : "bg-surface-muted text-ink-muted",
            )}
          >
            <DeltaIcon className="h-3 w-3" strokeWidth={2.5} />
            {delta.value > 0 ? "+" : ""}
            {delta.value}
            {delta.suffix ? <span className="font-medium ml-0.5 opacity-70">{delta.suffix}</span> : null}
          </span>
        ) : null}
      </div>
      <div className="mt-auto pt-4">
        <div className={cn("font-display text-[40px] sm:text-[46px] tabular leading-[1] whitespace-nowrap", glass ? "text-accent-ink" : "text-ink")}>{typeof value === "number" ? <Ticker value={value} /> : value}</div>
        {series && series.length >= 2 ? <Sparkline data={series} tone={sparkTone} glass={glass} /> : <div className="h-[30px] mt-3" aria-hidden="true" />}
        {hint ? <div className={cn("text-[12px] mt-2 truncate", glass ? "text-accent-ink/75" : "text-ink-faint")}>{hint}</div> : null}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
