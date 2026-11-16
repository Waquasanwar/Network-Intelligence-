import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = { title: string; detail: string; state: "done" | "current" | "todo" };

/** A real sequence, shown as one: where you are, what is finished, and what comes next. */
export function Steps({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn("grid gap-3 sm:gap-0 sm:grid-flow-col sm:auto-cols-fr", className)} aria-label="Your progress">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-3 sm:block sm:pr-5" aria-current={s.state === "current" ? "step" : undefined}>
          <div className="flex items-center sm:mb-3">
            <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-full text-[12px] font-semibold", s.state === "done" ? "bg-teal-400 text-white" : s.state === "current" ? "bg-navy text-white dark:text-canvas" : "bg-surface text-ink-faint ring-1 ring-inset ring-line-strong")}>
              {s.state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            {i < steps.length - 1 ? <span aria-hidden="true" className={cn("hidden sm:block h-[2px] flex-1 ml-3", s.state === "done" ? "bg-teal-400" : "bg-line")} /> : null}
          </div>
          <div className="min-w-0">
            <div className={cn("text-[13.5px] leading-tight", s.state === "todo" ? "text-ink-muted font-medium" : "text-ink font-semibold")}>{s.title}{s.state === "current" ? <span className="ml-2 rounded-full bg-navy-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink align-middle">You are here</span> : null}</div>
            <div className="text-[12.5px] text-ink-muted leading-[1.45] mt-1">{s.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
