import type { Person, Vouch, Relationship, Evidence } from "@prisma/client";

/** Everything the trust score needs, for a Prisma `include`. */
export const TRUST_INCLUDE = { vouches: true, relationships: true, evidence: true, conversations: { select: { approvalStatus: true, type: true, approvedById: true } }, referralsMade: { select: { status: true } } } as const;

export type TrustPerson = Person & { vouches: Vouch[]; relationships: Relationship[]; evidence: Evidence[]; conversations: { approvalStatus: string; type?: string; approvedById?: string | null }[]; referralsMade?: { status: string }[] };
