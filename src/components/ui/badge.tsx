import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/labels";

const toneClass: Record<Tone, string> = {
  teal: "bg-teal-100 text-teal border-teal/20",
  amber: "bg-amber-100 text-amber border-amber/20",
  neutral: "bg-surface-muted text-ink-muted border-line",
  navy: "bg-navy-100 text-navy border-navy/15",
  risk: "bg-risk-100 text-risk border-risk/20",
};

export function Badge({ tone = "neutral", className, children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", toneClass[tone], className)} {...props}>
      {children}
    </span>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-muted border border-line", className)}>{children}</span>;
}
