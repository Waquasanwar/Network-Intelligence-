import Link from "next/link";
import { cn } from "@/lib/utils";

const SERIES = ["var(--color-series-1)", "var(--color-series-2)", "var(--color-series-3)"];

/**
 * One whole split into a few parts: a tall segmented bar with each share printed on its block
 * and a legend that names the parts and gives the counts. Used instead of a donut — the parts
 * sit on one line, so they can be compared at a glance.
 */
export function SegmentedBar({ parts, unit = "people" }: { parts: { label: string; value: number; hint?: string }[]; unit?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const shown = parts.map((p, i) => ({ ...p, color: SERIES[i % SERIES.length], share: total ? Math.round((p.value / total) * 100) : 0 }));
  return (
    <div>
      <div className="flex h-7 w-full gap-[2px]" role="img" aria-label={shown.map((p) => `${p.label}: ${p.value} ${unit}, ${p.share}%`).join("; ")}>
        {total === 0 ? <div className="h-full w-full rounded-[4px] bg-series-track" /> : shown.filter((p) => p.value > 0).map((p) => (
          <div key={p.label} title={`${p.label}: ${p.value} ${unit} (${p.share}%)`} className="h-full min-w-[6px] rounded-[4px] flex items-center overflow-hidden" style={{ width: `${(p.value / total) * 100}%`, background: p.color }}>
            {p.share >= 12 ? <span className="pl-2 text-[11.5px] font-semibold text-white">{p.share}%</span> : null}
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        {shown.map((p) => (
          <li key={p.label} className="flex items-start gap-2.5">
            <span className="mt-[5px] h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: p.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ink leading-tight">{p.label}</span>
              {p.hint ? <span className="block text-[12px] text-ink-faint leading-snug mt-0.5">{p.hint}</span> : null}
            </span>
            <span className="text-[13px] font-semibold text-ink">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars in one hue: a name, a thin bar from a shared baseline, and the value at its tip. */
export function BarList({ rows, empty = "Nothing to show yet.", className }: { rows: { label: string; value: number; href?: string }[]; empty?: string; className?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-[12.5px] text-ink-muted">{empty}</p>;
  return (
    <ul className={cn("space-y-3", className)}>
      {rows.map((r) => {
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] text-ink group-hover:underline decoration-line-strong underline-offset-4">{r.label}</span>
              <span className="flex-none text-[13px] font-semibold text-ink">{r.value}</span>
            </span>
            <span className="mt-1.5 block h-2 w-full rounded-r-[4px] bg-series-track" aria-hidden="true">
              <span className="block h-full rounded-r-[4px] bg-series-1" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            </span>
          </>
        );
        return <li key={r.label} title={`${r.label}: ${r.value}`}>{r.href ? <Link href={r.href} className="group block">{body}</Link> : <div className="group">{body}</div>}</li>;
      })}
    </ul>
  );
}
