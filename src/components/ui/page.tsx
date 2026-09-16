import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        {eyebrow ? <div className="text-[11px] uppercase tracking-wide text-ink-faint mb-1">{eyebrow}</div> : null}
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="text-[13px] text-ink-muted mt-1 max-w-2xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <div className="text-[13px] font-medium text-ink">{title}</div>
      {description ? <div className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">{description}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Tabs({ items, current, base }: { items: { key: string; label: string; count?: number }[]; current: string; base: string }) {
  return (
    <div className="flex items-center gap-1 border-b border-line mb-4 overflow-x-auto">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.key === items[0].key ? base : `${base}?tab=${t.key}`}
          className={cn(
            "px-3 py-2 text-[13px] border-b-2 -mb-px whitespace-nowrap transition-colors",
            current === t.key ? "border-navy text-ink font-medium" : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {t.label}
          {typeof t.count === "number" ? <span className="ml-1.5 text-[11px] text-ink-faint tabular">{t.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}

export function Section({ title, description, children, action, className }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mb-6", className)}>
      <div className="flex items-end justify-between mb-2">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
          {description ? <p className="text-xs text-ink-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Score({ value, label }: { value: number; label?: string }) {
  const tone = value >= 70 ? "bg-teal" : value >= 45 ? "bg-navy" : "bg-amber";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-1.5 flex-1 rounded-full bg-surface-muted overflow-hidden">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
      <span className="text-xs tabular text-ink-muted w-7 text-right">{value}</span>
      {label ? <span className="text-[11px] text-ink-faint">{label}</span> : null}
    </div>
  );
}
