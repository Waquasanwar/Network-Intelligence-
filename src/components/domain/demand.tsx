import { Badge, Chip } from "@/components/ui/badge";
import { cn, formatMoney } from "@/lib/utils";
import { ROUTE_LABELS, SENIORITY_LABELS } from "@/lib/labels";
import { FEE_MODEL_LABELS, SHORTLIST_LABELS, BRIEF_STATUS_LABELS, FEE_STATUS_LABELS, fmt, rateBand, type Brief, type HardCheck, type FeeEstimate, type ShortlistDecision, type BriefStatus, type FeeStatus, type AccountKind, type FeeModel } from "@/lib/demand";
import { Check, X, HelpCircle } from "lucide-react";

export const KIND_LABEL: Record<AccountKind, string> = { CLIENT: "Client", AGENCY: "Agency", EXPERT_NETWORK: "Expert network" };
const KIND_TONE: Record<AccountKind, "navy" | "amber" | "teal"> = { CLIENT: "navy", AGENCY: "amber", EXPERT_NETWORK: "teal" };
const TIER_LABEL: Record<string, string> = { meets: "Meets every hard requirement", conversation: "Worth a conversation", stretch: "Stretch" };
const TIER_TONE: Record<string, "teal" | "amber" | "neutral"> = { meets: "teal", conversation: "amber", stretch: "neutral" };

export function KindBadge({ kind }: { kind: AccountKind }) { return <Badge tone={KIND_TONE[kind]} filled>{KIND_LABEL[kind]}</Badge>; }
export function TierBadge({ tier }: { tier: string }) { return <Badge tone={TIER_TONE[tier] ?? "neutral"} filled>{TIER_LABEL[tier] ?? tier}</Badge>; }
export function BriefStatusBadge({ status }: { status: BriefStatus }) { return <Badge tone={status === "FILLED" ? "teal" : status === "CLOSED" ? "neutral" : "navy"}>{BRIEF_STATUS_LABELS[status]}</Badge>; }
export function ShortlistBadge({ decision }: { decision: ShortlistDecision }) { return <Badge tone={decision === "PLACED" || decision === "INTRODUCED" ? "teal" : decision === "CLIENT_PASSED" || decision === "NOT_FOR_THIS" ? "neutral" : decision === "CANDIDATE" ? "neutral" : "navy"}>{SHORTLIST_LABELS[decision]}</Badge>; }
export function FeeStatusBadge({ status }: { status: FeeStatus }) { return <Badge tone={status === "PAID" ? "teal" : status === "FORECAST" ? "neutral" : status === "WRITTEN_OFF" ? "risk" : "navy"} filled>{FEE_STATUS_LABELS[status]}</Badge>; }

export function routeLabel(r: string | null) { return r ? ROUTE_LABELS[r as keyof typeof ROUTE_LABELS] ?? r : "Route to confirm"; }

export function budgetLabel(b: Brief["budget"]) {
  if (!b) return null;
  const unit = b.kind === "DAY_RATE" ? "/day" : b.kind === "HOURLY" ? "/hour" : b.kind === "SALARY" ? " salary" : " project";
  return `${formatMoney(b.amount, b.currency)}${b.max ? `–${formatMoney(b.max, b.currency)}` : ""}${unit}`;
}

/** The structured reading of a brief as a row of chips. */
export function BriefChips({ b, className }: { b: Brief; className?: string }) {
  const chips = [
    ...(b.roles.length ? b.roles : ["role to confirm"]),
    `${b.headcount} ${b.headcount === 1 ? "person" : "people"}`,
    routeLabel(b.engagementRoute),
    ...(b.locations.length ? [`${b.mustBeLocal ? "already in " : ""}${b.locations.join(" / ")}`] : []),
    ...(b.workRights ? [b.workRights] : []),
    ...(b.seniority ? [SENIORITY_LABELS[b.seniority]] : []),
    ...b.sectors,
    ...(b.budget ? [budgetLabel(b.budget)!] : []),
    ...(b.durationMonths ? [`${b.durationMonths} months`] : []),
    ...(b.startBy ? [`start ${b.startBy}`] : []),
  ];
  return <div className={cn("flex flex-wrap gap-1", className)}>{chips.map((c, i) => <span key={i} className="inline-flex items-center rounded-full bg-navy-100 text-navy px-2.5 py-0.5 text-[11.5px] font-medium">{c}</span>)}</div>;
}

