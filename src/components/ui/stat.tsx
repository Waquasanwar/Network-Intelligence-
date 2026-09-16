import Link from "next/link";
import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: "teal" | "amber" | "neutral" }) {
  const body = (
    <div className={cn("rounded-lg border border-line bg-surface px-4 py-3 h-full", href && "hover:border-line-strong transition-colors")}>
      <div className="text-[11px] font-medium text-ink-muted uppercase tracking-wide">{label}</div>
      <div className={cn("text-2xl font-semibold tabular mt-1 leading-7", tone === "teal" && "text-teal", tone === "amber" && "text-amber")}>{value}</div>
      {hint ? <div className="text-[11px] text-ink-faint mt-1">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
