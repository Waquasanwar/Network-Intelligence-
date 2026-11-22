"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { limitOrThrow } from "@/lib/rate-limit";
import { requireUser } from "@/server/session";
import { resolveMemberPerson } from "@/server/queries";
import { CONSENTS, privacyOf, type Consents, type ConsentKey, type Privacy } from "@/lib/privacy";
import { isInternal } from "@/lib/authz";
import { requireInternalAction } from "@/server/session";
import { storePhoto, discardPhoto, looksLikeJpeg, MAX_PHOTO_BYTES } from "@/server/photos";

/**
 * A member's own control over their data — the GDPR / UAE PDPL rights made real for the person,
 * not just the owner. Export it, change what we may do with it, or ask to be deleted. Every one of
 * these is the member acting on their own profile; an internal user may act on a member's behalf
 * by passing that person's id (the same preview pattern the member portal already uses).
 */

/** The member (or an internal user previewing a specific member) whose profile this acts on. */
async function selfPerson(user: Awaited<ReturnType<typeof requireUser>>, asPersonId?: string | null) {
  const me = await resolveMemberPerson(user, asPersonId ?? null);
  if (!me) throw new Error("No member profile to act on.");
  return me;
}

function writePrivacy(current: Privacy, patch: Partial<Privacy>): Prisma.InputJsonValue {
  return { ...current, ...patch, consents: { ...current.consents, ...(patch.consents ?? {}) } } as unknown as Prisma.InputJsonValue;
}

/**
 * A machine-readable copy of what we hold about this person — their right to portability.
 *
 * What a member downloads for themselves is their own data: their profile, what they told us, the
 * vouches given for them, where they have been put forward, and their own referrals and pitches.
 * It does not include the team's private working notes or anything recorded in confidence by
 * someone else (a caution, a reference). Those are released through a reviewed request to the
 * network, where each can be checked for other people's information first — the export says so.
 */
export async function exportMyData(asPersonId?: string): Promise<string> {
  const user = await requireUser();
  const me = await selfPerson(user, typeof asPersonId === "string" ? asPersonId : null);
  await limitOrThrow("mutate", `export:${user.id}`);
  const person = await prisma.person.findUnique({
    where: { id: me.id },
    include: {
      relationships: { select: { relationshipType: true, sourceType: true, workedTogether: true, yearsKnown: true, lastContactDate: true, createdAt: true } },
      evidence: { where: { evidenceType: { not: "CAUTION" }, visibility: { not: "PRIVATE" } }, select: { evidenceType: true, context: true, description: true, createdAt: true } },
      conversations: { where: { approvalStatus: { in: ["APPROVED", "NEEDS_REVIEW", "DRAFT"] }, type: "SCREENING" }, select: { date: true, type: true, screening: true, approvalStatus: true } },
      vouches: { select: { context: true, statement: true, wouldRecommend: true, voucherKind: true, createdAt: true } },
      referralsMade: { select: { name: true, email: true, context: true, note: true, status: true, createdAt: true } },
      pitches: { select: { note: true, status: true, createdAt: true, brief: { select: { memberSummary: true, engagementRoute: true } } } },
      shortlistItems: { select: { decision: true, createdAt: true, brief: { select: { engagementRoute: true, locations: true } } } },
      relocationProfile: true,
    },
  });
  if (!person) throw new Error("Not found");
  await audit({ tenantId: me.tenantId, actorId: user.id, action: "person.export", entityType: "Person", entityId: me.id, metadata: { self: true } });
  // Internal fields that are not the person's own data to take away.
  const { tenantId: _t, id: _i, nextAction: _n, nextActionDate: _d, amanaBench: _a, usedByAmana: _u, ...profile } = person;
  void _t; void _i; void _n; void _d; void _a; void _u;
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    about: "Your profile, what you told us, vouches given for you, where you have been put forward, and your own referrals and pitches. Notes the team keeps for its own work, and anything given to us in confidence by someone else, are not in this file. Ask us and we will review and send what you are entitled to within 30 days.",
    person: profile,
  }, null, 2);
}

/** Turn individual permissions on or off. Withdrawal is immediate and as easy as giving it. */
export async function updateMyConsents(formData: FormData) {
  const user = await requireUser();
  const me = await selfPerson(user, String(formData.get("asPersonId") || "") || null);
  const current = privacyOf({ privacy: me.privacy as Partial<Privacy> | null });
  const next: Consents = { ...current.consents };
  for (const c of CONSENTS) {
    if (c.required) { next[c.key] = true; continue; } // "Be in the network" cannot be switched off here — that is erasure.
    next[c.key] = formData.get(c.key as string) === "on";
  }
  const hideRateBand = formData.get("hideRateBand") === "on";
  const hideRegion = formData.get("hideRegion") === "on";
  // Switching the photo off deletes it, as the consent promises.
  const dropPhoto = !next.showPhoto && !!me.photoUrl;
  await prisma.person.update({
    where: { id: me.id },
    data: { privacy: writePrivacy(current, { consents: next, hideRateBand, hideRegion, reviewedAt: new Date().toISOString() }), ...(dropPhoto ? { photoUrl: null } : {}) },
  });
  if (dropPhoto) await discardPhoto(me.photoUrl);
  await audit({ tenantId: me.tenantId, actorId: user.id, action: "consent.update", entityType: "Person", entityId: me.id, metadata: { on: (Object.keys(next) as ConsentKey[]).filter((k) => next[k]).length } });
  revalidatePath("/member"); revalidatePath("/settings/privacy"); revalidatePath(`/network/${me.id}`);
}

