import type { Prisma } from "@prisma/client";
import { assessFreshness } from "@/lib/availability";
import { trustScore, type TrustScore } from "@/lib/trust";
import { fitProfile, type FitScores, type FitProfileRow } from "@/lib/fit";
import type { TrustPerson } from "@/lib/trust-include";

/**
 * Trust score for a loaded person. `audience: "self"` is what the person themselves may see: it is
 * worked out without any caution someone recorded about them, so neither a row nor a gap in the
 * arithmetic discloses that one exists. The internal score is the one decisions are made on.
 */
export function trustFor(p: TrustPerson, audience: "internal" | "self" = "internal"): TrustScore {
  const freshness = assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate });
  return trustScore({
    vouches: p.vouches.map((v) => ({ wouldRecommend: v.wouldRecommend, external: v.voucherKind === "EXTERNAL" })),
    workedWith: p.relationships.filter((r) => r.workedTogether).length, wouldWorkAgain: p.relationships.filter((r) => r.wouldWorkTogetherAgain === true).length,
    evidence: p.evidence.filter((e) => e.evidenceType !== "CAUTION").length, cautions: audience === "self" ? 0 : p.evidence.filter((e) => e.evidenceType === "CAUTION").length,
    approvedConversations: p.conversations.filter((c) => c.approvalStatus === "APPROVED").length, screened: p.screeningStatus === "APPROVED" || !!p.screenedAt, freshness,
    referralsAccepted: p.referralsMade?.filter((r) => r.status === "ACCEPTED").length ?? 0,
  });
}

export function fitFor(p: { attributes: Prisma.JsonValue | null; vouches: { attributes: Prisma.JsonValue | null }[] }): FitProfileRow[] {
  return fitProfile((p.attributes as FitScores | null) ?? null, p.vouches.map((v) => v.attributes as FitScores | null).filter((a): a is FitScores => !!a));
}
