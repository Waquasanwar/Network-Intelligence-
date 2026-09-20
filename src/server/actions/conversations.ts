"use server";
import { z } from "zod";
import type { ScreeningResult } from "@/lib/screening";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireInternalAction } from "@/server/session";
import { getAIProvider, ExtractedSummarySchema } from "@/lib/ai";
import { getSchedulingProvider } from "@/lib/scheduling";
import { assertSameTenant, canApprove } from "@/lib/authz";
import { suggestNextCheck } from "@/lib/availability";
import { fullName } from "@/lib/utils";
import type { AvailabilityStatus, ConversationType, EngagementRoute, Prisma, SchedulingProviderKind } from "@prisma/client";

async function ownedPerson(userTenantId: string, personId: string) {
  const p = await prisma.person.findUnique({ where: { id: personId } });
  if (!p) throw new Error("Person not found");
  if (p.tenantId !== userTenantId) throw new Error("Cross-tenant access denied");
  return p;
}

const scheduleSchema = z.object({
  personId: z.string(),
  provider: z.enum(["MANUAL", "MICROSOFT_GRAPH", "CALENDLY"]).default("MANUAL"),
  startAt: z.string().min(1),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(45),
  meetingType: z.string().default("INTRO_CALL"),
  timezone: z.string().default("Europe/London"),
});

// Spec §9 step 2 — book a conversation via Outlook, Calendly or manually.
export async function scheduleConversation(formData: FormData) {
  const user = await requireInternalAction();
  const d = scheduleSchema.parse(Object.fromEntries(formData));
  const person = await ownedPerson(user.tenantId, d.personId);
  const start = new Date(d.startAt);
  const end = new Date(start.getTime() + d.durationMinutes * 60_000);

  const connection = await prisma.schedulingConnection.findUnique({ where: { userId_provider: { userId: user.id, provider: d.provider as SchedulingProviderKind } } });
  const provider = getSchedulingProvider(d.provider as SchedulingProviderKind, async () => null);
  let externalId: string | null = null;
  let url: string | null = null;
  if (d.provider !== "MANUAL" && connection && !connection.revokedAt) {
    try {
      const m = await provider.createMeeting({ title: `Conversation with ${fullName(person)}`, start, end, timezone: d.timezone, attendees: [{ name: fullName(person), email: person.email }], onlineMeeting: true });
      externalId = m.externalId;
      url = m.url;
    } catch (err) {
      console.warn("[scheduling] provider call failed; recording as proposed", err);
    }
  }
  const sc = await prisma.scheduledConversation.create({
    data: { tenantId: user.tenantId, personId: person.id, ownerId: user.id, provider: d.provider as SchedulingProviderKind, externalEventId: externalId, eventUrl: url, startAt: start, endAt: end, timezone: d.timezone, meetingType: d.meetingType as ConversationType, status: "SCHEDULED" },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "conversation.schedule", entityType: "ScheduledConversation", entityId: sc.id, metadata: { provider: d.provider, personId: person.id } });
  revalidatePath("/conversations");
  revalidatePath(`/network/${person.id}`);
  revalidatePath("/overview");
}

const captureSchema = z.object({
  personId: z.string(),
  scheduledEventId: z.string().optional().or(z.literal("")),
  date: z.string().optional(),
  type: z.string().default("CATCH_UP"),
  rawNotes: z.string().max(20000).optional(),
  transcript: z.string().max(200000).optional(),
  consentReference: z.string().max(120).optional(),
  runAI: z.coerce.boolean().optional(),
});

