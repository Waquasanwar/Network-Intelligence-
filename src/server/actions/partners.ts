"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireInternalAction, requireOwnerAction, requireUser } from "@/server/session";
import { partnerRef } from "@/lib/refs";
import { mayShowCard } from "@/lib/reveal";
import { limitOrThrow } from "@/lib/rate-limit";
import { parseList } from "@/lib/utils";
import { isInternal, isPartner } from "@/lib/authz";
import type { CommercialModel, EngagementRoute, RequirementStatus, Seniority, SubscriptionStatus } from "@prisma/client";

const partnerSchema = z.object({
  partnerId: z.string(),
  subscriptionStatus: z.enum(["TRIAL", "ACTIVE", "PAUSED", "CANCELLED"]),
  subscriptionTier: z.string().max(60).optional(),
  commercialModel: z.enum(["NONE", "INTRODUCTION_FEE", "SUCCESS_SHARE", "SUBSCRIPTION_INCLUDED", "AMANA_SOW"]),
  commercialSharePct: z.string().optional(),
  monthlyFee: z.string().optional(),
  currency: z.string().max(3).default("GBP"),
  licensedForPermanent: z.coerce.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

// Commercial model is configurable per partner; percentages are never hard-coded (spec §4).
export async function updatePartner(formData: FormData) {
  const user = await requireOwnerAction();
  const d = partnerSchema.parse(Object.fromEntries(formData));
  // Only an agency this network works with — the id on the form is not proof of that.
  if (!(await prisma.partner.findFirst({ where: { id: d.partnerId, networkTenantId: user.tenantId }, select: { id: true } }))) throw new Error("Partner not found");
  const pct = d.commercialSharePct ? Number(d.commercialSharePct) : null;
  if (pct !== null && !(pct >= 0 && pct <= 100)) throw new Error("Share must be between 0 and 100");
  await prisma.partner.update({
    where: { id: d.partnerId },
    data: {
      subscriptionStatus: d.subscriptionStatus as SubscriptionStatus,
      subscriptionTier: d.subscriptionTier || null,
      commercialModel: d.commercialModel as CommercialModel,
      commercialSharePct: pct,
      monthlyFee: d.monthlyFee ? Number(String(d.monthlyFee).replace(/[^0-9.]/g, "")) : null,
      currency: d.currency,
      licensedForPermanent: d.licensedForPermanent ?? false,
      notes: d.notes || null,
    },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "partner.update", entityType: "Partner", entityId: d.partnerId, metadata: { commercialModel: d.commercialModel, sharePct: d.commercialSharePct ?? null } });
  revalidatePath("/partners");
}

const requirementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000),
  engagementRoute: z.enum(["PERMANENT", "CONTRACT", "INTERIM", "FRACTIONAL", "ADVISORY", "SOW"]),
  location: z.string().max(120).optional(),
  requiredCapabilities: z.string().max(1000).optional(),
  seniority: z.enum(["", "ASSOCIATE", "MANAGER", "SENIOR_MANAGER", "DIRECTOR", "EXECUTIVE", "C_LEVEL"]).optional(),
  budget: z.string().max(60).optional(),
});

/** Partner submits a requirement from the restricted portal. Internal users may also log one on a partner's behalf. */
export async function submitPartnerRequirement(formData: FormData) {
  const user = await requireUser();
  const d = requirementSchema.parse(Object.fromEntries(formData));
  let partnerId: string;
  if (isPartner(user)) {
    const partner = await prisma.partner.findUnique({ where: { tenantId: user.tenantId } });
    if (!partner) throw new Error("Partner profile not found");
    if (partner.subscriptionStatus === "CANCELLED" || partner.subscriptionStatus === "PAUSED") throw new Error("Subscription is not active");
    partnerId = partner.id;
  } else {
    // Logging on an agency's behalf is for the internal team, and only for their own agencies.
    if (!isInternal(user)) throw new Error("Not permitted");
    partnerId = String(formData.get("partnerId") || "");
    if (!partnerId) throw new Error("Choose a partner");
    if (!(await prisma.partner.findFirst({ where: { id: partnerId, networkTenantId: user.tenantId }, select: { id: true } }))) throw new Error("Partner not found");
  }
  await limitOrThrow("mutate", `partner-req:${user.id}`);
  const req = await prisma.partnerRequirement.create({
    data: {
      partnerId,
      title: d.title,
      description: d.description,
      engagementRoute: d.engagementRoute as EngagementRoute,
      location: d.location || null,
      requiredCapabilities: parseList(d.requiredCapabilities),
      seniority: (d.seniority || null) as Seniority | null,
      budget: d.budget || null,
    },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "partner.requirement", entityType: "PartnerRequirement", entityId: req.id, metadata: { title: d.title } });
  revalidatePath("/partners");
  revalidatePath("/partner-portal");
}

