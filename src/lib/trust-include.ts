import type { Person, Vouch, Relationship, Evidence } from "@prisma/client";

/** Everything the trust score needs, for a Prisma `include`. */
export const TRUST_INCLUDE = { vouches: true, relationships: true, evidence: true, conversations: { select: { approvalStatus: true } }, referralsMade: { select: { status: true } } } as const;

export type TrustPerson = Person & { vouches: Vouch[]; relationships: Relationship[]; evidence: Evidence[]; conversations: { approvalStatus: string }[]; referralsMade?: { status: string }[] };
