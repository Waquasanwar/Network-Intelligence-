import Link from "next/link";
import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: "teal" | "amber" | "neutral" }) {
  const body = (
    <div className={cn("rounded-[22px] border border-line bg-surface shadow-[var(--shadow-card)] px-6 py-5 h-full", href && "lift")}>
      <div className="text-[12.5px] font-semibold text-ink-muted leading-tight">{label}</div>
      <div className={cn("font-display text-[30px] tabular mt-3 leading-[1] whitespace-nowrap", tone === "teal" && "text-teal", tone === "amber" && "text-amber")}>{value}</div>
      {hint ? <div className="text-[12px] text-ink-faint mt-2 truncate">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
