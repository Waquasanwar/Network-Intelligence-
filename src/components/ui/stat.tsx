import Link from "next/link";
import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: "teal" | "amber" | "neutral" }) {
  const body = (
    <div className={cn("rounded-[16px] border border-line bg-surface shadow-[var(--shadow-card)] px-4 py-3.5 h-full relative overflow-hidden", href && "lift")}>
      <div className="text-[12px] font-medium text-ink-muted whitespace-nowrap truncate">{label}</div>
      <div className={cn("text-[24px] font-semibold tabular mt-1 leading-8 tracking-[-0.03em] whitespace-nowrap", tone === "teal" && "text-teal", tone === "amber" && "text-amber")}>{value}</div>
      {hint ? <div className="text-[11.5px] text-ink-faint mt-0.5 truncate">{hint}</div> : null}
      {tone && tone !== "neutral" ? <span className={cn("absolute right-0 top-0 h-full w-24 opacity-[0.07] pointer-events-none", tone === "teal" ? "bg-[radial-gradient(circle_at_100%_0%,#14b8a6,transparent_70%)]" : "bg-[radial-gradient(circle_at_100%_0%,#f59e0b,transparent_70%)]")} /> : null}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