// Spec §9 steps 3–4 — capture notes / transcript, then structure with AI for review.
export async function captureConversation(formData: FormData) {
  const user = await requireInternalAction();
  const d = captureSchema.parse(Object.fromEntries(formData));
  const person = await ownedPerson(user.tenantId, d.personId);
  if (!d.rawNotes && !d.transcript) throw new Error("Add notes or a transcript");

  let aiSummary: Prisma.InputJsonValue | undefined;
  if (d.runAI !== false) {
    const ai = getAIProvider();
    aiSummary = (await ai.structureConversation({ personName: fullName(person), notes: d.rawNotes, transcript: d.transcript })) as unknown as Prisma.InputJsonValue;
  }
  const conv = await prisma.conversation.create({
    data: {
      personId: person.id,
      conductedById: user.id,
      scheduledEventId: d.scheduledEventId || null,
      date: d.date ? new Date(d.date) : new Date(),
      type: d.type as ConversationType,
      rawNotes: d.rawNotes || null,
      transcript: d.transcript || null,
      aiSummary,
      approvalStatus: aiSummary ? "NEEDS_REVIEW" : "DRAFT",
      consentReference: d.consentReference || null,
    },
  });
  if (d.scheduledEventId) await prisma.scheduledConversation.update({ where: { id: d.scheduledEventId }, data: { status: "COMPLETED" } }).catch(() => null);
  await prisma.relationship.updateMany({ where: { personId: person.id, networkOwnerId: user.id }, data: { lastContactDate: new Date() } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: d.transcript ? "conversation.transcript" : "conversation.create", entityType: "Conversation", entityId: conv.id, metadata: { personId: person.id, ai: Boolean(aiSummary) } });
  if (aiSummary) await audit({ tenantId: user.tenantId, actorId: user.id, action: "summary.generate", entityType: "Conversation", entityId: conv.id, metadata: { provider: getAIProvider().name } });
  revalidatePath("/conversations");
  revalidatePath(`/network/${person.id}`);
  redirect(`/conversations?tab=review&open=${conv.id}`);
}

export async function regenerateSummary(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("conversationId"));
  const conv = await prisma.conversation.findUnique({ where: { id }, include: { person: true } });
  if (!conv) throw new Error("Not found");
  assertSameTenant(user, conv.person.tenantId);
  const summary = await getAIProvider().structureConversation({ personName: fullName(conv.person), notes: conv.rawNotes, transcript: conv.transcript });
  await prisma.conversation.update({ where: { id }, data: { aiSummary: summary as unknown as Prisma.InputJsonValue, approvalStatus: "NEEDS_REVIEW" } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "summary.generate", entityType: "Conversation", entityId: id });
  revalidatePath("/conversations");
}