/** "How the co-pilot read it": chips, assumptions, and what it could not infer. */
export function ReadCard({ b, title = "How the co-pilot read it" }: { b: Brief; title?: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface p-4">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint mb-2">{title}</div>
      <BriefChips b={b} />
      {b.assumptions.length ? <ul className="mt-3 pl-4 list-disc text-[12.5px] text-ink-muted space-y-0.5">{b.assumptions.map((a) => <li key={a}>{a}</li>)}</ul> : null}
      {b.questions.length ? <div className="mt-3 rounded-[12px] bg-amber-100 border border-amber/30 px-3 py-2.5 text-[12.5px]"><div className="text-[10.5px] uppercase tracking-wide font-medium text-amber mb-1">Still to confirm</div><ul className="pl-4 list-disc space-y-0.5">{b.questions.map((q) => <li key={q}>{q}</li>)}</ul></div> : null}
    </div>
  );
}

/** Hard requirement checks: met, unmet or unknown. Labelled, never used to hide anyone. */
export function CheckList({ checks }: { checks: HardCheck[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
      {checks.map((c) => (
        <li key={c.label} title={c.note} className={cn("inline-flex items-center gap-1.5 text-[12.5px] font-medium cursor-help", c.state === "met" ? "text-teal" : c.state === "unmet" ? "text-risk" : "text-amber")}>
          <span className={cn("inline-grid place-items-center h-4 w-4 rounded-full", c.state === "met" ? "bg-teal-100" : c.state === "unmet" ? "bg-risk-100" : "bg-amber-100")}>
            {c.state === "met" ? <Check className="h-2.5 w-2.5" /> : c.state === "unmet" ? <X className="h-2.5 w-2.5" /> : <HelpCircle className="h-2.5 w-2.5" />}
          </span>
          {c.label}
        </li>
      ))}
    </ul>
  );
}

export function FeeBox({ est, model, pct, label = "Estimated fee to us", extra }: { est: FeeEstimate; model?: FeeModel; pct?: number | null; label?: string; extra?: React.ReactNode }) {
  return (
    <div className={cn("rounded-[16px] border px-4 py-3.5", est.confident ? "border-teal/30 bg-[linear-gradient(135deg,rgba(20,184,166,0.14),rgba(79,111,214,0.10))]" : "border-line bg-surface-muted")}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</div>
      <div className={cn("text-[28px] font-semibold tabular tracking-[-0.03em] leading-9 mt-0.5", est.confident ? "text-teal" : "text-ink-faint")}>{est.confident ? fmt(est.ourTake, est.currency) : "—"}</div>
      {model ? <div className="text-[12px] text-ink-muted">{FEE_MODEL_LABELS[model]}{pct ? ` · ${pct}%` : ""}</div> : null}
      <div className="text-[12px] text-ink-muted">{est.basis}</div>
      {est.confident ? <div className="text-[11.5px] text-ink-faint">Paying party spends {fmt(est.gross, est.currency)}</div> : null}
      {extra}
    </div>
  );
}

/** The anonymised card a client or agency sees. Never a name before introduction. */
export function AnonCard({ refCode, headline, region, availabilityBand, evidenceSummary, rights, rateStated, tier, decision, clientNote, revealedName, actions }: { refCode: string; headline: string; region: string | null; availabilityBand: string; evidenceSummary: string; rights?: HardCheck; rateStated?: string | null; tier: string; decision: ShortlistDecision; clientNote?: string | null; revealedName?: string | null; actions?: React.ReactNode }) {
  const band = rateBand(rateStated);
  return (
    <li className="py-3 border-b border-line last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0"><code className="text-[11px] bg-surface-muted rounded px-1.5 py-0.5">{refCode}</code><span className="text-[13px] font-medium text-ink truncate">{revealedName ?? headline}</span></div>
        <ShortlistBadge decision={decision} />
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        <Chip>{region ?? "region undisclosed"}</Chip><Chip>availability: {availabilityBand}</Chip>
        {rights ? <Chip>work rights: {rights.state === "met" ? "confirmed" : rights.state === "unmet" ? "sponsorship needed" : "to confirm"}</Chip> : null}
        {band ? <Chip>{band}</Chip> : null}
        <Chip>{tier === "meets" ? "meets the brief" : tier === "conversation" ? "one point to confirm" : "stretch"}</Chip>
      </div>
      <div className="text-[12px] text-ink-muted mt-1.5">{evidenceSummary}</div>
      {clientNote ? <div className="text-[12px] text-ink-muted mt-0.5">Note from us: {clientNote}</div> : null}
      {actions ? <div className="flex flex-wrap gap-2 mt-2">{actions}</div> : null}
    </li>
  );
}
