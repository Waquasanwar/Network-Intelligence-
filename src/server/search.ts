import "server-only";
import type { CommercialAccount, EngagementRoute, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { redactForPartner, containsForbiddenPartnerFields, type PartnerSafePerson } from "@/lib/authz";
import { partnerRef } from "@/lib/refs";
import { mayShowCard } from "@/lib/reveal";
import { partnerHidden, privacyOf } from "@/lib/privacy";
import { ACTIVE_STATUSES } from "@/lib/availability";
import { TRUST_SELECT } from "@/lib/trust-include";
import type { SearchIntent } from "@/lib/ai/types";
import { matchesSearch } from "@/lib/search-match";

/**
 * A client's or agency's own search of the network. Only people who chose to be findable appear,
 * only as anonymised cards keyed to this account, and only twenty at a time. Not an action
 * surface: callers check the account may search first.
 */
export type SearchFilters = { q: string; route: EngagementRoute | null; where: string; now: boolean };
export const MAX_RESULTS = 20;

const SELECT = {
  id: true, tenantId: true, firstName: true, lastName: true, seniority: true, sectors: true, engagementPreferences: true, primaryCountry: true, primaryCity: true, targetLocations: true,
  rateExpectation: true, salaryExpectation: true, ...TRUST_SELECT,
  evidence: { select: { evidenceType: true, visibility: true, description: true, context: true } },
} satisfies Prisma.PersonSelect;

/** Who an account may find: people who switched on being findable, and whose card may be shown at all. */
async function findable(account: CommercialAccount, where: Prisma.PersonWhereInput[] = []) {
  const rows = await prisma.person.findMany({ where: { tenantId: account.tenantId, AND: where }, select: SELECT, take: 400 });
  return rows.filter((p) => privacyOf({ privacy: p.privacy }).consents.searchable && mayShowCard(p));
}

export async function searchNetwork(account: CommercialAccount, f: SearchFilters, intent: SearchIntent | null): Promise<(PartnerSafePerson & { rateBand: boolean })[]> {
  const and: Prisma.PersonWhereInput[] = [];
  if (f.route) and.push({ engagementPreferences: { has: f.route } });
  if (f.where) and.push({ OR: [{ primaryCity: { contains: f.where, mode: "insensitive" } }, { primaryCountry: { contains: f.where, mode: "insensitive" } }, { targetLocations: { hasSome: [f.where] } }] });
  if (f.now) and.push({ availabilityStatus: { in: ACTIVE_STATUSES } });
  const people = (await findable(account, and)).filter((p) => !f.q || matchesSearch(p, f.q, intent)).slice(0, MAX_RESULTS);
  return people.map((p) => {
    const hidden = partnerHidden({ privacy: p.privacy as never });
    const safe = redactForPartner(p, { ref: partnerRef(account.id, p.id), hideRegion: hidden.region });
    const leaked = containsForbiddenPartnerFields(safe);
    if (leaked.length) throw new Error(`Search redaction failed: ${leaked.join(", ")}`);
    return { ...safe, rateBand: !hidden.rateBand };
  });
}

/** The person behind a reference this account was shown, if they are still findable. */
export async function personForRef(account: CommercialAccount, ref: string) {
  const people = await findable(account);
  return people.find((p) => partnerRef(account.id, p.id) === ref) ?? null;
}
