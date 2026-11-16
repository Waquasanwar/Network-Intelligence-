/**
 * The one component vocabulary every page uses. If a page needs a header, a card, a stat or a
 * section title, it comes from here, so spacing, type and colour stay identical everywhere.
 */
import Link from "next/link";
import { Sparkline } from "./mini-charts";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {eyebrow || meta ? (
          <div className="page-meta">
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {meta}
          </div>
        ) : null}
        <h1>{title}</h1>
        {description ? <p className="lede">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({ eyebrow, title, note }: { eyebrow: string; title: string; note?: React.ReactNode }) {
  return (
    <div className="section-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {note ? <p>{note}</p> : null}
    </div>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  className = "",
  flush = false,
  accent = false,
  takeaway,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
  accent?: boolean;
  takeaway?: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={`card ${flush ? "flush" : ""} ${accent ? "accent" : ""} ${className}`}>
      {title ? (
        <div className="card-head">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          {action ? <div className="card-action">{action}</div> : null}
        </div>
      ) : null}
      <div className="card-body">{children}</div>
      {takeaway ? <div className="takeaway">{takeaway}</div> : null}
    </section>
  );
}

export function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="card-link">
      {children} <span aria-hidden>→</span>
    </Link>
  );
}

export function Chip({ tone = "neutral", children }: { tone?: "neutral" | "up" | "down"; children: React.ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

/** Change against the previous period. `goodWhenUp` decides the colour; an arrow and the sign carry the meaning too. */
export function Delta({ pct, goodWhenUp = true, suffix = "vs prior" }: { pct: number | null; goodWhenUp?: boolean; suffix?: string }) {
  if (pct == null) return <span className="delta-pill flat">No prior period</span>;
  const up = pct >= 0;
  const good = goodWhenUp ? up : !up;
  return (
    <span className="delta-row">
      <span className={`delta-pill ${Math.abs(pct) < 1 ? "flat" : good ? "good" : "bad"}`}>
        {up ? "↑" : "↓"} {Math.abs(pct)}%
      </span>
      <span className="faint">{suffix}</span>
      <span className="sr-only">{good ? "(improving)" : "(worsening)"}</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  delta,
  sub,
  spark,
  href,
}: {
  label: string;
  value: React.ReactNode;
  delta?: { pct: number | null; goodWhenUp?: boolean };
  sub?: React.ReactNode;
  spark?: (number | null)[];
  href?: string;
}) {
  const body = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-main">
        <div style={{ minWidth: 0 }}>
          <div className="stat-value">{value}</div>
          <div className="stat-sub">{delta ? <Delta {...delta} /> : sub}</div>
        </div>
        {spark && spark.filter((v) => v != null).length > 1 ? <Sparkline values={spark} color="var(--spark)" width={84} height={32} /> : null}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="card stat lift">
      {body}
    </Link>
  ) : (
    <div className="card stat">{body}</div>
  );
}
