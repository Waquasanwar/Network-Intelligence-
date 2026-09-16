"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireInternalAction } from "@/server/session";
import { parseList } from "@/lib/utils";
import { suggestNextCheck } from "@/lib/availability";
import { assertSameTenant } from "@/lib/authz";
import type { AvailabilityStatus, EngagementRoute, Seniority, SourceType, RelationshipType, EvidenceType, Visibility } from "@prisma/client";

const routes = ["PERMANENT", "CONTRACT", "INTERIM", "FRACTIONAL", "ADVISORY", "SOW"] as const;

// Spec §9 step 1 — add a person in under 60 seconds. Source and provenance are mandatory (§17.2).
const addPersonSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  headline: z.string().trim().max(200).optional(),
  currentCompany: z.string().trim().max(120).optional(),
  currentRole: z.string().trim().max(120).optional(),
  primaryCity: z.string().trim().max(80).optional(),
  primaryCountry: z.string().trim().max(80).optional(),
  capabilities: z.string().max(1000).optional(),
  sourceType: z.enum(["PERSONAL_NETWORK", "INTRODUCTION", "WORKED_TOGETHER", "CLIENT", "PARTNER_REFERRAL", "EVENT", "INBOUND", "LINKEDIN", "OTHER"]),
  relationshipType: z.enum(["DIRECT", "INTRODUCED", "WORKED_WITH", "MANAGED", "REPORTED_TO", "CLIENT_OF", "PEER", "MENTORED", "KNOWS_OF"]),
  introducedById: z.string().max(40).optional().or(z.literal("")),
  workedTogether: z.coerce.boolean().optional(),
  relationshipNotes: z.string().max(4000).optional(),
});

export async function addPerson(formData: FormData) {
  const user = await requireInternalAction();
  const parsed = addPersonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Please complete the required fields: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  const d = parsed.data;
  if (d.introducedById) {
    const intro = await prisma.person.findUnique({ where: { id: d.introducedById }, select: { tenantId: true } });
    if (!intro) throw new Error("Introducer not found");
    assertSameTenant(user, intro.tenantId);
  }
  const person = await prisma.person.create({
    data: {
      tenantId: user.tenantId,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email || null,
      headline: d.headline || null,
      currentCompany: d.currentCompany || null,
      currentRole: d.currentRole || null,
      primaryCity: d.primaryCity || null,
      primaryCountry: d.primaryCountry || null,
      capabilities: parseList(d.capabilities),
      availabilityStatus: "NEEDS_REFRESH",
      nextAction: "Book first conversation",
      relationships: {
        create: {
          networkOwnerId: user.id,
          sourceType: d.sourceType as SourceType,
          relationshipType: d.relationshipType as RelationshipType,
          introducedById: d.introducedById || null,
          workedTogether: d.workedTogether ?? d.relationshipType === "WORKED_WITH",
          relationshipNotes: d.relationshipNotes || null,
          lastContactDate: new Date(),
        },
      },
    },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "person.create", entityType: "Person", entityId: person.id, metadata: { source: d.sourceType } });
  revalidatePath("/network");
  revalidatePath("/overview");
  redirect(`/network/${person.id}`);
}

const updatePersonSchema = z.object({
  personId: z.string(),
  headline: z.string().trim().max(200).optional(),
  currentCompany: z.string().trim().max(120).optional(),
  currentRole: z.string().trim().max(120).optional(),
  primaryCity: z.string().trim().max(80).optional(),
  primaryCountry: z.string().trim().max(80).optional(),
  targetLocations: z.string().max(500).optional(),
  capabilities: z.string().max(1500).optional(),
  sectors: z.string().max(500).optional(),
  seniority: z.enum(["", "ASSOCIATE", "MANAGER", "SENIOR_MANAGER", "DIRECTOR", "EXECUTIVE", "C_LEVEL"]).optional(),
  engagementPreferences: z.array(z.enum(routes)).optional(),
  rateExpectation: z.string().max(80).optional(),
  salaryExpectation: z.string().max(80).optional(),
  noticePeriod: z.string().max(80).optional(),
  nextAction: z.string().max(200).optional(),
  nextActionDate: z.string().optional(),
  amanaBench: z.coerce.boolean().optional(),
  relocationInterest: z.coerce.boolean().optional(),
});

export async function updatePerson(formData: FormData) {
  const user = await requireInternalAction();
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.engagementPreferences = formData.getAll("engagementPreferences");
  const parsed = updatePersonSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid profile update");
  const d = parsed.data;
  const existing = await prisma.person.findUnique({ where: { id: d.personId }, select: { tenantId: true } });
  if (!existing) throw new Error("Not found");
  assertSameTenant(user, existing.tenantId);
  await prisma.person.update({
    where: { id: d.personId },
    data: {
      headline: d.headline || null,
      currentCompany: d.currentCompany || null,
      currentRole: d.currentRole || null,
      primaryCity: d.primaryCity || null,
      primaryCountry: d.primaryCountry || null,
      targetLocations: parseList(d.targetLocations),
      capabilities: parseList(d.capabilities),
      sectors: parseList(d.sectors),
      seniority: (d.seniority || null) as Seniority | null,
      engagementPreferences: (d.engagementPreferences ?? []) as EngagementRoute[],
      rateExpectation: d.rateExpectation || null,
      salaryExpectation: d.salaryExpectation || null,
      noticePeriod: d.noticePeriod || null,
      nextAction: d.nextAction || null,
      nextActionDate: d.nextActionDate ? new Date(d.nextActionDate) : null,
      amanaBench: d.amanaBench ?? false,
      relocationInterest: d.relocationInterest ?? false,
    },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "person.update", entityType: "Person", entityId: d.personId });
  revalidatePath(`/network/${d.personId}`);
  revalidatePath("/network");
}

