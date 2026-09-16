"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireInternalAction } from "@/server/session";
import { parseList, fullName } from "@/lib/utils";
import { retrieveMatches, type MatchPerson } from "@/lib/matching";
import { getAIProvider } from "@/lib/ai";
import { assertSameTenant, canApprove } from "@/lib/authz";
import type { CommercialModel, EngagementRoute, HumanDecision, OpportunitySource, OpportunityStatus, Seniority } from "@prisma/client";

const oppSchema = z.object({
  title: z.string().trim().min(3).max(160),
  problemStatement: z.string().trim().min(10).max(5000),
  desiredOutcomes: z.string().trim().max(3000).optional(),
  sourceType: z.enum(["AMANA", "PARTNER", "DIRECT_CLIENT", "FOUNDER", "REFERRAL"]),
  clientName: z.string().trim().max(160).optional(),
  engagementRoute: z.enum(["PERMANENT", "CONTRACT", "INTERIM", "FRACTIONAL", "ADVISORY", "SOW"]),
  location: z.string().trim().max(120).optional(),
  duration: z.string().trim().max(80).optional(),
  startDate: z.string().optional(),
  budget: z.string().max(30).optional(),
  currency: z.string().max(3).optional(),
  requiredCapabilities: z.string().max(1000).optional(),
  preferredCapabilities: z.string().max(1000).optional(),
  sectors: z.string().max(500).optional(),
  seniority: z.enum(["", "ASSOCIATE", "MANAGER", "SENIOR_MANAGER", "DIRECTOR", "EXECUTIVE", "C_LEVEL"]).optional(),
  partnerId: z.string().optional().or(z.literal("")),
});

// Spec §17.6 — an opportunity is created from a business problem, never a CV or formal JD.
export async function createOpportunity(formData: FormData) {
  const user = await requireInternalAction();
  const parsed = oppSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Please describe the problem and choose a route");
  const d = parsed.data;
  const budget = d.budget ? Number(String(d.budget).replace(/[^0-9.]/g, "")) : null;
  const opp = await prisma.opportunity.create({
    data: {
      tenantId: user.tenantId,
      sourceType: d.sourceType as OpportunitySource,
      clientName: d.clientName || null,
      partnerId: d.partnerId || null,
      title: d.title,
      problemStatement: d.problemStatement,
      desiredOutcomes: d.desiredOutcomes || null,
      engagementRoute: d.engagementRoute as EngagementRoute,
      location: d.location || null,
      duration: d.duration || null,
      startDate: d.startDate ? new Date(d.startDate) : null,
      budget: budget && Number.isFinite(budget) ? budget : null,
      currency: d.currency || "GBP",
      requiredCapabilities: parseList(d.requiredCapabilities),
      preferredCapabilities: parseList(d.preferredCapabilities),
      sectors: parseList(d.sectors),
      seniority: (d.seniority || null) as Seniority | null,
      isAmana: d.sourceType === "AMANA",
      status: "INTAKE",
    },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "opportunity.create", entityType: "Opportunity", entityId: opp.id, metadata: { route: d.engagementRoute, source: d.sourceType } });
  revalidatePath("/opportunities");
  revalidatePath("/overview");
  redirect(`/opportunities/${opp.id}`);
}