// Spec §9 step 5 — nothing becomes authoritative until a human approves it.
export async function approveSummary(formData: FormData) {
  const user = await requireInternalAction();
  if (!canApprove(user)) throw new Error("Not permitted");
  const id = String(formData.get("conversationId"));
  const conv = await prisma.conversation.findUnique({ where: { id }, include: { person: true } });
  if (!conv) throw new Error("Not found");
  assertSameTenant(user, conv.person.tenantId);

  // The reviewer may have edited the structured fields; take the edited version from the form.
  const edited = {
    headline: String(formData.get("headline") || ""),
    capabilities: String(formData.get("capabilities") || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
    sectors: String(formData.get("sectors") || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
    engagementPreferences: formData.getAll("engagementPreferences").map(String),
    locationPreferences: String(formData.get("locationPreferences") || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
    currentStatus: String(formData.get("currentStatus") || ""),
    suggestedAvailabilityStatus: String(formData.get("suggestedAvailabilityStatus") || "") || undefined,
    ratesOrSalary: String(formData.get("ratesOrSalary") || ""),
    workingCharacteristics: String(formData.get("workingCharacteristics") || "").split(/\n/).map((s) => s.trim()).filter(Boolean),
    constraints: String(formData.get("constraints") || "").split(/\n/).map((s) => s.trim()).filter(Boolean),
    strengths: String(formData.get("strengths") || "").split(/\n/).map((s) => s.trim()).filter(Boolean),
    avoid: String(formData.get("avoid") || "").split(/\n/).map((s) => s.trim()).filter(Boolean),
    followUpDate: String(formData.get("followUpDate") || "") || undefined,
    unresolvedQuestions: String(formData.get("unresolvedQuestions") || "").split(/\n/).map((s) => s.trim()).filter(Boolean),
    summary: String(formData.get("summary") || ""),
  };
  const approved = ExtractedSummarySchema.parse(edited);
  const applyToProfile = formData.get("applyToProfile") === "on";
  const followUp = formData.get("followUpISO") ? new Date(String(formData.get("followUpISO"))) : null;

  await prisma.$transaction(async (tx) => {
    await tx.conversation.update({
      where: { id },
      data: { approvedSummary: approved as unknown as Prisma.InputJsonValue, approvedById: user.id, approvalStatus: "APPROVED", followUpDate: followUp },
    });
    if (conv.type === "SCREENING") {
      const r = (conv.screening as { result?: ScreeningResult } | null)?.result;
      const p = conv.person; const prof = r?.profile;
      await tx.person.update({ where: { id: p.id }, data: {
        screenedAt: conv.date, screeningStatus: "APPROVED", memberSince: p.memberSince ?? conv.date, referralConsent: prof?.referralConsent ?? p.referralConsent ?? "ask",
        workRights: prof?.workRights.length ? prof.workRights : p.workRights, targetLocations: prof?.targetLocations.length ? [...new Set([...p.targetLocations, ...prof.targetLocations])] : p.targetLocations,
        noticePeriod: prof?.noticePeriod ?? p.noticePeriod, rateExpectation: prof?.rateExpectation ?? p.rateExpectation, salaryExpectation: prof?.salaryExpectation ?? p.salaryExpectation, seniority: prof?.seniority ?? p.seniority,
        primaryCity: prof?.primaryCity ?? p.primaryCity, primaryCountry: prof?.primaryCountry ?? p.primaryCountry, relocationInterest: p.relocationInterest || !!prof?.relocationInterest, nextAction: null, nextActionDate: null,
      } });
      if (r?.evidenceCandidate) await tx.evidence.create({ data: { personId: p.id, observerId: user.id, evidenceType: "REFERENCE", context: "Screening: proudest piece of work (self-reported)", description: r.evidenceCandidate.slice(0, 2000), confidence: 50, dateObserved: conv.date, visibility: "TENANT" } });
    }
    if (applyToProfile) {
      const p = conv.person;
      const merge = (a: string[], b: string[]) => [...new Set([...a, ...b.map((s) => s.trim()).filter(Boolean)])];
      const status = approved.suggestedAvailabilityStatus as AvailabilityStatus | undefined;
      await tx.person.update({
        where: { id: p.id },
        data: {
          headline: p.headline ?? (approved.headline || null),
          capabilities: merge(p.capabilities, approved.capabilities),
          sectors: merge(p.sectors, approved.sectors),
          engagementPreferences: [...new Set([...p.engagementPreferences, ...(approved.engagementPreferences as EngagementRoute[])])],
          targetLocations: merge(p.targetLocations, approved.locationPreferences),
          rateExpectation: approved.ratesOrSalary && !/salary|package|k\b/i.test(approved.ratesOrSalary) ? approved.ratesOrSalary : p.rateExpectation,
          salaryExpectation: approved.ratesOrSalary && /salary|package|k\b/i.test(approved.ratesOrSalary) ? approved.ratesOrSalary : p.salaryExpectation,
          workingStyle: approved.workingCharacteristics.length ? approved.workingCharacteristics.join("; ") : p.workingStyle,
          constraints: approved.constraints.length ? approved.constraints.join("; ") : p.constraints,
          ...(status
            ? { availabilityStatus: status, availabilityConfirmedAt: conv.date, availabilitySource: "conversation", availabilityConfidence: 85, nextCheckDate: suggestNextCheck(status, conv.date) }
            : {}),
          nextAction: followUp ? "Follow up" : p.nextAction,
          nextActionDate: followUp ?? p.nextActionDate,
        },
      });
    }
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "summary.approve", entityType: "Conversation", entityId: id, metadata: { personId: conv.personId, applyToProfile } });
  revalidatePath("/conversations");
  revalidatePath(`/network/${conv.personId}`);
  revalidatePath("/network");
  revalidatePath("/overview");
  redirect("/conversations?tab=review");
}

export async function rejectSummary(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("conversationId"));
  const conv = await prisma.conversation.findUnique({ where: { id }, include: { person: true } });
  if (!conv) throw new Error("Not found");
  assertSameTenant(user, conv.person.tenantId);
  await prisma.conversation.update({ where: { id }, data: { approvalStatus: "REJECTED", aiSummary: undefined } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "summary.reject", entityType: "Conversation", entityId: id });
  revalidatePath("/conversations");
}

export async function cancelScheduled(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("scheduledId"));
  const sc = await prisma.scheduledConversation.findUnique({ where: { id } });
  if (!sc) throw new Error("Not found");
  assertSameTenant(user, sc.tenantId);
  if (sc.externalEventId) {
    try { await getSchedulingProvider(sc.provider, async () => null).cancelMeeting(sc.externalEventId); } catch { /* recorded below regardless */ }
  }
  await prisma.scheduledConversation.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/conversations");
}
