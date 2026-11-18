"use server";
import { z } from "zod";
import { AUTO_ACCEPT_COMPLETENESS, screeningProfileUpdate } from "@/server/screening-apply";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { limitOrThrow } from "@/lib/rate-limit";
import { requireAdminAction, requireInternalAction, requireUser, type SessionUser } from "@/server/session";
import { assertSameTenant, isInternal, isMember } from "@/lib/authz";
import { ATTRIBUTES, type FitScores } from "@/lib/fit";
import { suggestNextCheck } from "@/lib/availability";
import { SCREENING_SCRIPT, screeningToResult, type ScreeningAnswers, type ScreeningResult } from "@/lib/screening";
import { matchBrief, type BriefPerson } from "@/lib/demand";
import { toDomain } from "@/lib/brief-domain";
import { resolveMemberPerson } from "@/server/queries";
import type { Prisma } from "@prisma/client";
import { DEFAULT_VOICE, type VoiceSettings } from "@/lib/voice-config";

// ---------- vouches ----------

const vouchSchema = z.object({ personId: z.string().min(1).max(40), voucher: z.string().max(60).optional(), voucherName: z.string().trim().max(160).optional(), context: z.string().trim().min(2).max(300), statement: z.string().trim().max(1000).optional(), wouldRecommend: z.coerce.boolean().optional() });

/**
 * Vouch for someone. A member vouches as themselves, for someone in their own network. The
 * internal team can also record a vouch given by a colleague, by another member, or by someone
 * outside (a named reference) — but only ever by a real user or person of this same tenant.
 */
export async function createVouch(formData: FormData) {
  const user = await requireUser();
  const d = vouchSchema.parse(Object.fromEntries(formData));
  const person = await prisma.person.findUnique({ where: { id: d.personId } });
  if (!person) throw new Error("Not found");
  let kind: "USER" | "PERSON" | "EXTERNAL", voucherUserId: string | null = null, voucherPersonId: string | null = null;
  if (isInternal(user)) {
    assertSameTenant(user, person.tenantId);
    const [k, id] = (d.voucher ?? `USER:${user.id}`).split(":");
    if (k === "USER") { if (!id || !(await prisma.user.findFirst({ where: { id, tenantId: user.tenantId, role: { in: ["OWNER", "ADMIN", "CONTRIBUTOR"] } }, select: { id: true } }))) throw new Error("Choose who is vouching"); kind = "USER"; voucherUserId = id; }
    else if (k === "PERSON") { if (!id || !(await prisma.person.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } }))) throw new Error("Choose who is vouching"); kind = "PERSON"; voucherPersonId = id; }
    else if (k === "EXTERNAL") { if (!d.voucherName) throw new Error("Name the person giving the reference"); kind = "EXTERNAL"; }
    else throw new Error("Choose who is vouching");
  } else {
    const me = await resolveMemberPerson(user);
    if (!me || me.tenantId !== person.tenantId) throw new Error("Not permitted");
    kind = "PERSON"; voucherPersonId = me.id;
  }
  if (kind === "PERSON" && voucherPersonId === person.id) throw new Error("You cannot vouch for yourself");
  const attrs: FitScores = {};
  for (const a of ATTRIBUTES) { const v = Number(formData.get(`attr:${a.key}`) || 0); if (Number.isInteger(v) && v >= 1 && v <= 5) attrs[a.key] = v; }
  await prisma.vouch.create({ data: { personId: person.id, voucherKind: kind, voucherUserId, voucherPersonId, voucherName: kind === "EXTERNAL" ? d.voucherName || null : null, source: kind === "EXTERNAL" ? "LinkedIn recommendation" : null, context: d.context, statement: d.statement || null, wouldRecommend: d.wouldRecommend ?? false, attributes: Object.keys(attrs).length ? (attrs as Prisma.InputJsonValue) : undefined } });
  await audit({ tenantId: person.tenantId, actorId: user.id, action: "vouch.create", entityType: "Person", entityId: person.id, metadata: { kind, wouldRecommend: d.wouldRecommend ?? false } });
  revalidatePath(`/network/${person.id}`); revalidatePath("/network"); revalidatePath("/member");
}

// ---------- availability ----------

/** The statuses a person can set for themselves in one tap. Anything needing a date goes through the team. */
const SELF_STATUSES = ["AVAILABLE_NOW", "OPEN_TO_CONVERSATIONS", "QUIETLY_EXPLORING", "RIGHT_OPPORTUNITY_ONLY", "FINISHING_ENGAGEMENT_SOON", "FRACTIONAL_AVAILABILITY", "HAPPY_WHERE_I_AM", "NOT_LOOKING_KEEP_IN_TOUCH", "TAKING_A_BREAK"] as const;

