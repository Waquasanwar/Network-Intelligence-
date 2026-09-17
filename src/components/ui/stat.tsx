import Link from "next/link";
import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: string; href?: string; tone?: "teal" | "amber" | "neutral" }) {
  const body = (
    <div className={cn("rounded-lg border border-line bg-surface px-3.5 py-3 h-full relative overflow-hidden", href && "hover:border-line-strong transition-colors")}>
      {tone && tone !== "neutral" ? <span className={cn("absolute left-0 top-3 bottom-3 w-[2px] rounded-full", tone === "teal" ? "bg-teal" : "bg-amber")} /> : null}
      <div className="text-[11.5px] font-medium text-ink-muted">{label}</div>
      <div className={cn("text-[22px] font-semibold tabular mt-0.5 leading-7 tracking-[-0.02em]", tone === "teal" && "text-teal", tone === "amber" && "text-amber")}>{value}</div>
      {hint ? <div className="text-[11px] text-ink-faint mt-0.5 truncate">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
