"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/server/session";
import { resolveMemberPerson } from "@/server/queries";
import { CONSENTS, privacyOf, type Consents, type ConsentKey, type Privacy } from "@/lib/privacy";

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

/** A machine-readable copy of everything we hold about this person — their right to portability. */
export async function exportMyData(asPersonId?: string): Promise<string> {
  const user = await requireUser();
  const me = await selfPerson(user, asPersonId);
  const person = await prisma.person.findUnique({
    where: { id: me.id },
    include: { relationships: true, evidence: true, conversations: true, vouches: true, referralsMade: true, pitches: true, relocationProfile: true },
  });
  if (!person) throw new Error("Not found");
  await audit({ tenantId: me.tenantId, actorId: user.id, action: "person.export", entityType: "Person", entityId: me.id, metadata: { self: true } });
  return JSON.stringify({ exportedAt: new Date().toISOString(), person }, null, 2);
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
  await prisma.person.update({
    where: { id: me.id },
    data: { privacy: writePrivacy(current, { consents: next, hideRateBand, hideRegion, reviewedAt: new Date().toISOString() }) },
  });
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
    data: { privacy: writePrivacy(current, { erasureRequestedAt: new Date().toISOString() }), referralConsent: "no" },
  });
  await audit({ tenantId: me.tenantId, actorId: user.id, action: "data.deletion_request", entityType: "Person", entityId: me.id, metadata: { self: true, reason: d.reason ?? null } });
  revalidatePath("/member"); revalidatePath("/settings/privacy"); revalidatePath("/settings/security"); revalidatePath(`/network/${me.id}`);
}

/** Change of mind before the deletion is carried out — the request is withdrawn. */
export async function cancelMyErasure(formData: FormData) {
  const user = await requireUser();
  const me = await selfPerson(user, String(formData.get("asPersonId") || "") || null);
  const current = privacyOf({ privacy: me.privacy as Partial<Privacy> | null });
  await prisma.person.update({ where: { id: me.id }, data: { privacy: writePrivacy(current, { erasureRequestedAt: null }) } });
  await audit({ tenantId: me.tenantId, actorId: user.id, action: "consent.update", entityType: "Person", entityId: me.id, metadata: { erasureCancelled: true } });
  revalidatePath("/member"); revalidatePath("/settings/privacy"); revalidatePath(`/network/${me.id}`);
}
