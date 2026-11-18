import { assessFreshness } from "@/lib/availability";
import { standard, type Audience, type Standard, type StandardInput } from "@/lib/standard";
import type { AvailabilityStatus } from "@prisma/client";

/**
 * The least a loaded person needs for the six proofs. Deliberately loose, so the same function
 * serves a full profile, a row in a list and the stripped-down record behind a client's card.
 * Names are read only when the query included them, and `standard()` drops them for outsiders.
 */
export type StandardPerson = {
  availabilityStatus: string;
  availabilityConfirmedAt?: Date | null;
  nextCheckDate?: Date | null;
  screeningStatus?: string | null;
  screenedAt?: Date | null;
  relationships?: {
    sourceType?: unknown; introducedById?: unknown; workedTogether?: unknown; wouldWorkTogetherAgain?: unknown;
    introducedBy?: unknown; networkOwner?: unknown; [k: string]: unknown;
  }[];
  vouches?: { wouldRecommend?: unknown; voucherKind?: unknown; [k: string]: unknown }[];
  evidence?: { evidenceType?: unknown; context?: unknown; [k: string]: unknown }[];
  conversations?: unknown[];
};

/** Ways of reaching us that go through a person. Everything else counts as arriving directly. */
const THROUGH_A_PERSON = new Set(["PERSONAL_NETWORK", "INTRODUCTION", "WORKED_TOGETHER", "CLIENT", "PARTNER_REFERRAL"]);

/** What someone said about their own work in a screening is useful, and is not a witness. */
const selfReported = (e: { context?: unknown }) => typeof e.context === "string" && e.context.startsWith("Screening:");
/** A screening the platform accepted on completeness alone: approved, with no person as the approver. */
const autoAccepted = (c: unknown) => !!c && typeof c === "object" && (c as { type?: unknown }).type === "SCREENING" && (c as { approvalStatus?: unknown }).approvalStatus === "APPROVED" && (c as { approvedById?: unknown }).approvedById === null;

const nameOf = (v: unknown): string | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as { name?: unknown; firstName?: unknown; lastName?: unknown };
  if (typeof o.name === "string" && o.name) return o.name;
  if (typeof o.firstName === "string" && o.firstName) return [o.firstName, typeof o.lastName === "string" ? o.lastName : ""].join(" ").trim();
  return null;
};

export function standardInput(p: StandardPerson, now = new Date()): StandardInput {
  const rels = p.relationships ?? [];
  const introduced = rels.find((r) => !!r.introducedById || !!r.introducedBy);
  const contact = rels.find((r) => typeof r.sourceType === "string" && THROUGH_A_PERSON.has(r.sourceType));
  const worked = rels.filter((r) => r.workedTogether === true);
  const freshness = assessFreshness({ availabilityStatus: p.availabilityStatus as AvailabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt ?? null, nextCheckDate: p.nextCheckDate ?? null }, now);
  return {
    knownVia: introduced ? { how: "introduced", by: nameOf(introduced.introducedBy) } : contact ? { how: "contact", by: nameOf(contact.networkOwner) } : null,
    screened: p.screeningStatus === "APPROVED" || !!p.screenedAt,
    conversations: (p.conversations ?? []).filter((c) => !!c && typeof c === "object" && (c as { approvalStatus?: unknown }).approvalStatus === "APPROVED").length,
    screeningRead: !(p.conversations ?? []).some(autoAccepted),
    vouches: (p.vouches ?? []).filter((v) => v.wouldRecommend === true && v.voucherKind !== "EXTERNAL").length,
    references: (p.vouches ?? []).filter((v) => v.wouldRecommend === true && v.voucherKind === "EXTERNAL").length,
    worked: worked.length,
    workedBy: worked.map((r) => nameOf(r.networkOwner)).filter((x): x is string => !!x),
    wouldWorkAgain: worked.some((r) => r.wouldWorkTogetherAgain === true),
    evidence: (p.evidence ?? []).filter((e) => e.evidenceType !== "CAUTION" && !selfReported(e)).length,
    freshness,
    confirmedDaysAgo: p.availabilityConfirmedAt ? Math.max(0, Math.floor((now.getTime() - p.availabilityConfirmedAt.getTime()) / 86_400_000)) : null,
  };
}

export function standardFor(p: StandardPerson, audience: Audience = "internal", now = new Date()): Standard {
  return standard(standardInput(p, now), audience);
}
