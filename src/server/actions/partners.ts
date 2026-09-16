"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireInternalAction, requireUser } from "@/server/session";
import { parseList } from "@/lib/utils";
import { isPartner } from "@/lib/authz";
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
  const user = await requireInternalAction();
  if (user.role !== "OWNER" && user.role !== "ADMIN") throw new Error("Not permitted");
  const d = partnerSchema.parse(Object.fromEntries(formData));
  await prisma.partner.update({
    where: { id: d.partnerId },
    data: {
      subscriptionStatus: d.subscriptionStatus as SubscriptionStatus,
      subscriptionTier: d.subscriptionTier || null,
      commercialModel: d.commercialModel as CommercialModel,
      commercialSharePct: d.commercialSharePct ? Number(d.commercialSharePct) : null,
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
    partnerId = String(formData.get("partnerId") || "");
    if (!partnerId) throw new Error("Choose a partner");
  }
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
  const id = String(formData.get("requirementId"));
  const status = String(formData.get("status")) as RequirementStatus;
  const linkedOpportunityId = formData.get("linkedOpportunityId") ? String(formData.get("linkedOpportunityId")) : undefined;
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
  const ref = String(formData.get("ref"));
  const partner = await prisma.partner.findUnique({ where: { tenantId: user.tenantId } });
  const req = await prisma.partnerRequirement.findUnique({ where: { id: requirementId } });
  if (!partner || !req || req.partnerId !== partner.id || !req.linkedOpportunityId) throw new Error("Requirement not found");
  const opp = await prisma.opportunity.findUnique({ where: { id: req.linkedOpportunityId }, include: { matches: { include: { person: { select: { id: true } } } } } });
  if (!opp) throw new Error("Not found");
  const { opaqueRef } = await import("@/lib/authz");
  const match = opp.matches.find((m) => opaqueRef(m.person.id) === ref);
  if (!match) throw new Error("Result not found");
  await prisma.introduction.upsert({
    where: { id: `${req.id}-${match.personId}` },
    create: { id: `${req.id}-${match.personId}`, tenantId: opp.tenantId, opportunityId: opp.id, personId: match.personId, requestedById: user.id, status: "REQUESTED", route: req.engagementRoute, recruitmentPartnerId: partner.id, commercialModel: partner.commercialModel, commercialSharePct: partner.commercialSharePct, currency: partner.currency, notes: `Requested from partner portal against ${ref}` },
    update: {},
  });
  await prisma.partnerRequirement.update({ where: { id: req.id }, data: { status: "INTRO_REQUESTED" } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "introduction.request", entityType: "Introduction", entityId: `${req.id}-${match.personId}`, metadata: { ref, requirementId } });
  revalidatePath("/partner-portal");
  revalidatePath("/partners");
}
