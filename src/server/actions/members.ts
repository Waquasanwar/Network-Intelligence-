"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireInternalAction, requireUser, type SessionUser } from "@/server/session";
import { assertSameTenant, isInternal, isMember } from "@/lib/authz";
import { assessFreshness } from "@/lib/availability";
import { trustScore, type TrustScore } from "@/lib/trust";
import { fitProfile, ATTRIBUTES, type FitScores, type FitProfileRow } from "@/lib/fit";
import { SCREENING_SCRIPT, screeningToResult, type ScreeningAnswers, type ScreeningResult } from "@/lib/screening";
import { matchBrief, type BriefPerson } from "@/lib/demand";
import { toDomain } from "@/server/actions/demand";
import { resolveMemberPerson } from "@/server/queries";
import type { Prisma } from "@prisma/client";
import type { TrustPerson } from "@/lib/trust-include";
import { DEFAULT_VOICE, type VoiceSettings } from "@/lib/voice-config";

// ---------- shared helpers (also used by pages) ----------

export async function trustFor(p: TrustPerson): Promise<TrustScore> {
  const freshness = assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate });
  return trustScore({
    vouches: p.vouches.map((v) => ({ wouldRecommend: v.wouldRecommend, external: v.voucherKind === "EXTERNAL" })),
    workedWith: p.relationships.filter((r) => r.workedTogether).length, wouldWorkAgain: p.relationships.filter((r) => r.wouldWorkTogetherAgain === true).length,
    evidence: p.evidence.filter((e) => e.evidenceType !== "CAUTION").length, cautions: p.evidence.filter((e) => e.evidenceType === "CAUTION").length,
    approvedConversations: p.conversations.filter((c) => c.approvalStatus === "APPROVED").length, screened: p.screeningStatus === "APPROVED" || !!p.screenedAt, freshness,
    referralsAccepted: p.referralsMade?.filter((r) => r.status === "ACCEPTED").length ?? 0,
  });
}

export async function fitFor(p: { attributes: Prisma.JsonValue | null; vouches: { attributes: Prisma.JsonValue | null }[] }): Promise<FitProfileRow[]> {
  return fitProfile((p.attributes as FitScores | null) ?? null, p.vouches.map((v) => v.attributes as FitScores | null).filter((a): a is FitScores => !!a));
}

/** The person a member user acts as. Internal users may preview any person of their tenant. */

/** Things that need the owner's attention. */

// ---------- vouches ----------

const vouchSchema = z.object({ personId: z.string(), voucher: z.string(), voucherName: z.string().max(160).optional(), context: z.string().trim().min(2).max(300), statement: z.string().max(1000).optional(), wouldRecommend: z.coerce.boolean().optional() });

export async function createVouch(formData: FormData) {
  const user = await requireUser();
  const d = vouchSchema.parse(Object.fromEntries(formData));
  const person = await prisma.person.findUnique({ where: { id: d.personId } });
  if (!person) throw new Error("Not found");
  if (isInternal(user)) assertSameTenant(user, person.tenantId);
  const attrs: FitScores = {};
  for (const a of ATTRIBUTES) { const v = Number(formData.get(`attr:${a.key}`) || 0); if (v >= 1 && v <= 5) attrs[a.key] = v; }
  const [kind, id] = isMember(user) ? ["PERSON", (await prisma.user.findUnique({ where: { id: user.id }, select: { personId: true } }))?.personId ?? ""] : d.voucher.split(":");
  if (kind === "PERSON" && id === person.id) throw new Error("You cannot vouch for yourself");
  await prisma.vouch.create({ data: { personId: person.id, voucherKind: kind as "USER" | "PERSON" | "EXTERNAL", voucherUserId: kind === "USER" ? id : null, voucherPersonId: kind === "PERSON" ? id : null, voucherName: d.voucherName || null, source: kind === "EXTERNAL" ? "LinkedIn recommendation" : null, context: d.context, statement: d.statement || null, wouldRecommend: d.wouldRecommend ?? false, attributes: Object.keys(attrs).length ? (attrs as Prisma.InputJsonValue) : undefined } });
  await audit({ tenantId: person.tenantId, actorId: user.id, action: "vouch.create", entityType: "Person", entityId: person.id, metadata: { kind, wouldRecommend: d.wouldRecommend ?? false } });
  revalidatePath(`/network/${person.id}`); revalidatePath("/network"); revalidatePath("/member");
}