const erasureSchema = z.object({ asPersonId: z.string().optional(), reason: z.string().max(500).optional(), confirm: z.string() });

/**
 * The member asks to be deleted. We record the request with a timestamp — from that moment the
 * person stops being shown anywhere (canShareAnonymised / canRevealName both refuse once this is
 * set) and the owner's retention queue lists the profile for deletion. Destructive deletion stays a
 * reviewed step so the legally-required fee and audit records can be anonymised rather than lost.
 */
export async function requestMyErasure(formData: FormData) {
  const user = await requireUser();
  const d = erasureSchema.parse(Object.fromEntries(formData));
  if (d.confirm !== "DELETE") throw new Error("Type DELETE to confirm.");
  const me = await selfPerson(user, d.asPersonId || null);
  const current = privacyOf({ privacy: me.privacy as Partial<Privacy> | null });
  await prisma.person.update({
    where: { id: me.id },
    data: { privacy: writePrivacy(current, { erasureRequestedAt: new Date().toISOString() }), referralConsent: "no", photoUrl: null },
  });
  await discardPhoto(me.photoUrl); // a photo goes at once; it is never needed for the records that must be kept
  // Their open invitations stop working too: nobody should be joining on the word of someone leaving.
  await prisma.invite.updateMany({ where: { inviterPersonId: me.id, status: { in: ["SENT", "OPENED"] } }, data: { status: "REVOKED" } });
  await audit({ tenantId: me.tenantId, actorId: user.id, action: "data.deletion_request", entityType: "Person", entityId: me.id, metadata: { self: true, reason: d.reason ?? null } });
  revalidatePath("/member"); revalidatePath("/settings/privacy"); revalidatePath("/settings/security"); revalidatePath(`/network/${me.id}`);
}

/** Change of mind before the deletion is carried out — the request is withdrawn. */
export async function cancelMyErasure(formData: FormData) {
  const user = await requireUser();
  const me = await selfPerson(user, String(formData.get("asPersonId") || "") || null);
  const current = privacyOf({ privacy: me.privacy as Partial<Privacy> | null });
  // The request switched "put me forward" off. Coming back means "ask me each time", the safe default.
  await prisma.person.update({ where: { id: me.id }, data: { privacy: writePrivacy(current, { erasureRequestedAt: null }), ...(me.referralConsent === "no" ? { referralConsent: "ask" } : {}) } });
  await audit({ tenantId: me.tenantId, actorId: user.id, action: "consent.update", entityType: "Person", entityId: me.id, metadata: { erasureCancelled: true } });
  revalidatePath("/member"); revalidatePath("/settings/privacy"); revalidatePath(`/network/${me.id}`);
}

/**
 * A member adds their own photo. Only the person themselves can: nobody else puts a face to a name.
 * The browser sends a small square JPEG it made; adding it is also the consent to show it, inside
 * the network only, and it can be removed (and is deleted) at any time.
 */
export async function setMyPhoto(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (isInternal(user)) return { ok: false, error: "Only the member can add their own photo." };
  const me = await selfPerson(user, null);
  await limitOrThrow("mutate", `photo:${user.id}`);
  const file = formData.get("photo");
  if (!(file instanceof Blob) || file.size === 0) return { ok: false, error: "Choose a photo first." };
  if (file.size > MAX_PHOTO_BYTES || file.type !== "image/jpeg") return { ok: false, error: "That photo could not be used. Try a different one." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeJpeg(bytes)) return { ok: false, error: "That photo could not be used. Try a different one." };
  const url = await storePhoto(me.id, bytes);
  const current = privacyOf({ privacy: me.privacy as Partial<Privacy> | null });
  await prisma.person.update({ where: { id: me.id }, data: { photoUrl: url, privacy: writePrivacy(current, { consents: { ...current.consents, showPhoto: true } }) } });
  await discardPhoto(me.photoUrl);
  await audit({ tenantId: me.tenantId, actorId: user.id, action: "photo.set", entityType: "Person", entityId: me.id });
  revalidatePath("/member"); revalidatePath("/community"); revalidatePath(`/network/${me.id}`);
  return { ok: true };
}

/** The member removes their photo. It is deleted, and they show as their initials again. */
export async function removeMyPhoto() {
  const user = await requireUser();
  if (isInternal(user)) return;
  const me = await selfPerson(user, null);
  const current = privacyOf({ privacy: me.privacy as Partial<Privacy> | null });
  await prisma.person.update({ where: { id: me.id }, data: { photoUrl: null, privacy: writePrivacy(current, { consents: { ...current.consents, showPhoto: false } }) } });
  await discardPhoto(me.photoUrl);
  await audit({ tenantId: me.tenantId, actorId: user.id, action: "photo.remove", entityType: "Person", entityId: me.id, metadata: { self: true } });
  revalidatePath("/member"); revalidatePath("/community"); revalidatePath(`/network/${me.id}`);
}

/** The team takes down a member's photo (it is not right for a professional network). */
export async function removePersonPhoto(formData: FormData) {
  const user = await requireInternalAction();
  const personId = String(formData.get("personId") ?? "");
  const p = await prisma.person.findFirst({ where: { id: personId, tenantId: user.tenantId }, select: { id: true, tenantId: true, photoUrl: true } });
  if (!p?.photoUrl) return;
  await prisma.person.update({ where: { id: p.id }, data: { photoUrl: null } });
  await discardPhoto(p.photoUrl);
  await audit({ tenantId: p.tenantId, actorId: user.id, action: "photo.remove", entityType: "Person", entityId: p.id, metadata: { self: false } });
  revalidatePath(`/network/${p.id}`); revalidatePath("/community");
}
