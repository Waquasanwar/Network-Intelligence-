"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { chaseAction } from "@/app/actions";
import { isClosed, type Entry, type Project, type Ref } from "@/lib/schema";
import { ageDays, chaseDue, isStuck, quietWorkdays } from "@/lib/planning";
import { shortDate } from "@/lib/format";
import { Chip, TypeDot } from "./ui";

export const money = (n?: number) => (n === undefined || n === null ? "" : `£${Math.round(n).toLocaleString("en-GB")}`);
export const moneyShort = (n: number) => (n >= 1e6 ? `£${(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `£${Math.round(n / 1e3)}k` : `£${Math.round(n)}`);

export function ChaseButton({ entry, compact }: { entry: Entry; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  if (isClosed(entry)) return null;
  return (
    <button
      type="button"
      disabled={pending || done}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          const res = await chaseAction(entry.id);
          if (res.ok) {
            setDone(true);
            router.refresh();
          }
        });
      }}
      className={`btn shrink-0 ${compact ? "px-2 py-1 text-xs" : ""}`}
      title="Record that you chased this today"
    >
      {done ? "Chased ✓" : pending ? "…" : "Chased"}
    </button>
  );
}

/** One open item: title, who it waits on, age, quiet days, chases, stage, amount. */
export function WorkRow({
  entry, today, projects, people, right, showProject = true,
}: { entry: Entry; today: string; projects?: Project[]; people?: Ref[]; right?: ReactNode; showProject?: boolean }) {
  const proj = showProject ? (projects ?? []).filter((p) => entry.projectIds.includes(p.id)) : [];
  const ppl = (people ?? []).filter((p) => entry.peopleIds.includes(p.id));
  const quiet = quietWorkdays(entry, today);
  const stuck = isStuck(entry, today);
  const due = chaseDue(entry, today);
  const overdue = entry.due && entry.due.slice(0, 10) < today && !isClosed(entry);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <TypeDot type={entry.type} className="size-2" />
      <div className="min-w-0 flex-1">
        <Link href={`/entry/${entry.id}`} className="line-clamp-2 text-sm leading-snug text-ink hover:text-accent-fg">
          {entry.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {entry.waitingOn && <Chip tone={stuck ? "danger" : "warn"}>Waiting: {entry.waitingOn}</Chip>}
          {entry.stage && <Chip>{entry.stage}</Chip>}
          {entry.reference && <Chip>{entry.reference}</Chip>}
          {entry.amount ? <Chip tone="accent">{money(entry.amount)}</Chip> : null}
          {entry.direction === "Upward (to management)" && <Chip>↑ management</Chip>}
          {overdue && <Chip tone="danger">overdue {shortDate(entry.due!, today)}</Chip>}
          {!overdue && entry.due && <Chip>due {shortDate(entry.due, today)}</Chip>}
          {proj.map((p) => (
            <Chip key={p.id} tone="accent">{p.name}</Chip>
          ))}
          {ppl.map((p) => (
            <Chip key={p.id}>@{p.name}</Chip>
          ))}
        </div>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <div className={`num text-sm ${stuck ? "text-danger" : due ? "text-warn" : "text-ink-2"}`}>{ageDays(entry, today)}d</div>
        <div className="num text-[0.68rem] text-ink-3">
          {quiet}d quiet{entry.chaseCount ? ` · ${entry.chaseCount}× chased` : ""}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Section({ title, sub, action, children, className = "" }: { title: string; sub?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card min-w-0 overflow-hidden ${className}`}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-display text-[1.05rem] text-ink">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-ink-3">{children}</p>;
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "danger" | "warn" | "ok" | "accent" }) {
  const c = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : tone === "accent" ? "text-accent-fg" : "text-ink";
  return (
    <div className="card px-4 py-3">
      <div className="label">{label}</div>
      <div className={`num mt-1 text-2xl ${c}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

/** Horizontal bar for in-row comparisons. */
export function Bar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "danger" | "warn" }) {
  const bg = tone === "danger" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : "var(--accent)";
  return (
    <span className="block h-1.5 w-full rounded-full bg-surface-2">
      <span className="block h-1.5 rounded-full" style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%`, background: bg }} />
    </span>
  );
}