// ---------- screening ----------

const ALL_QUESTIONS = SCREENING_SCRIPT.flatMap((s) => s.questions);

async function screeningPersonFor(user: SessionUser, personId: string) {
  const p = await prisma.person.findUnique({ where: { id: personId } });
  if (!p) throw new Error("Not found");
  if (isInternal(user)) { assertSameTenant(user, p.tenantId); return p; }
  const me = await resolveMemberPerson(user);
  if (!me || me.id !== p.id) throw new Error("Not permitted");
  return p;
}

/** Start (or resume) a screening. Draft answers live on a SCREENING conversation until the last step. */
export async function startScreening(formData: FormData) {
  const user = await requireUser();
  const p = await screeningPersonFor(user, String(formData.get("personId")));
  const restart = formData.get("restart") === "1";
  let draft = await prisma.conversation.findFirst({ where: { personId: p.id, type: "SCREENING", approvalStatus: "DRAFT" }, orderBy: { createdAt: "desc" } });
  if (draft && restart) { await prisma.conversation.delete({ where: { id: draft.id } }); draft = null; }
  if (!draft) {
    draft = await prisma.conversation.create({ data: { personId: p.id, conductedById: user.id, date: new Date(), type: "SCREENING", approvalStatus: "DRAFT", screening: { answers: {} } as Prisma.InputJsonValue, tags: ["screening"] } });
    if (["NONE", "REGISTERED"].includes(p.screeningStatus) && isInternal(user)) await prisma.person.update({ where: { id: p.id }, data: { screeningStatus: "INVITED" } });
    await audit({ tenantId: p.tenantId, actorId: user.id, action: "screening.start", entityType: "Person", entityId: p.id, metadata: { by: isMember(user) ? "member" : "owner" } });
  }
  redirect(`/screening/${p.id}?c=${draft.id}&step=0`);
}

