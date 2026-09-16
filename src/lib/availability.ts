import type { AvailabilityStatus } from "@prisma/client";

/**
 * Availability model (spec §7). A status is only as good as its last confirmation.
 * Nothing here decides whether someone is "good"; it only says whether we should re-check.
 */

export const DEFAULT_STALE_DAYS = 45;

export function staleDays(): number {
  const raw = process.env.AVAILABILITY_STALE_DAYS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STALE_DAYS;
}

export type FreshnessInput = {
  availabilityStatus: AvailabilityStatus;
  availabilityConfirmedAt: Date | null;
  availabilityDate?: Date | null;
  nextCheckDate?: Date | null;
};

export type Freshness = "fresh" | "aging" | "stale" | "unknown";

export function assessFreshness(input: FreshnessInput, now = new Date(), thresholdDays = staleDays()): Freshness {
  if (input.availabilityStatus === "NEEDS_REFRESH") return "stale";
  if (!input.availabilityConfirmedAt) return "unknown";
  const ageDays = (now.getTime() - input.availabilityConfirmedAt.getTime()) / 86_400_000;
  if (input.nextCheckDate && input.nextCheckDate.getTime() < now.getTime()) return "stale";
  if (ageDays > thresholdDays) return "stale";
  if (ageDays > thresholdDays * 0.66) return "aging";
  return "fresh";
}

export function isFresh(input: FreshnessInput, now = new Date()): boolean {
  return assessFreshness(input, now) === "fresh";
}

/** Suggested next check date given a status — active statuses are re-checked sooner. */
export function suggestNextCheck(status: AvailabilityStatus, from = new Date()): Date {
  const days: Partial<Record<AvailabilityStatus, number>> = {
    AVAILABLE_NOW: 14,
    FINISHING_ENGAGEMENT_SOON: 21,
    OPEN_TO_CONVERSATIONS: 30,
    QUIETLY_EXPLORING: 30,
    FRACTIONAL_AVAILABILITY: 30,
    SOW_ONLY: 45,
    HAPPY_WHERE_I_AM: 90,
    NOT_LOOKING_KEEP_IN_TOUCH: 120,
    TAKING_A_BREAK: 90,
  };
  const d = new Date(from);
  d.setDate(d.getDate() + (days[status] ?? 45));
  return d;
}

/** Statuses that imply the person may realistically take on new work in the near term. */
export const ACTIVE_STATUSES: AvailabilityStatus[] = [
  "AVAILABLE_NOW",
  "OPEN_TO_CONVERSATIONS",
  "QUIETLY_EXPLORING",
  "RIGHT_OPPORTUNITY_ONLY",
  "FINISHING_ENGAGEMENT_SOON",
  "FRACTIONAL_AVAILABILITY",
  "SOW_ONLY",
  "PERMANENT_ONLY",
  "CONTRACT_ONLY",
];