/**
 * A member says where they stand, themselves. It is the freshest source there is, and it keeps the
 * "Up to date" proof without anybody on the team having to ask.
 */
export async function confirmMyAvailability(formData: FormData) {
  const user = await requireUser();
  const p = await screeningPersonFor(user, String(formData.get("personId") || ""));
  const status = z.enum(SELF_STATUSES).parse(formData.get("status"));
  const now = new Date();
  await prisma.person.update({ where: { id: p.id }, data: { availabilityStatus: status, availabilityConfirmedAt: now, availabilitySource: isInternal(user) ? "manual" : "self", availabilityConfidence: 90, nextCheckDate: suggestNextCheck(status, now) } });
  await audit({ tenantId: p.tenantId, actorId: user.id, action: "person.update", entityType: "Person", entityId: p.id, metadata: { field: "availability", status, by: isInternal(user) ? "team" : "self" } });
  revalidatePath("/member"); revalidatePath(`/network/${p.id}`); revalidatePath("/network");
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
  // The owner may let complete screenings through without reading each one. Incomplete ones, and
  // every screening while the setting is off, wait for a person exactly as before.
  const tenant = await prisma.tenant.findUnique({ where: { id: p.tenantId }, select: { screeningAutoAccept: true } });
  const auto = !!tenant?.screeningAutoAccept && result.completeness >= AUTO_ACCEPT_COMPLETENESS;
  if (auto) {
    const when = new Date();
    await prisma.$transaction([
      prisma.conversation.update({ where: { id: conv.id }, data: { approvalStatus: "APPROVED", approvedById: null, approvedSummary: result.summary as unknown as Prisma.InputJsonValue } }),
      prisma.person.update({ where: { id: p.id }, data: screeningProfileUpdate({ ...p, memberSince: p.memberSince ?? when }, result, when) }),
    ]);
  }
  await audit({ tenantId: p.tenantId, actorId: user.id, action: auto ? "screening.auto_accept" : "screening.submit", entityType: "Person", entityId: p.id, metadata: { completeness: result.completeness, referrals: result.referrals.length } });
  revalidatePath("/conversations"); revalidatePath(`/network/${p.id}`); revalidatePath("/member"); revalidatePath("/referrals");
  redirect(isMember(user) ? "/member?screened=1" : auto ? `/network/${p.id}` : `/conversations?tab=review&open=${conv.id}`);
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

const referSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().max(200).optional(), context: z.string().trim().min(5).max(1000), note: z.string().max(500).optional(), briefId: z.string().optional(), tell: z.coerce.boolean().optional() });

export async function submitReferral(formData: FormData) {
  const user = await requireUser();
  const me = await resolveMemberPerson(user, String(formData.get("asPersonId") || "") || null);
  if (!me) throw new Error("No member profile");
  const d = referSchema.parse(Object.fromEntries(formData));
  await limitOrThrow("mutate", `refer:${user.id}`);
  // A referral can be attached to a requirement only if it is this network's and open to members.
  if (d.briefId && !(await prisma.brief.findFirst({ where: { id: d.briefId, tenantId: me.tenantId, ...(isInternal(user) ? {} : { openToMembers: true }) }, select: { id: true } }))) throw new Error("That opportunity is not open");
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
    const p = x.person; const d = toDomain(x.brief);
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
  const summary = String(formData.get("memberSummary") || "").trim().slice(0, 1000) || null;
  // Members only ever read the summary written for them, never the client's own words. Without
  // one, the requirement stays closed to members.
  const open = formData.get("openToMembers") === "on" && !!summary;
  await prisma.brief.update({ where: { id: b.id }, data: { openToMembers: open, memberSummary: summary } });
  await audit({ tenantId: b.tenantId, actorId: user.id, action: "brief.members", entityType: "Brief", entityId: b.id, metadata: { open } });
  revalidatePath(`/requirements/${b.id}`); revalidatePath("/member");
  if (formData.get("openToMembers") === "on" && !summary) redirect(`/requirements/${b.id}?notice=member-summary`);
}

/** Whether a complete screening is accepted without a person reading it first. The owner's call. */
export async function saveScreeningReview(formData: FormData) {
  const user = await requireAdminAction();
  const on = formData.get("autoAccept") === "on";
  await prisma.tenant.update({ where: { id: user.tenantId }, data: { screeningAutoAccept: on } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "settings.screening", entityType: "Tenant", entityId: user.tenantId, metadata: { screeningAutoAccept: on } });
  revalidatePath("/settings/screening");
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