export async function answerScreening(formData: FormData) {
  const user = await requireUser();
  const conversationId = String(formData.get("conversationId")); const step = Number(formData.get("step") || 0); const nav = String(formData.get("nav") || "next");
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { person: true } });
  if (!conv || conv.type !== "SCREENING" || conv.approvalStatus !== "DRAFT") throw new Error("Screening not found");
  const p = await screeningPersonFor(user, conv.personId);
  const q = ALL_QUESTIONS[step]; if (!q) throw new Error("Bad step");
  const answers = ((conv.screening as { answers?: ScreeningAnswers } | null)?.answers ?? {}) as ScreeningAnswers;
  if (nav !== "back" && nav !== "skip") {
    let value: ScreeningAnswers[string];
    if (q.kind === "multi") value = formData.getAll("a").map(String);
    else if (q.kind === "chips") value = String(formData.get("a") || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    else if (q.kind === "people") { const n = formData.getAll("pn").map(String), c = formData.getAll("pc").map(String), e = formData.getAll("pe").map(String); value = n.map((name, i) => ({ name: name.trim().slice(0, 120), context: (c[i] ?? "").trim().slice(0, 400), email: (e[i] ?? "").trim().slice(0, 200) || undefined })).filter((r) => r.name); }
    else value = String(formData.get("a") ?? "").trim().slice(0, 4000);
    if (q.required && (Array.isArray(value) ? !value.length : !value)) redirect(`/screening/${p.id}?c=${conv.id}&step=${step}&required=1`);
    answers[q.key] = value;
  }
  const last = step >= ALL_QUESTIONS.length - 1;
  if (nav === "back") { await prisma.conversation.update({ where: { id: conv.id }, data: { screening: { answers } as Prisma.InputJsonValue } }); redirect(`/screening/${p.id}?c=${conv.id}&step=${Math.max(0, step - 1)}`); }
  if (!last) { await prisma.conversation.update({ where: { id: conv.id }, data: { screening: { answers } as Prisma.InputJsonValue } }); redirect(`/screening/${p.id}?c=${conv.id}&step=${step + 1}`); }
  // Finish: structure, hand to review, create referrals named in the call.
  const result: ScreeningResult = screeningToResult(answers);
  await prisma.$transaction(async (tx) => {
    await tx.conversation.update({ where: { id: conv.id }, data: { date: new Date(), rawNotes: Object.entries(answers).map(([k, v]) => `${k}: ${Array.isArray(v) ? JSON.stringify(v) : v}`).join("\n"), aiSummary: result.summary as unknown as Prisma.InputJsonValue, screening: { answers, result } as unknown as Prisma.InputJsonValue, approvalStatus: "NEEDS_REVIEW" } });
    await tx.person.update({ where: { id: p.id }, data: { screeningStatus: "SUBMITTED", memberSince: p.memberSince ?? new Date(), attributes: Object.keys(result.attributes).length ? ({ ...((p.attributes as FitScores | null) ?? {}), ...result.attributes } as Prisma.InputJsonValue) : undefined } });
    for (const r of result.referrals) {
      const existing = await tx.person.findFirst({ where: { tenantId: p.tenantId, firstName: { equals: r.name.split(" ")[0], mode: "insensitive" }, lastName: { equals: r.name.split(" ").slice(1).join(" "), mode: "insensitive" } }, select: { id: true } });
      await tx.referral.create({ data: { tenantId: p.tenantId, referrerPersonId: p.id, referredPersonId: existing?.id ?? null, name: r.name, email: r.email ?? null, context: r.context, note: "Named in screening" } });
    }
  });
  await audit({ tenantId: p.tenantId, actorId: user.id, action: "screening.submit", entityType: "Person", entityId: p.id, metadata: { completeness: result.completeness, referrals: result.referrals.length } });
  revalidatePath("/conversations"); revalidatePath(`/network/${p.id}`); revalidatePath("/member"); revalidatePath("/referrals");
  redirect(isMember(user) ? "/member?screened=1" : `/conversations?tab=review&open=${conv.id}`);
}

export async function bookScreening(formData: FormData) {
  const user = await requireUser();
  const p = await screeningPersonFor(user, String(formData.get("personId")));
  const start = new Date(String(formData.get("startAt") || "")); if (Number.isNaN(start.getTime())) throw new Error("Choose a time");
  const owner = isInternal(user) ? user.id : (await prisma.user.findFirst({ where: { tenantId: p.tenantId, role: "OWNER" }, select: { id: true } }))?.id ?? user.id;
  await prisma.scheduledConversation.create({ data: { tenantId: p.tenantId, personId: p.id, ownerId: owner, provider: "MANUAL", startAt: start, endAt: new Date(start.getTime() + 30 * 60_000), meetingType: "SCREENING", status: "SCHEDULED" } });
  await prisma.person.update({ where: { id: p.id }, data: { screeningStatus: "BOOKED", nextAction: "Screening call", nextActionDate: start } });
  await audit({ tenantId: p.tenantId, actorId: user.id, action: "conversation.schedule", entityType: "Person", entityId: p.id, metadata: { meetingType: "SCREENING" } });
  revalidatePath(`/network/${p.id}`); revalidatePath("/member"); revalidatePath("/conversations"); revalidatePath("/referrals");
}

// ---------- member portal: consent, referrals, pitches ----------

export async function setConsent(formData: FormData) {
  const user = await requireUser();
  const p = await screeningPersonFor(user, String(formData.get("personId")));
  const consent = z.enum(["yes", "ask", "no"]).parse(formData.get("referralConsent"));
  await prisma.person.update({ where: { id: p.id }, data: { referralConsent: consent } });
  await audit({ tenantId: p.tenantId, actorId: user.id, action: "consent.update", entityType: "Person", entityId: p.id, metadata: { consent } });
  revalidatePath("/member"); revalidatePath(`/network/${p.id}`);
}

const referSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().max(200).optional(), context: z.string().trim().min(5).max(1000), note: z.string().max(500).optional(), briefId: z.string().optional(), tell: z.coerce.boolean().optional() });

export async function submitReferral(formData: FormData) {
  const user = await requireUser();
  const me = await resolveMemberPerson(user, String(formData.get("asPersonId") || "") || null);
  if (!me) throw new Error("No member profile");
  const d = referSchema.parse(Object.fromEntries(formData));
  const existing = await prisma.person.findFirst({ where: { tenantId: me.tenantId, firstName: { equals: d.name.split(" ")[0], mode: "insensitive" }, lastName: { equals: d.name.split(" ").slice(1).join(" "), mode: "insensitive" } }, select: { id: true } });
  const r = await prisma.referral.create({ data: { tenantId: me.tenantId, referrerPersonId: me.id, referredPersonId: existing?.id ?? null, name: d.name, email: d.email || null, context: d.context, note: [d.note, d.tell ? "May be told who referred them." : "Do not reveal the referrer."].filter(Boolean).join(" "), briefId: d.briefId || null } });
  await audit({ tenantId: me.tenantId, actorId: user.id, action: "referral.create", entityType: "Referral", entityId: r.id, metadata: { referrerPersonId: me.id, briefId: d.briefId || null } });
  revalidatePath("/member"); revalidatePath("/referrals");
  redirect("/member?tab=refer&sent=1");
}

export async function submitPitch(formData: FormData) {
  const user = await requireUser();
  const me = await resolveMemberPerson(user, String(formData.get("asPersonId") || "") || null);
  if (!me) throw new Error("No member profile");
  if (me.screeningStatus !== "APPROVED" && !me.screenedAt) throw new Error("Complete your screening first");
  const brief = await prisma.brief.findUnique({ where: { id: String(formData.get("briefId")) } });
  if (!brief || !brief.openToMembers || brief.tenantId !== me.tenantId) throw new Error("Not open");
  const note = String(formData.get("note") || "").trim().slice(0, 2000); if (note.length < 5) throw new Error("Write a short pitch");
  await prisma.pitch.upsert({ where: { briefId_personId: { briefId: brief.id, personId: me.id } }, create: { briefId: brief.id, personId: me.id, note }, update: { note, status: "SUBMITTED" } });
  await audit({ tenantId: me.tenantId, actorId: user.id, action: "pitch.create", entityType: "Brief", entityId: brief.id, metadata: { personId: me.id } });
  revalidatePath("/member"); revalidatePath("/referrals"); revalidatePath(`/requirements/${brief.id}`);
}

// ---------- owner: triage ----------

export async function triageReferral(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("referralId")); const action = z.enum(["accept", "screen", "decline"]).parse(formData.get("action"));
  const r = await prisma.referral.findUnique({ where: { id }, include: { referrer: true } });
  if (!r) throw new Error("Not found"); assertSameTenant(user, r.tenantId);
  if (action === "decline") { await prisma.referral.update({ where: { id }, data: { status: "DECLINED" } }); }
  else {
    let personId = r.referredPersonId;
    if (!personId) {
      const [firstName, ...rest] = r.name.split(" ");
      const p = await prisma.person.create({ data: { tenantId: r.tenantId, firstName, lastName: rest.join(" ") || "—", email: r.email && /@/.test(r.email) ? r.email : null, availabilityStatus: "NEEDS_REFRESH", screeningStatus: "INVITED", memberSince: new Date(), nextAction: "Screening call", nextActionDate: new Date(Date.now() + 3 * 86_400_000), relationships: { create: { networkOwnerId: user.id, sourceType: "INTRODUCTION", relationshipType: "INTRODUCED", introducedById: r.referrerPersonId, relationshipNotes: `Referred by ${r.referrer.firstName} ${r.referrer.lastName}: ${r.context}`, lastContactDate: new Date() } } } });
      personId = p.id;
      await audit({ tenantId: r.tenantId, actorId: user.id, action: "person.create", entityType: "Person", entityId: p.id, metadata: { via: "referral", referralId: r.id } });
    }
    await prisma.referral.update({ where: { id }, data: { referredPersonId: personId, status: action === "screen" ? "SCREENING" : "ACCEPTED" } });
    if (action === "screen") { revalidatePath("/referrals"); redirect(`/network/${personId}?book=screening`); }
  }
  await audit({ tenantId: r.tenantId, actorId: user.id, action: "referral.update", entityType: "Referral", entityId: id, metadata: { action } });
  revalidatePath("/referrals"); revalidatePath("/network"); revalidatePath("/member");
}

