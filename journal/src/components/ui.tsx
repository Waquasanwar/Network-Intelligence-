import type { ReactNode } from "react";
import type { EntryType } from "@/lib/schema";

// One crisp colour per type, shown as a small dot on a neutral chip so screens stay calm.
export const TYPE_HEX: Record<EntryType, string> = {
  Note: "#8b93a1",
  Decision: "#8b7bff",
  Request: "#ff9f0a",
  "Purchase Request": "#e5b54a",
  "Service Request": "#5e9eff",
  "Comment / Feedback": "#0a84ff",
  Idea: "#ffd60a",
  Meeting: "#a2845e",
  "Blocker / Risk": "#ff453a",
  Win: "#30d158",
  Question: "#64d2ff",
  Learning: "#5ac8c8",
};

export function TypeDot({ type, className = "size-1.5" }: { type?: EntryType; className?: string }) {
  const color = TYPE_HEX[type ?? "Note"];
  return <span aria-hidden className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: color, boxShadow: `0 0 8px ${color}66` }} />;
}

export function TypeBadge({ type, short }: { type?: EntryType; short?: boolean }) {
  const t = type ?? "Note";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2/70 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-ink-2">
      <TypeDot type={t} />
      {short ? t.split(" ")[0] : t}
    </span>
  );
}

export function Chip({ children, tone = "plain", title }: { children: ReactNode; tone?: "plain" | "accent" | "danger" | "ok" | "warn"; title?: string }) {
  const tones = {
    plain: "bg-surface-2/80 text-ink-2",
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
        <h1 className="text-metal text-[1.65rem] leading-tight">{title}</h1>
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
      <div className={`num text-2xl font-medium ${tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent-fg" : ""}`}>{value}</div>
      <div className="mt-0.5 text-xs text-ink-3">{label}</div>
    </div>
  );
}
