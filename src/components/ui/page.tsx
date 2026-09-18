import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 mb-5">
      <div className="min-w-0">
        {eyebrow ? <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint mb-1">{eyebrow}</div> : null}
        <h1 className="text-[26px] font-semibold text-ink leading-8 tracking-[-0.025em]">{title}</h1>
        {description ? <p className="text-[13.5px] text-ink-muted mt-1 max-w-2xl leading-5">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-none">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-dashed border-line-strong px-6 py-10 text-center bg-surface/60">
      <div className="text-[13px] font-medium text-ink">{title}</div>
      {description ? <div className="text-[12.5px] text-ink-muted mt-1 max-w-sm mx-auto leading-5">{description}</div> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Tabs({ items, current, base }: { items: { key: string; label: string; count?: number }[]; current: string; base: string }) {
  return (
    <div className="flex items-center gap-0.5 border-b border-line mb-5 overflow-x-auto">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.key === items[0].key ? base : `${base}?tab=${t.key}`}
          className={cn(
            "px-3 py-2 text-[13px] border-b-2 -mb-px whitespace-nowrap transition-colors rounded-t-md",
            current === t.key ? "border-navy text-ink font-medium" : "border-transparent text-ink-muted hover:text-ink hover:bg-surface-muted/60",
          )}
        >
          {t.label}
          {typeof t.count === "number" ? <span className={cn("ml-1.5 text-[11px] tabular rounded px-1 py-px", current === t.key ? "bg-navy-100 text-navy" : "text-ink-faint")}>{t.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}

export function Section({ title, description, children, action, className }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mb-6", className)}>
      <div className="flex items-end justify-between mb-2.5 gap-4">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
          {description ? <p className="text-[12px] text-ink-muted mt-0.5 leading-4 max-w-2xl">{description}</p> : null}
        </div>
        {action ? <div className="flex-none">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Score({ value, label }: { value: number; label?: string }) {
  const tone = value >= 70 ? "bg-[linear-gradient(90deg,#0d7a6f,#14b8a6)]" : value >= 45 ? "bg-[linear-gradient(90deg,var(--color-navy-600),var(--color-navy-400))]" : "bg-[linear-gradient(90deg,#b05a00,#f59e0b)]";
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="h-1.5 flex-1 rounded-full bg-surface-muted overflow-hidden">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
      <span className="text-[12px] tabular text-ink-muted w-6 text-right">{value}</span>
      {label ? <span className="text-[11px] text-ink-faint">{label}</span> : null}
    </div>
  );
}

/** Uppercase micro-label for field groups and dl headings. */
export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint mb-1", className)}>{children}</div>;
}

/** Apple-style segmented control. Links, so it works without JS. */
export function Segmented({ items, current }: { items: { key: string; label: string; href: string }[]; current: string }) {
  return (
    <div className="inline-flex items-center rounded-full bg-surface-muted p-[3px] border border-line">
      {items.map((it) => (
        <Link key={it.key} href={it.href} className={cn("px-3 h-7 inline-flex items-center rounded-full text-[12.5px] font-medium transition-all", current === it.key ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.12),0_0_0_1px_rgba(16,24,40,0.04)]" : "text-ink-muted hover:text-ink")}>
          {it.label}
        </Link>
      ))}
    </div>
  );
}

/** Filter pill. */
export function Pill({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("px-3 h-7 inline-flex items-center rounded-full text-[12.5px] border transition-all", active ? "bg-navy text-white border-navy shadow-[var(--shadow-button)] dark:text-canvas" : "bg-surface border-line text-ink-muted hover:border-line-strong hover:text-ink")}>
      {children}
    </Link>
  );
}
