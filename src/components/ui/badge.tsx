import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/labels";

/* Dot + label status badges. Quiet by default; colour carries meaning, not decoration. */
const dotClass: Record<Tone, string> = {
  teal: "bg-teal",
  amber: "bg-amber",
  neutral: "bg-ink-faint",
  navy: "bg-navy",
  risk: "bg-risk",
};
const textClass: Record<Tone, string> = {
  teal: "text-teal",
  amber: "text-amber",
  neutral: "text-ink-muted",
  navy: "text-navy",
  risk: "text-risk",
};

export function Badge({ tone = "neutral", className, children, filled = false, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; filled?: boolean }) {
  if (filled) {
    const fill: Record<Tone, string> = {
      teal: "bg-teal-100 text-teal",
      amber: "bg-amber-100 text-amber",
      neutral: "bg-surface-muted text-ink-muted",
      navy: "bg-navy-100 text-navy",
      risk: "bg-risk-100 text-risk",
    };
    return (
      <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", fill[tone], className)} {...props}>
        {children}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium leading-4 whitespace-nowrap", textClass[tone], className)} {...props}>
      <span className={cn("h-1.5 w-1.5 rounded-full flex-none", dotClass[tone])} />
      {children}
    </span>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-[5px] bg-surface-muted px-1.5 py-[2px] text-[11.5px] text-ink-muted border border-line/80 leading-4 whitespace-nowrap", className)}>{children}</span>;
}
