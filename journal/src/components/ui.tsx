import type { ReactNode } from "react";
import type { EntryType } from "@/lib/schema";

// One crisp colour per type, shown as a small dot on a neutral chip so screens stay calm.
export const TYPE_HEX: Record<EntryType, string> = {
  Note: "#6b7480",
  Decision: "#b2449c",
  Request: "#e8573a",
  "Purchase Request": "#3a9d4a",
  "Service Request": "#0f9a86",
  "Comment / Feedback": "#2196c9",
  Idea: "#e5b30f",
  Meeting: "#8a6d52",
  "Blocker / Risk": "#d63a3a",
  Win: "#c27c0e",
  Question: "#5458dc",
  Learning: "#7b52e8",
};

export function TypeDot({ type, className = "size-1.5" }: { type?: EntryType; className?: string }) {
  const color = TYPE_HEX[type ?? "Note"];
  return <span aria-hidden className={`inline-block shrink-0 rounded-[2px] ${className}`} style={{ background: color }} />;
}

export function TypeBadge({ type, short }: { type?: EntryType; short?: boolean }) {
  const t = type ?? "Note";
  const c = TYPE_HEX[t];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[calc(var(--radius)*0.6)] px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
    >
      <TypeDot type={t} />
      {short ? t.split(" ")[0] : t}
    </span>
  );
}

export function Chip({ children, tone = "plain", title }: { children: ReactNode; tone?: "plain" | "accent" | "danger" | "ok" | "warn" | "guess"; title?: string }) {
  const tones = {
    plain: "bg-surface-2/80 text-ink-2",
    accent: "bg-surface-2 text-accent-fg",
    danger: "bg-surface-2 text-danger font-medium",
    ok: "bg-surface-2 text-ok",
    warn: "bg-surface-2 text-warn",
    guess: "guess text-ink-2",
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
        <h1 className="page-title text-[1.95rem] text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card px-4 py-8 text-center text-sm text-ink-3">{children}</div>;
}

export function Stat({ label, value, tone, hue }: { label: string; value: ReactNode; tone?: "danger" | "accent"; hue?: string }) {
  const h = hue ?? (tone === "danger" ? "var(--danger)" : tone === "accent" ? "var(--accent-text)" : "var(--ink)");
  return (
    <div className="card kpi lift px-4 py-3.5" style={{ ["--hue" as string]: h }}>
      <div className="kpi-value num text-[1.75rem] leading-none font-medium">{value}</div>
      <div className="label mt-2">{label}</div>
    </div>
  );
}