export async function triagePitch(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("pitchId")); const action = z.enum(["shortlist", "decline"]).parse(formData.get("action"));
  const x = await prisma.pitch.findUnique({ where: { id }, include: { brief: true, person: { include: { relationships: true, evidence: true, conversations: { where: { approvalStatus: "APPROVED" }, select: { id: true } }, vouches: true } } } });
  if (!x) throw new Error("Not found"); assertSameTenant(user, x.brief.tenantId);
  if (action === "shortlist") {
    const p = x.person; const d = await toDomain(x.brief);
    const bp: BriefPerson = { id: p.id, capabilities: p.capabilities, sectors: p.sectors, seniority: p.seniority, engagementPreferences: p.engagementPreferences, primaryCity: p.primaryCity, primaryCountry: p.primaryCountry, targetLocations: p.targetLocations, availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate, rateExpectation: p.rateExpectation, salaryExpectation: p.salaryExpectation, relationships: p.relationships.map((r) => ({ relationshipType: r.relationshipType, workedTogether: r.workedTogether, wouldWorkTogetherAgain: r.wouldWorkTogetherAgain, yearsKnown: r.yearsKnown })), evidence: p.evidence.map((e) => ({ evidenceType: e.evidenceType, confidence: e.confidence, context: e.context })), approvedConversations: p.conversations.length, workRights: p.workRights, relocationInterest: p.relocationInterest, attributes: (p.attributes as FitScores | null) ?? null, observedAttributes: p.vouches.map((v) => v.attributes as FitScores | null).filter((a): a is FitScores => !!a) };
    const res = matchBrief(d, [bp], 1)[0];
    await prisma.shortlistItem.upsert({ where: { briefId_personId: { briefId: x.briefId, personId: x.personId } }, create: { briefId: x.briefId, personId: x.personId, fitScore: res?.match.fitScore ?? 50, fitExplanation: res?.match.fitExplanation ?? "Pitched by the member.", dimensions: (res?.match.dimensions ?? []) as unknown as Prisma.InputJsonValue, uncertainty: res?.match.uncertainty ?? [], checks: (res?.checks ?? []) as unknown as Prisma.InputJsonValue, tier: res?.tier ?? "conversation", decision: "SHORTLISTED", note: `Pitched: ${x.note}` }, update: { decision: "SHORTLISTED", note: `Pitched: ${x.note}` } });
  }
  await prisma.pitch.update({ where: { id }, data: { status: action === "shortlist" ? "SHORTLISTED" : "DECLINED" } });
  await audit({ tenantId: x.brief.tenantId, actorId: user.id, action: "pitch.update", entityType: "Brief", entityId: x.briefId, metadata: { personId: x.personId, action } });
  revalidatePath("/referrals"); revalidatePath(`/requirements/${x.briefId}`); revalidatePath("/member");
}

export async function setBriefMembers(formData: FormData) {
  const user = await requireInternalAction();
  const b = await prisma.brief.findUnique({ where: { id: String(formData.get("briefId")) } });
  if (!b) throw new Error("Not found"); assertSameTenant(user, b.tenantId);
  const open = formData.get("openToMembers") === "on";
  await prisma.brief.update({ where: { id: b.id }, data: { openToMembers: open, memberSummary: String(formData.get("memberSummary") || "").trim().slice(0, 1000) || null } });
  await audit({ tenantId: b.tenantId, actorId: user.id, action: "brief.members", entityType: "Brief", entityId: b.id, metadata: { open } });
  revalidatePath(`/requirements/${b.id}`); revalidatePath("/member");
}

