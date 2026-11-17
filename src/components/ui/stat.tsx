import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A headline figure: what it is, the number, and one line of context. Figures sit side by side in
 * one quiet row with hairlines between them, not a box each. Long values (two currencies side by
 * side, say) drop a size rather than break out.
 */
export function Stat({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: "teal" | "amber" | "neutral"; icon?: React.ComponentType<{ className?: string }> }) {
  const long = typeof value === "string" && value.length > 9;
  const body = (
    <>
      <span className="block text-[12.5px] font-medium text-ink-muted leading-tight">{label}</span>
      <span className={cn("mt-2 block font-display tabular leading-[1.05]", long ? "text-[19px] sm:text-[21px] text-ink" : "text-[28px] sm:text-[32px] whitespace-nowrap", !long && (tone === "teal" ? "text-teal" : tone === "amber" ? "text-amber" : "num-grad"))}>{value}</span>
      {hint ? <span className="mt-1.5 block text-[12px] text-ink-faint leading-snug">{hint}</span> : null}
    </>
  );
  return href ? <Link href={href} className="figure">{body}</Link> : <div className="figure">{body}</div>;
}

/** A row of headline figures under a page title. */
export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("figures mb-6", className)}>{children}</div>;
}
