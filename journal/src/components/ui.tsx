import type { ReactNode } from "react";
import { TYPE_STYLE, type EntryType } from "@/lib/schema";

// Full class strings so Tailwind can see them.
const TYPE_CLASS: Record<EntryType, string> = {
  Note: "bg-slate-500/12 text-slate-700 dark:text-slate-300",
  Decision: "bg-violet-500/14 text-violet-700 dark:text-violet-300",
  Request: "bg-orange-500/14 text-orange-700 dark:text-orange-300",
  "Comment / Feedback": "bg-sky-500/14 text-sky-700 dark:text-sky-300",
  Idea: "bg-amber-500/16 text-amber-800 dark:text-amber-300",
  Meeting: "bg-stone-500/14 text-stone-700 dark:text-stone-300",
  "Blocker / Risk": "bg-rose-500/14 text-rose-700 dark:text-rose-300",
  Win: "bg-emerald-500/14 text-emerald-700 dark:text-emerald-300",
  Question: "bg-pink-500/14 text-pink-700 dark:text-pink-300",
  Learning: "bg-teal-500/14 text-teal-700 dark:text-teal-300",
};

export const TYPE_HEX: Record<EntryType, string> = {
  Note: "#868e96",
  Decision: "#7950f2",
  Request: "#f76707",
  "Comment / Feedback": "#1c7ed6",
  Idea: "#f59f00",
  Meeting: "#8d6e63",
  "Blocker / Risk": "#e03131",
  Win: "#2f9e44",
  Question: "#d6336c",
  Learning: "#0c8599",
};

export function TypeBadge({ type, short }: { type?: EntryType; short?: boolean }) {
  const t = type ?? "Note";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${TYPE_CLASS[t]}`}>
      <span aria-hidden>{TYPE_STYLE[t].emoji}</span>
      {short ? t.split(" ")[0] : t}
    </span>
  );
}

export function Chip({ children, tone = "plain", title }: { children: ReactNode; tone?: "plain" | "accent" | "danger" | "ok" | "warn"; title?: string }) {
  const tones = {
    plain: "bg-surface-2 text-ink-2",
    accent: "bg-accent-soft text-accent-fg",
    danger: "bg-danger/12 text-danger",
    ok: "bg-ok/12 text-ok",
    warn: "bg-warn/12 text-warn",
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card px-4 py-8 text-center text-sm text-ink-3">{children}</div>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "danger" | "accent" }) {
  return (
    <div className="card px-3.5 py-3">
      <div className={`text-2xl font-semibold tabular-nums ${tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent-fg" : ""}`}>{value}</div>
      <div className="mt-0.5 text-xs text-ink-3">{label}</div>
    </div>
  );
}