export async function setOpportunityStatus(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("opportunityId"));
  const status = String(formData.get("status")) as OpportunityStatus;
  const opp = await prisma.opportunity.findUnique({ where: { id }, select: { tenantId: true } });
  if (!opp) throw new Error("Not found");
  assertSameTenant(user, opp.tenantId);
  await prisma.opportunity.update({ where: { id }, data: { status } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "opportunity.update", entityType: "Opportunity", entityId: id, metadata: { status } });
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${id}`);
}

/** Spec §10 — AI retrieves and explains; the human decides. Regenerates suggestions, preserving decisions already made. */
export async function generateMatches(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("opportunityId"));
  const opp = await prisma.opportunity.findUnique({ where: { id } });
  if (!opp) throw new Error("Not found");
  assertSameTenant(user, opp.tenantId);

  // Authorisation happens before any AI context retrieval (spec §12).
  const people = await prisma.person.findMany({
    where: { tenantId: user.tenantId },
    include: { relationships: true, evidence: true, conversations: { where: { approvalStatus: "APPROVED" }, select: { id: true } } },
  });
  const inputs: MatchPerson[] = people.map((p) => ({
    id: p.id,
    capabilities: p.capabilities,
    sectors: p.sectors,
    seniority: p.seniority,
    engagementPreferences: p.engagementPreferences,
    primaryCity: p.primaryCity,
    primaryCountry: p.primaryCountry,
    targetLocations: p.targetLocations,
    availabilityStatus: p.availabilityStatus,
    availabilityConfirmedAt: p.availabilityConfirmedAt,
    nextCheckDate: p.nextCheckDate,
    rateExpectation: p.rateExpectation,
    salaryExpectation: p.salaryExpectation,
    relationships: p.relationships.map((r) => ({ relationshipType: r.relationshipType, workedTogether: r.workedTogether, wouldWorkTogetherAgain: r.wouldWorkTogetherAgain, yearsKnown: r.yearsKnown })),
    evidence: p.evidence.map((e) => ({ evidenceType: e.evidenceType, confidence: e.confidence, context: e.context })),
    approvedConversations: p.conversations.length,
  }));
  const results = retrieveMatches(
    { requiredCapabilities: opp.requiredCapabilities, preferredCapabilities: opp.preferredCapabilities, sectors: opp.sectors, seniority: opp.seniority, engagementRoute: opp.engagementRoute, location: opp.location, budget: opp.budget ? Number(opp.budget) : null },
    inputs,
    10,
  );
  const ai = getAIProvider();
  const byId = new Map(people.map((p) => [p.id, p]));
  for (const m of results) {
    const person = byId.get(m.personId)!;
    const explanation = await ai.explainFit({ personName: fullName(person), opportunityTitle: opp.title, dimensions: m.dimensions, uncertainty: m.uncertainty });
    await prisma.match.upsert({
      where: { opportunityId_personId: { opportunityId: id, personId: m.personId } },
      create: { opportunityId: id, personId: m.personId, fitScore: m.fitScore, fitExplanation: explanation, evidenceStrength: m.evidenceStrength, relationshipStrength: m.relationshipStrength, availabilityFit: m.availabilityFit, commercialFit: m.commercialFit, uncertainty: m.uncertainty },
      update: { fitScore: m.fitScore, fitExplanation: explanation, evidenceStrength: m.evidenceStrength, relationshipStrength: m.relationshipStrength, availabilityFit: m.availabilityFit, commercialFit: m.commercialFit, uncertainty: m.uncertainty },
    });
  }
  if (opp.status === "INTAKE" || opp.status === "QUALIFYING") await prisma.opportunity.update({ where: { id }, data: { status: "MATCHING" } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "match.generate", entityType: "Opportunity", entityId: id, metadata: { count: results.length, provider: ai.name } });
  revalidatePath(`/opportunities/${id}`);
  revalidatePath("/opportunities");
}

export async function decideMatch(formData: FormData) {
  const user = await requireInternalAction();
  if (!canApprove(user)) throw new Error("Not permitted");
  const matchId = String(formData.get("matchId"));
  const decision = String(formData.get("decision")) as HumanDecision;
  const notes = String(formData.get("humanNotes") || "").slice(0, 2000) || null;
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { opportunity: { select: { id: true, tenantId: true } } } });
  if (!match) throw new Error("Not found");
  assertSameTenant(user, match.opportunity.tenantId);
  await prisma.match.update({ where: { id: matchId }, data: { humanDecision: decision, humanNotes: notes, approvedById: user.id } });
  if (decision === "RECOMMEND") await prisma.opportunity.updateMany({ where: { id: match.opportunity.id, status: { in: ["INTAKE", "QUALIFYING", "MATCHING"] } }, data: { status: "SHORTLIST" } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "match.decide", entityType: "Match", entityId: matchId, metadata: { decision, personId: match.personId, opportunityId: match.opportunityId } });
  revalidatePath(`/opportunities/${match.opportunityId}`);
  revalidatePath("/opportunities");
}

const introSchema = z.object({
  opportunityId: z.string(),
  personId: z.string(),
  route: z.enum(["PERMANENT", "CONTRACT", "INTERIM", "FRACTIONAL", "ADVISORY", "SOW"]),
  commercialModel: z.enum(["NONE", "INTRODUCTION_FEE", "SUCCESS_SHARE", "SUBSCRIPTION_INCLUDED", "AMANA_SOW"]).default("NONE"),
  commercialSharePct: z.string().optional(),
  commercialValue: z.string().optional(),
  recruitmentPartnerId: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

/** Spec §17.8 — a human must approve any recommendation before an introduction is created. */
export async function approveIntroduction(formData: FormData) {
  const user = await requireInternalAction();
  if (!canApprove(user)) throw new Error("Not permitted");
  const d = introSchema.parse(Object.fromEntries(formData));
  const opp = await prisma.opportunity.findUnique({ where: { id: d.opportunityId }, select: { tenantId: true } });
  if (!opp) throw new Error("Not found");
  assertSameTenant(user, opp.tenantId);
  const match = await prisma.match.findUnique({ where: { opportunityId_personId: { opportunityId: d.opportunityId, personId: d.personId } } });
  if (!match || match.humanDecision !== "RECOMMEND") throw new Error("Only a person marked Recommend by a human can be introduced");
  if (d.route === "PERMANENT" && !d.recruitmentPartnerId) throw new Error("Permanent placements are routed through a licensed recruitment partner");
  if (d.recruitmentPartnerId) {
    const partner = await prisma.partner.findUnique({ where: { id: d.recruitmentPartnerId } });
    if (!partner || !partner.licensedForPermanent) throw new Error("Selected partner is not licensed for permanent placements");
  }
  const intro = await prisma.introduction.upsert({
    where: { id: String(formData.get("introductionId") || "new") },
    create: {
      tenantId: user.tenantId,
      opportunityId: d.opportunityId,
      personId: d.personId,
      requestedById: user.id,
      approvedById: user.id,
      consentStatus: "REQUESTED",
      status: "APPROVED",
      route: d.route as EngagementRoute,
      recruitmentPartnerId: d.recruitmentPartnerId || null,
      commercialModel: d.commercialModel as CommercialModel,
      commercialSharePct: d.commercialSharePct ? Number(d.commercialSharePct) : null,
      commercialValue: d.commercialValue ? Number(String(d.commercialValue).replace(/[^0-9.]/g, "")) : null,
      notes: d.notes || null,
    },
    update: { approvedById: user.id, status: "APPROVED", notes: d.notes || null, commercialModel: d.commercialModel as CommercialModel, commercialSharePct: d.commercialSharePct ? Number(d.commercialSharePct) : null },
  });
  await prisma.opportunity.updateMany({ where: { id: d.opportunityId, status: { in: ["MATCHING", "SHORTLIST"] } }, data: { status: "INTRODUCING" } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "introduction.approve", entityType: "Introduction", entityId: intro.id, metadata: { personId: d.personId, opportunityId: d.opportunityId, route: d.route } });
  revalidatePath(`/opportunities/${d.opportunityId}`);
  revalidatePath("/partners");
  revalidatePath("/overview");
}

export async function updateIntroductionStatus(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("introductionId"));
  const status = String(formData.get("status"));
  const intro = await prisma.introduction.findUnique({ where: { id } });
  if (!intro) throw new Error("Not found");
  assertSameTenant(user, intro.tenantId);
  const consent = formData.get("consentStatus") ? String(formData.get("consentStatus")) : undefined;
  await prisma.introduction.update({
    where: { id },
    data: {
      status: status as never,
      consentStatus: consent as never,
      introducedAt: status === "INTRODUCED" ? new Date() : intro.introducedAt,
    },
  });
  if (status === "IDENTITY_REVEALED") await audit({ tenantId: user.tenantId, actorId: user.id, action: "identity.reveal", entityType: "Introduction", entityId: id, metadata: { personId: intro.personId, partnerId: intro.recruitmentPartnerId } });
  revalidatePath(`/opportunities/${intro.opportunityId}`);
  revalidatePath("/partners");
}

export async function addToTeam(formData: FormData) {
  const user = await requireInternalAction();
  const opportunityId = String(formData.get("opportunityId"));
  const personId = String(formData.get("personId"));
  const roleOnTeam = String(formData.get("roleOnTeam") || "Team member").slice(0, 120);
  const opp = await prisma.opportunity.findUnique({ where: { id: opportunityId }, select: { tenantId: true } });
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { tenantId: true } });
  if (!opp || !person) throw new Error("Not found");
  assertSameTenant(user, opp.tenantId);
  assertSameTenant(user, person.tenantId);
  await prisma.teamShortlistMember.upsert({ where: { opportunityId_personId: { opportunityId, personId } }, create: { opportunityId, personId, roleOnTeam }, update: { roleOnTeam } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "team.add", entityType: "Opportunity", entityId: opportunityId, metadata: { personId, roleOnTeam } });
  revalidatePath("/amana");
  revalidatePath(`/opportunities/${opportunityId}`);
}

export async function removeFromTeam(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("memberId"));
  const m = await prisma.teamShortlistMember.findUnique({ where: { id }, include: { opportunity: { select: { tenantId: true, id: true } } } });
  if (!m) return;
  assertSameTenant(user, m.opportunity.tenantId);
  await prisma.teamShortlistMember.delete({ where: { id } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "team.remove", entityType: "Opportunity", entityId: m.opportunity.id, metadata: { personId: m.personId } });
  revalidatePath("/amana");
  revalidatePath(`/opportunities/${m.opportunity.id}`);
}