const availabilitySchema = z.object({
  personId: z.string(),
  availabilityStatus: z.string(),
  availabilityDate: z.string().optional(),
  availabilitySource: z.string().max(80).optional(),
  availabilityConfidence: z.coerce.number().min(0).max(100).optional(),
});

export async function updateAvailability(formData: FormData) {
  const user = await requireInternalAction();
  const d = availabilitySchema.parse(Object.fromEntries(formData));
  const existing = await prisma.person.findUnique({ where: { id: d.personId }, select: { tenantId: true } });
  if (!existing) throw new Error("Not found");
  assertSameTenant(user, existing.tenantId);
  const status = d.availabilityStatus as AvailabilityStatus;
  const now = new Date();
  await prisma.person.update({
    where: { id: d.personId },
    data: {
      availabilityStatus: status,
      availabilityDate: d.availabilityDate ? new Date(d.availabilityDate) : null,
      availabilityConfirmedAt: now,
      availabilitySource: d.availabilitySource || "manual",
      availabilityConfidence: d.availabilityConfidence ?? 80,
      nextCheckDate: suggestNextCheck(status, now),
    },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "person.update", entityType: "Person", entityId: d.personId, metadata: { field: "availability", status } });
  revalidatePath(`/network/${d.personId}`);
  revalidatePath("/network");
  revalidatePath("/overview");
}

const relationshipSchema = z.object({
  personId: z.string(),
  sourceType: z.string(),
  relationshipType: z.string(),
  introducedById: z.string().optional().or(z.literal("")),
  workedTogether: z.coerce.boolean().optional(),
  workedTogetherContext: z.string().max(1000).optional(),
  yearsKnown: z.coerce.number().int().min(0).max(60).optional(),
  wouldWorkTogetherAgain: z.enum(["", "yes", "no"]).optional(),
  relationshipNotes: z.string().max(4000).optional(),
});

export async function addRelationship(formData: FormData) {
  const user = await requireInternalAction();
  const d = relationshipSchema.parse(Object.fromEntries(formData));
  const existing = await prisma.person.findUnique({ where: { id: d.personId }, select: { tenantId: true } });
  if (!existing) throw new Error("Not found");
  assertSameTenant(user, existing.tenantId);
  const r = await prisma.relationship.create({
    data: {
      personId: d.personId,
      networkOwnerId: user.id,
      sourceType: d.sourceType as SourceType,
      relationshipType: d.relationshipType as RelationshipType,
      introducedById: d.introducedById || null,
      workedTogether: d.workedTogether ?? false,
      workedTogetherContext: d.workedTogetherContext || null,
      yearsKnown: d.yearsKnown ?? null,
      wouldWorkTogetherAgain: d.wouldWorkTogetherAgain === "yes" ? true : d.wouldWorkTogetherAgain === "no" ? false : null,
      relationshipNotes: d.relationshipNotes || null,
      lastContactDate: new Date(),
    },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "relationship.create", entityType: "Relationship", entityId: r.id, metadata: { personId: d.personId } });
  revalidatePath(`/network/${d.personId}`);
}

const evidenceSchema = z.object({
  personId: z.string(),
  evidenceType: z.string(),
  context: z.string().trim().min(2).max(200),
  description: z.string().trim().min(5).max(3000),
  confidence: z.coerce.number().min(0).max(100).default(70),
  dateObserved: z.string().optional(),
  visibility: z.enum(["PRIVATE", "TENANT", "PARTNER_SAFE"]).default("TENANT"),
});

export async function addEvidence(formData: FormData) {
  const user = await requireInternalAction();
  const d = evidenceSchema.parse(Object.fromEntries(formData));
  const existing = await prisma.person.findUnique({ where: { id: d.personId }, select: { tenantId: true } });
  if (!existing) throw new Error("Not found");
  assertSameTenant(user, existing.tenantId);
  const e = await prisma.evidence.create({
    data: {
      personId: d.personId,
      observerId: user.id,
      evidenceType: d.evidenceType as EvidenceType,
      context: d.context,
      description: d.description,
      confidence: d.confidence,
      dateObserved: d.dateObserved ? new Date(d.dateObserved) : null,
      visibility: d.visibility as Visibility,
    },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "evidence.create", entityType: "Evidence", entityId: e.id, metadata: { personId: d.personId, type: d.evidenceType } });
  revalidatePath(`/network/${d.personId}`);
}

export async function exportPerson(personId: string) {
  const user = await requireInternalAction();
  const person = await prisma.person.findUnique({ where: { id: personId }, include: { relationships: true, evidence: true, conversations: true, relocationProfile: true } });
  if (!person) throw new Error("Not found");
  assertSameTenant(user, person.tenantId);
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "person.export", entityType: "Person", entityId: personId });
  return JSON.stringify(person, null, 2);
}

export async function requestDeletion(formData: FormData) {
  const user = await requireInternalAction();
  const personId = String(formData.get("personId"));
  const reason = String(formData.get("reason") || "").slice(0, 500);
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { tenantId: true } });
  if (!person) throw new Error("Not found");
  assertSameTenant(user, person.tenantId);
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "data.deletion_request", entityType: "Person", entityId: personId, metadata: { reason } });
  revalidatePath("/settings/security");
}
