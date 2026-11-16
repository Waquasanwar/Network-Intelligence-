import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 mb-6">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow text-ink-faint mb-2.5">{eyebrow}</div> : null}
        <h1 className="font-display text-[26px] sm:text-[32px] text-ink leading-[1.1]">{title}</h1>
        {description ? <p className="text-[14.5px] text-ink-muted mt-2 max-w-2xl leading-[1.55]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:flex-none">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-dashed border-line-strong px-6 py-10 text-center bg-surface-muted/60">
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      {description ? <div className="text-[12.5px] text-ink-muted mt-1 max-w-sm mx-auto leading-5">{description}</div> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Tabs({ items, current, base }: { items: { key: string; label: string; count?: number }[]; current: string; base: string }) {
  return (
    <div className="mb-5 max-w-full overflow-x-auto border-b border-line"><div className="flex items-center gap-5">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.key === items[0].key ? base : `${base}?tab=${t.key}`}
          className={cn(
            "h-10 inline-flex items-center text-[13.5px] whitespace-nowrap transition-colors duration-200 border-b-2 -mb-px",
            current === t.key ? "border-ink text-ink font-semibold" : "border-transparent text-ink-muted font-medium hover:text-ink",
          )}
        >
          {t.label}
          {typeof t.count === "number" ? <span className={cn("ml-1.5 text-[11px] tabular rounded-full px-1.5 py-px font-semibold", current === t.key ? "bg-navy text-white dark:text-canvas" : "bg-surface-muted text-ink-faint")}>{t.count}</span> : null}
        </Link>
      ))}
    </div></div>
  );
}

export function Section({ title, description, children, action, className }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mb-6", className)}>
      <div className="flex items-end justify-between mb-2.5 gap-4">
        <div>
          <h2 className="font-display is-small text-[16px] text-ink">{title}</h2>
          {description ? <p className="text-[12px] text-ink-muted mt-0.5 leading-4 max-w-2xl">{description}</p> : null}
        </div>
        {action ? <div className="flex-none">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Score({ value, label }: { value: number; label?: string }) {
  const tone = value >= 70 ? "bg-navy" : value >= 45 ? "bg-navy-400" : "bg-amber";
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
