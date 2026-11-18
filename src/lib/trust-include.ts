import type { Person, Vouch, Relationship, Evidence } from "@prisma/client";

/** Who introduced someone, as far as the framework's "their introducer is trusted" check needs to know. */
export const INTRODUCER_SELECT = { select: { id: true, firstName: true, lastName: true, screeningStatus: true, screenedAt: true, vouches: { select: { wouldRecommend: true } } } } as const;

/** Everything the trust score needs, for a Prisma `include`. */
export const TRUST_INCLUDE = { vouches: true, relationships: { include: { introducedBy: INTRODUCER_SELECT, networkOwner: { select: { name: true } } } }, evidence: true, conversations: { select: { approvalStatus: true, type: true, approvedById: true } }, referralsMade: { select: { status: true } } } as const;

/** The same, for a Prisma `select` on a list where only the scoring fields are wanted. */
export const TRUST_SELECT = {
  availabilityStatus: true, availabilityConfirmedAt: true, nextCheckDate: true, screeningStatus: true, screenedAt: true,
  checks: true, workRights: true, capabilities: true, referralConsent: true, privacy: true,
  relationships: { select: { sourceType: true, introducedById: true, workedTogether: true, wouldWorkTogetherAgain: true, yearsKnown: true, introducedBy: INTRODUCER_SELECT, networkOwner: { select: { name: true } } } },
  vouches: { select: { wouldRecommend: true, voucherKind: true } },
  evidence: { select: { evidenceType: true, context: true } },
  conversations: { select: { approvalStatus: true, type: true, approvedById: true } },
} as const;

export type TrustPerson = Person & { vouches: Vouch[]; relationships: Relationship[]; evidence: Evidence[]; conversations: { approvalStatus: string; type?: string; approvedById?: string | null }[]; referralsMade?: { status: string }[] };
