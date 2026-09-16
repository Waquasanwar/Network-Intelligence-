import { Badge } from "@/components/ui/badge";
import { AVAILABILITY_LABELS, AVAILABILITY_TONE, DECISION_LABELS, DECISION_TONE, OPPORTUNITY_STATUS_LABELS, ROUTE_LABELS, INTRO_STATUS_LABELS } from "@/lib/labels";
import { assessFreshness } from "@/lib/availability";
import type { AvailabilityStatus, EngagementRoute, HumanDecision, IntroductionStatus, OpportunityStatus } from "@prisma/client";

export function AvailabilityBadge({ status, confirmedAt, nextCheckDate }: { status: AvailabilityStatus; confirmedAt?: Date | null; nextCheckDate?: Date | null }) {
  const freshness = assessFreshness({ availabilityStatus: status, availabilityConfirmedAt: confirmedAt ?? null, nextCheckDate: nextCheckDate ?? null });
  const tone = freshness === "stale" || freshness === "unknown" ? "amber" : AVAILABILITY_TONE[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={tone}>{AVAILABILITY_LABELS[status]}</Badge>
      {freshness === "stale" && status !== "NEEDS_REFRESH" ? <span className="text-[10px] text-amber">stale</span> : null}
      {freshness === "aging" ? <span className="text-[10px] text-ink-faint">aging</span> : null}
    </span>
  );
}

export function RouteBadge({ route }: { route: EngagementRoute }) {
  return <Badge tone="navy">{ROUTE_LABELS[route]}</Badge>;
}

export function StageBadge({ status }: { status: OpportunityStatus }) {
  const tone = status === "CLOSED_WON" || status === "ENGAGED" ? "teal" : status === "CLOSED_LOST" ? "neutral" : status === "ON_HOLD" ? "amber" : "navy";
  return <Badge tone={tone}>{OPPORTUNITY_STATUS_LABELS[status]}</Badge>;
}

export function DecisionBadge({ decision }: { decision: HumanDecision }) {
  return <Badge tone={DECISION_TONE[decision]}>{DECISION_LABELS[decision]}</Badge>;
}

export function IntroBadge({ status }: { status: IntroductionStatus }) {
  const tone = ["INTRODUCED", "ENGAGED", "APPROVED"].includes(status) ? "teal" : ["DECLINED", "WITHDRAWN"].includes(status) ? "neutral" : status === "REQUESTED" ? "amber" : "navy";
  return <Badge tone={tone}>{INTRO_STATUS_LABELS[status]}</Badge>;
}
