import type { ReactNode } from "react";
import { TYPE_STYLE, type EntryType } from "@/lib/schema";

// Full class strings so Tailwind can see them. Dusty, coordinated tones that sit with any accent.
const TYPE_CLASS: Record<EntryType, string> = {
  Note: "bg-[#6f6470]/12 text-[#6f6470] dark:bg-[#c9bcc6]/14 dark:text-[#c9bcc6]",
  Decision: "bg-[#7a4a8c]/12 text-[#7a4a8c] dark:bg-[#d2a8e0]/14 dark:text-[#d2a8e0]",
  Request: "bg-[#a8582a]/12 text-[#a8582a] dark:bg-[#f0b088]/14 dark:text-[#f0b088]",
  "Comment / Feedback": "bg-[#4f6f99]/12 text-[#4f6f99] dark:bg-[#a9c2e6]/14 dark:text-[#a9c2e6]",
  Idea: "bg-[#8a6716]/12 text-[#8a6716] dark:bg-[#e8c878]/14 dark:text-[#e8c878]",
  Meeting: "bg-[#7d6a5c]/12 text-[#7d6a5c] dark:bg-[#cdb9aa]/14 dark:text-[#cdb9aa]",
  "Blocker / Risk": "bg-[#b4233c]/12 text-[#b4233c] dark:bg-[#ff8a9b]/14 dark:text-[#ff8a9b]",
  Win: "bg-[#3f7d5c]/12 text-[#3f7d5c] dark:bg-[#8fd1ac]/14 dark:text-[#8fd1ac]",
  Question: "bg-[#4f55a5]/12 text-[#4f55a5] dark:bg-[#aab0f0]/14 dark:text-[#aab0f0]",
  Learning: "bg-[#3f7676]/12 text-[#3f7676] dark:bg-[#93cfcf]/14 dark:text-[#93cfcf]",
};

export const TYPE_HEX: Record<EntryType, string> = {
  Note: "#6f6470",
  Decision: "#7a4a8c",
  Request: "#a8582a",
  "Comment / Feedback": "#4f6f99",
  Idea: "#8a6716",
  Meeting: "#7d6a5c",
  "Blocker / Risk": "#b4233c",
  Win: "#3f7d5c",
  Question: "#4f55a5",
  Learning: "#3f7676",
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
        <h1 className="text-2xl leading-tight font-semibold">{title}</h1>
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
