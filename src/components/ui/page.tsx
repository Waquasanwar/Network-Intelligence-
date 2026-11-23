import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import { Constellation } from "@/components/ui/constellation";

/**
 * Every page opens on the same ink stage as home: the title, Amana's one suggestion for this page,
 * and the figures that matter, in one band instead of three stacked boxes. Still, never animated.
 * Anything passed as children (a NextStep, a StatStrip) sits inside the band.
 */
export function PageHeader({ title, description, actions, children }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="page-stage stage-ink mb-6" data-page-stage>
      <Constellation focus={0.82} density={0.55} />
      <span className="page-stage-veil" aria-hidden="true" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="page-stage-title">{title}</h1>
          {description ? <p className="page-stage-lede">{description}</p> : null}
        </div>
        {actions ? <div className="page-stage-actions flex flex-wrap items-center gap-2 sm:flex-none">{actions}</div> : null}
      </div>
      {children ? <div className="page-stage-body">{children}</div> : null}
    </section>
  );
}

export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-[22px] bg-surface-muted px-6 py-9 text-center">
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface text-ink-muted ring-1 ring-line"><Icon className="h-[18px] w-[18px]" /></span>
      <div className="text-[14px] font-semibold text-ink mt-3">{title}</div>
      {description ? <div className="text-[13px] text-ink-muted mt-1 max-w-sm mx-auto leading-[1.5]">{description}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * A short list of facts about a record. Rows with nothing recorded are left out and counted in one
 * quiet line, so a thin record reads as a short record instead of a column of dashes.
 */
export function Facts({ rows, className }: { rows: { label: string; value: React.ReactNode | null | undefined | false | "" }[]; className?: string }) {
  const filled = rows.filter((r) => r.value !== null && r.value !== undefined && r.value !== false && r.value !== "");
  const missing = rows.filter((r) => !filled.includes(r));
  return (
    <div className={className}>
      {filled.length ? (
        <dl className="divide-y divide-line">
          {filled.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
              <dt className="flex-none text-[13px] text-ink-muted">{r.label}</dt>
              <dd className="min-w-0 text-right text-[13px] font-medium text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {missing.length ? <p className={cn("text-[12.5px] text-ink-faint leading-[1.5]", filled.length && "mt-3")}>Not recorded yet: {missing.map((m) => m.label.toLowerCase()).join(", ")}.</p> : null}
    </div>
  );
}

export function Tabs({ items, current, base }: { items: { key: string; label: string; count?: number }[]; current: string; base: string }) {
  return (
    <div className="mb-5 max-w-full overflow-x-auto"><div className="inline-flex items-center gap-1 rounded-full bg-surface p-1 shadow-[var(--shadow-card)] border border-line">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.key === items[0].key ? base : `${base}?tab=${t.key}`}
          className={cn(
            "h-9 px-4 inline-flex items-center text-[13.5px] whitespace-nowrap transition-colors duration-200 rounded-full",
            current === t.key ? "bg-navy text-white font-semibold dark:text-canvas" : "text-ink-muted font-medium hover:text-ink hover:bg-surface-muted",
          )}
        >
          {t.label}
          {typeof t.count === "number" ? <span className={cn("ml-1.5 text-[12px] tabular rounded-full px-1.5 py-px font-semibold", current === t.key ? "bg-accent text-accent-ink" : "bg-surface-muted text-ink-faint")}>{t.count}</span> : null}
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
      {label ? <span className="text-[12px] text-ink-faint">{label}</span> : null}
    </div>
  );
}

/** Uppercase micro-label for field groups and dl headings. */
export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[12px] font-medium text-ink-faint mb-1", className)}>{children}</div>;
}

/** Apple-style segmented control. Links, so it works without JS. */
export function Segmented({ items, current }: { items: { key: string; label: string; href: string }[]; current: string }) {
  return (
    <div className="segmented inline-flex items-center rounded-full bg-surface-muted p-[3px] border border-line">
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
