import "server-only";
/**
 * Building and pricing requirements, shared by the team's own intake, the client portal, the
 * members' board and client search. Not an action surface: nothing here checks who is asking, so
 * every caller authorises first.
 */
import { prisma } from "@/lib/db";
import { matchBrief, estimateFee, defaultFeeModel, defaultTerms, type Brief, type BriefPerson, type RateCard, type Terms } from "@/lib/demand";
import { toDomain } from "@/lib/brief-domain";
import type { Brief as DbBrief, CommercialAccount, EngagementRoute, Prisma } from "@prisma/client";

/** Everyone the matcher can consider, or only these people when `ids` is given. */
export async function briefPeople(tenantId: string, ids?: string[]): Promise<BriefPerson[]> {
  const people = await prisma.person.findMany({ where: { tenantId, ...(ids ? { id: { in: ids } } : {}) }, include: { relationships: true, evidence: true, conversations: { where: { approvalStatus: "APPROVED" }, select: { id: true } } } });
  return people.map((p) => ({
    id: p.id, capabilities: p.capabilities, sectors: p.sectors, seniority: p.seniority, engagementPreferences: p.engagementPreferences, primaryCity: p.primaryCity, primaryCountry: p.primaryCountry, targetLocations: p.targetLocations,
    availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate, rateExpectation: p.rateExpectation, salaryExpectation: p.salaryExpectation,
    relationships: p.relationships.map((r) => ({ relationshipType: r.relationshipType, workedTogether: r.workedTogether, wouldWorkTogetherAgain: r.wouldWorkTogetherAgain, yearsKnown: r.yearsKnown })),
    evidence: p.evidence.map((e) => ({ evidenceType: e.evidenceType, confidence: e.confidence, context: e.context })),
    approvedConversations: p.conversations.length, workRights: p.workRights, relocationInterest: p.relocationInterest,
  }));
}

/** Retrieve people for a brief and upsert the shortlist. Human decisions are preserved. */
export async function runShortlist(db: DbBrief, tenantId: string) {
  const brief = toDomain(db);
  const results = matchBrief(brief, await briefPeople(tenantId), 12);
  for (const r of results) {
    await prisma.shortlistItem.upsert({
      where: { briefId_personId: { briefId: db.id, personId: r.match.personId } },
      create: { briefId: db.id, personId: r.match.personId, fitScore: r.match.fitScore, fitExplanation: r.match.fitExplanation, dimensions: r.match.dimensions as unknown as Prisma.InputJsonValue, uncertainty: r.match.uncertainty, checks: r.checks as unknown as Prisma.InputJsonValue, tier: r.tier },
      update: { fitScore: r.match.fitScore, fitExplanation: r.match.fitExplanation, dimensions: r.match.dimensions as unknown as Prisma.InputJsonValue, uncertainty: r.match.uncertainty, checks: r.checks as unknown as Prisma.InputJsonValue, tier: r.tier },
    });
  }
  return results.length;
}

export function briefData(parsed: Brief, terms: Terms) {
  return {
    rawText: parsed.rawText, title: parsed.title, engagementRoute: parsed.engagementRoute, headcount: parsed.headcount, roles: parsed.roles, capabilities: parsed.capabilities, sectors: parsed.sectors, seniority: parsed.seniority,
    locations: parsed.locations, mustBeLocal: parsed.mustBeLocal, workRights: parsed.workRights, budgetKind: parsed.budget?.kind ?? null, budgetAmount: parsed.budget?.amount ?? null, budgetMax: parsed.budget?.max ?? null, budgetCurrency: parsed.budget?.currency ?? null,
    durationMonths: parsed.durationMonths, startBy: parsed.startBy, assumptions: parsed.assumptions, questions: parsed.questions,
    feeModel: terms.model, feePct: terms.pct, feeFlat: terms.flat, feeCurrency: terms.currency,
  };
}

export async function termsFor(account: CommercialAccount, route: EngagementRoute | null, card: RateCard): Promise<Terms> {
  const model = defaultFeeModel(route, account.kind);
  return { ...defaultTerms(card, model), ...((account.terms as Partial<Terms> | null) ?? {}) };
}

export async function forecastFee(db: DbBrief, tenantId: string, card: RateCard) {
  const d = toDomain(db);
  const est = estimateFee(d, d.terms, card, d.expertHours);
  const existing = await prisma.feeLine.findFirst({ where: { briefId: db.id, personId: null, status: "FORECAST" } });
  if (!est.confident) { if (existing) await prisma.feeLine.delete({ where: { id: existing.id } }); return; }
  const data = { model: d.terms.model, basis: est.basis, gross: est.gross, ourTake: est.ourTake, currency: est.currency };
  if (existing) await prisma.feeLine.update({ where: { id: existing.id }, data });
  else await prisma.feeLine.create({ data: { ...data, tenantId, briefId: db.id, accountId: db.accountId, status: "FORECAST" } });
}


/** The account that leads shared by members sit under, until you move them to a real client. */
export async function boardAccount(tenantId: string) {
  const name = "Shared by members";
  return (await prisma.commercialAccount.findFirst({ where: { tenantId, name } }))
    ?? prisma.commercialAccount.create({ data: { tenantId, name, kind: "CLIENT", status: "PROSPECT", portalEnabled: false, notes: "Work members shared on the community board. Move a lead to the real client once you know who it is." } });
}

/**
 * When someone is placed, the members who made it happen earn a share of our fee: whoever shared
 * the work on the board, and whoever referred the person for it (or, failing that, introduced them
 * to the network). The percentage is the rate card's at the time; the amount follows the fee line.
 */
export async function creditReferrers(briefId: string, placedId: string, tenantId: string, pct: number) {
  if (!(pct > 0)) return [];
  const [brief, fee, referral, intro] = await Promise.all([
    prisma.brief.findUnique({ where: { id: briefId }, select: { boardPost: { select: { authorPersonId: true } } } }),
    prisma.feeLine.findFirst({ where: { briefId, personId: placedId }, select: { ourTake: true, currency: true } }),
    prisma.referral.findFirst({ where: { briefId, referredPersonId: placedId, status: { not: "DECLINED" } }, orderBy: { createdAt: "asc" }, select: { referrerPersonId: true } }),
    prisma.relationship.findFirst({ where: { personId: placedId, introducedById: { not: null }, introducedBy: { memberUser: { isNot: null } } }, orderBy: { createdAt: "asc" }, select: { introducedById: true } }),
  ]);
  const owed = new Map<string, string>();
  if (brief?.boardPost) owed.set(brief.boardPost.authorPersonId, "shared this work on the board");
  if (referral) owed.set(referral.referrerPersonId, owed.has(referral.referrerPersonId) ? "shared this work and referred them" : "referred them for this work");
  else if (intro?.introducedById) owed.set(intro.introducedById, owed.has(intro.introducedById) ? "shared this work and introduced them" : "introduced them to the network");
  owed.delete(placedId);
  const made = [];
  for (const [personId, reason] of owed) {
    const amount = fee ? Math.round(Number(fee.ourTake) * pct) / 100 : null;
    made.push(await prisma.referralCredit.upsert({
      where: { briefId_placedId_personId: { briefId, placedId, personId } },
      create: { tenantId, personId, briefId, placedId, reason, pct, amount, currency: fee?.currency ?? "GBP" },
      update: {},
    }));
  }
  return made;
}
