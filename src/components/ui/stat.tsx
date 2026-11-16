import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A headline figure as a widget: what it is, the number, and one line of context. Long values
 * (two currencies side by side, say) drop a size rather than break out of the tile.
 */
export function Stat({ label, value, hint, href, tone, icon: Icon }: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: "teal" | "amber" | "neutral"; icon?: React.ComponentType<{ className?: string }> }) {
  const long = typeof value === "string" && value.length > 9;
  const body = (
    <div className={cn("widget px-5 py-5 sm:px-6 h-full", href && "lift")}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12.5px] font-medium text-ink-muted leading-tight">{label}</div>
        {Icon ? <span className="chip-icon grid h-8 w-8 flex-none place-items-center rounded-full"><Icon className="h-[15px] w-[15px]" /></span> : null}
      </div>
      <div className={cn("font-display tabular leading-[1.05]", Icon ? "mt-2" : "mt-3", long ? "text-[19px] sm:text-[21px] text-ink" : "text-[30px] sm:text-[34px] whitespace-nowrap", !long && (tone === "teal" ? "text-teal" : tone === "amber" ? "text-amber" : "num-grad"))}>{value}</div>
      {hint ? <div className="text-[12px] text-ink-faint mt-2 leading-snug">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

/** A row of headline figures under a page title. */
export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5", className)}>{children}</div>;
}