// ---------- registration (public) ----------

const registerSchema = z.object({ firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), email: z.string().trim().email().max(200), password: z.string().min(8).max(200), headline: z.string().max(200).optional(), linkedinUrl: z.string().max(300).optional(), referrerId: z.string().min(1), consent: z.coerce.boolean() });

/** A new member registers through a member's invitation. They get a member login and land in their screening. */
export async function registerMember(formData: FormData) {
  const d = registerSchema.parse(Object.fromEntries(formData));
  if (!d.consent) redirect("/join?error=consent");
  const referrer = await prisma.person.findFirst({ where: { id: d.referrerId, memberSince: { not: null } } });
  if (!referrer) redirect("/join?error=referrer");
  const email = d.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) redirect("/join?error=exists");
  const owner = await prisma.user.findFirst({ where: { tenantId: referrer.tenantId, role: "OWNER" }, select: { id: true } });
  const person = await prisma.person.create({ data: { tenantId: referrer.tenantId, firstName: d.firstName, lastName: d.lastName, email, headline: d.headline || null, linkedinUrl: d.linkedinUrl && /^https?:\/\//i.test(d.linkedinUrl) ? d.linkedinUrl : null, availabilityStatus: "NEEDS_REFRESH", screeningStatus: "REGISTERED", referralConsent: "ask", memberSince: new Date(), nextAction: "Screening call", nextActionDate: new Date(Date.now() + 3 * 86_400_000), relationships: owner ? { create: { networkOwnerId: owner.id, sourceType: "INBOUND", relationshipType: "INTRODUCED", introducedById: referrer.id, relationshipNotes: `Registered through ${referrer.firstName} ${referrer.lastName}'s invitation.`, lastContactDate: new Date() } } : undefined } });
  await prisma.user.create({ data: { tenantId: referrer.tenantId, email, name: `${d.firstName} ${d.lastName}`, role: "MEMBER", personId: person.id, passwordHash: await hash(d.password, 10) } });
  await audit({ tenantId: referrer.tenantId, actorId: null, action: "member.register", entityType: "Person", entityId: person.id, metadata: { referrerId: referrer.id } });
  redirect(`/login?registered=1&callbackUrl=${encodeURIComponent("/member?welcome=1")}`);
}

/** Which voice the AI interviewer speaks in. The API key itself never leaves the server environment. */
export async function saveVoiceSettings(formData: FormData) {
  const user = await requireInternalAction();
  const d = z.object({
    provider: z.enum(["device", "elevenlabs"]),
    voiceId: z.string().trim().max(64).optional(),
    agentId: z.string().trim().max(64).optional(),
    modelId: z.string().trim().max(64).optional(),
    stability: z.coerce.number().min(0).max(1).optional(),
    similarity: z.coerce.number().min(0).max(1).optional(),
    style: z.coerce.number().min(0).max(1).optional(),
    speed: z.coerce.number().min(0.5).max(1.5).optional(),
    redactBeforeSpeaking: z.coerce.boolean().optional(),
  }).parse(Object.fromEntries(formData));
  const settings: VoiceSettings = {
    ...DEFAULT_VOICE,
    provider: d.provider,
    voiceId: d.voiceId ?? "",
    agentId: d.agentId || null,
    modelId: d.modelId || DEFAULT_VOICE.modelId,
    stability: d.stability ?? DEFAULT_VOICE.stability,
    similarity: d.similarity ?? DEFAULT_VOICE.similarity,
    style: d.style ?? DEFAULT_VOICE.style,
    speed: d.speed ?? DEFAULT_VOICE.speed,
    redactBeforeSpeaking: d.redactBeforeSpeaking ?? false,
  };
  await prisma.tenant.update({ where: { id: user.tenantId }, data: { voiceSettings: settings as unknown as Prisma.InputJsonValue } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "screening.config", entityType: "Settings", metadata: { provider: settings.provider, redacted: settings.redactBeforeSpeaking } });
  revalidatePath("/settings/screening");
}