export async function setRequirementStatus(formData: FormData) {
  const user = await requireInternalAction();
  const d = z.object({ requirementId: z.string().min(1).max(40), status: z.enum(["SUBMITTED", "REVIEWING", "RESULTS_SHARED", "INTRO_REQUESTED", "CLOSED"]), linkedOpportunityId: z.string().max(40).optional() }).parse(Object.fromEntries(formData));
  const id = d.requirementId; const status = d.status as RequirementStatus;
  const req = await prisma.partnerRequirement.findFirst({ where: { id, partner: { networkTenantId: user.tenantId } }, select: { id: true } });
  if (!req) throw new Error("Requirement not found");
  const linkedOpportunityId = d.linkedOpportunityId || undefined;
  if (linkedOpportunityId) {
    const opp = await prisma.opportunity.findUnique({ where: { id: linkedOpportunityId }, select: { tenantId: true } });
    if (!opp || opp.tenantId !== user.tenantId) throw new Error("Opportunity not found");
  }
  await prisma.partnerRequirement.update({ where: { id }, data: { status, linkedOpportunityId } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "partner.update", entityType: "PartnerRequirement", entityId: id, metadata: { status } });
  revalidatePath("/partners");
  revalidatePath("/partner-portal");
}

/** Partner asks for an introduction to an anonymised result. Creates a REQUESTED introduction for internal approval. */
export async function requestIntroductionFromPortal(formData: FormData) {
  const user = await requireUser();
  if (!isPartner(user)) throw new Error("Not permitted");
  const requirementId = String(formData.get("requirementId"));
  const ref = String(formData.get("ref")).slice(0, 20);
  const partner = await prisma.partner.findUnique({ where: { tenantId: user.tenantId } });
  const req = await prisma.partnerRequirement.findUnique({ where: { id: requirementId } });
  if (!partner || !partner.networkTenantId || !req || req.partnerId !== partner.id || !req.linkedOpportunityId) throw new Error("Requirement not found");
  if (partner.subscriptionStatus === "CANCELLED" || partner.subscriptionStatus === "PAUSED") throw new Error("Subscription is not active");
  if (!["RESULTS_SHARED", "INTRO_REQUESTED"].includes(req.status)) throw new Error("Results have not been shared for this requirement yet");
  await limitOrThrow("mutate", `intro-req:${user.id}`);
  const opp = await prisma.opportunity.findFirst({ where: { id: req.linkedOpportunityId, tenantId: partner.networkTenantId }, include: { matches: { include: { person: { select: { id: true, privacy: true, referralConsent: true } } } } } });
  if (!opp) throw new Error("Not found");
  const match = opp.matches.find((m) => mayShowCard(m.person) && partnerRef(partner.id, m.person.id) === ref);
  if (!match) throw new Error("Result not found");
  // One request per person per requirement. The id is an ordinary random one: nothing about the
  // person can be read off anything the agency's browser receives.
  const existing = await prisma.introduction.findFirst({ where: { tenantId: opp.tenantId, opportunityId: opp.id, personId: match.personId, recruitmentPartnerId: partner.id }, select: { id: true } });
  const intro = existing ?? await prisma.introduction.create({
    data: { tenantId: opp.tenantId, opportunityId: opp.id, personId: match.personId, requestedById: user.id, status: "REQUESTED", route: req.engagementRoute, recruitmentPartnerId: partner.id, commercialModel: partner.commercialModel, commercialSharePct: partner.commercialSharePct, currency: partner.currency },
    select: { id: true },
  });
  await prisma.partnerRequirement.update({ where: { id: req.id }, data: { status: "INTRO_REQUESTED" } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "introduction.request", entityType: "Introduction", entityId: intro.id, metadata: { ref, requirementId, partnerId: partner.id } });
  revalidatePath("/partner-portal");
  revalidatePath("/partners");
}
