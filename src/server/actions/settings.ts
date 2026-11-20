"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { z } from "zod";
const PROVIDER = z.enum(["MICROSOFT_GRAPH", "CALENDLY", "MANUAL"]);
import { requireAdminAction, requireInternalAction, requireUser, requireOwnerAction } from "@/server/session";
import { featuresOf, isFeatureKey } from "@/lib/features";
import { rateLimit } from "@/lib/rate-limit";
import { seal, unseal } from "@/lib/secrets";
import { getSchedulingProvider } from "@/lib/scheduling";
import { newSecret, otpauthUri, totpStep, newRecoveryCodes, consumeRecoveryCode } from "@/lib/mfa";
import QRCode from "qrcode";
import type { Role, SchedulingProviderKind } from "@prisma/client";

export async function connectIntegration(formData: FormData) {
  const user = await requireInternalAction();
  const kind = PROVIDER.parse(formData.get("provider")) as SchedulingProviderKind;
  const provider = getSchedulingProvider(kind);
  const { authorizationUrl } = await provider.connect(user.id);
  if (authorizationUrl) redirect(authorizationUrl);
  // Manual, or a provider without live credentials: record the connection so the workflow works end to end.
  await prisma.schedulingConnection.upsert({
    where: { userId_provider: { userId: user.id, provider: kind } },
    create: { userId: user.id, provider: kind, scopes: provider.requestedScopes },
    update: { revokedAt: null, scopes: provider.requestedScopes, connectedAt: new Date() },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "integration.connect", entityType: "SchedulingConnection", metadata: { provider: kind, live: provider.isConfigured() } });
  revalidatePath("/settings/integrations");
}

export async function disconnectIntegration(formData: FormData) {
  const user = await requireInternalAction();
  const kind = PROVIDER.parse(formData.get("provider")) as SchedulingProviderKind;
  await prisma.schedulingConnection.updateMany({ where: { userId: user.id, provider: kind }, data: { revokedAt: new Date(), encryptedCredentialReference: null } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "integration.disconnect", entityType: "SchedulingConnection", metadata: { provider: kind } });
  revalidatePath("/settings/integrations");
}

const INTERNAL = ["OWNER", "ADMIN", "CONTRIBUTOR"] as const;

/** Change a colleague's role. Members, partners and clients are never promoted from here. */
export async function changeUserRole(formData: FormData) {
  const actor = await requireAdminAction();
  const d = z.object({ userId: z.string().min(1).max(40), role: z.enum(INTERNAL) }).parse(Object.fromEntries(formData));
  if (d.userId === actor.id) throw new Error("You cannot change your own role. Ask another owner.");
  const target = await prisma.user.findUnique({ where: { id: d.userId } });
  if (!target || target.tenantId !== actor.tenantId) throw new Error("User not found");
  if (!(INTERNAL as readonly string[]).includes(target.role)) throw new Error("Only internal team members have a role here");
  // Ownership is handed over by an owner, never taken: an admin can neither change an owner nor become one.
  if ((target.role === "OWNER" || d.role === "OWNER") && actor.role !== "OWNER") throw new Error("Only an owner can grant or change the owner role");
  if (target.role === "OWNER" && d.role !== "OWNER" && (await prisma.user.count({ where: { tenantId: actor.tenantId, role: "OWNER" } })) <= 1) throw new Error("There has to be at least one owner");
  if (target.role === d.role) return;
  // The new role applies at once (it is read from the database on every request); bumping the
  // session version also signs the person out so their next sign-in starts clean.
  await prisma.user.update({ where: { id: d.userId }, data: { role: d.role as Role, sessionVersion: { increment: 1 } } });
  await audit({ tenantId: actor.tenantId, actorId: actor.id, action: "user.role_change", entityType: "User", entityId: d.userId, metadata: { from: target.role, to: d.role } });
  revalidatePath("/settings/security");
}

async function mfaThrottle(userId: string) {
  if (!(await rateLimit("signin", `mfa:${userId}`)).success) throw new Error("Too many attempts. Wait a few minutes and try again.");
}

/** Step 1 of enrolment: mint a secret and return what to scan. Nothing about the live sign-in
 *  changes until step 2 succeeds, and an account that already has MFA must turn it off (with a
 *  current code) before enrolling a new device — an open session alone cannot swap the device. */
export async function beginMfaSetup(): Promise<{ secret: string; uri: string; qr: string }> {
  const user = await requireUser();
  await mfaThrottle(user.id);
  const dbu = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, mfaEnabled: true } });
  if (!dbu) throw new Error("Not found");
  if (dbu.mfaEnabled) throw new Error("MFA is already on. Turn it off with a current code before setting up a new device.");
  const secret = newSecret();
  await prisma.user.update({ where: { id: user.id }, data: { mfaPendingSecret: seal("mfa", secret) } });
  const uri = otpauthUri(dbu.email, secret);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 196 });
  return { secret, uri, qr };
}

/** Step 2: verify the first code, turn MFA on, and hand back one-time recovery codes to save. */
export async function confirmMfaSetup(code: string): Promise<{ ok: boolean; recoveryCodes?: string[]; error?: string }> {
  const user = await requireUser();
  await mfaThrottle(user.id);
  const dbu = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, mfaPendingSecret: true, mfaEnabled: true } });
  const secret = unseal("mfa", dbu?.mfaPendingSecret);
  if (!dbu || dbu.mfaEnabled || !secret) return { ok: false, error: "Setup expired. Start again." };
  const step = totpStep(dbu.email, secret, code);
  if (step === null) return { ok: false, error: "That code didn't match. Check the app's clock and try the newest code." };
  const { codes, hashes } = newRecoveryCodes();
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaSecret: seal("mfa", secret), mfaPendingSecret: null, mfaLastStep: step, mfaRecoveryCodes: hashes } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "settings.security", entityType: "User", entityId: user.id, metadata: { mfaEnabled: true } });
  revalidatePath("/settings/security");
  return { ok: true, recoveryCodes: codes };
}

/** Turn MFA off. Requires a current authenticator code or a recovery code, so a walk-up on an open
 *  session can't silently remove it. */
export async function disableMfa(code: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  await mfaThrottle(user.id);
  const dbu = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, mfaSecret: true, mfaRecoveryCodes: true, mfaEnabled: true, mfaLastStep: true } });
  if (!dbu) return { ok: false, error: "Not found" };
  const secret = unseal("mfa", dbu.mfaSecret);
  if (dbu.mfaEnabled && secret) {
    const step = totpStep(dbu.email, secret, code);
    const fresh = step !== null && (dbu.mfaLastStep === null || step > dbu.mfaLastStep);
    if (!fresh && consumeRecoveryCode(code, dbu.mfaRecoveryCodes) === null) return { ok: false, error: "Enter a new code from your authenticator to turn MFA off." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null, mfaPendingSecret: null, mfaLastStep: null, mfaRecoveryCodes: [] } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "settings.security", entityType: "User", entityId: user.id, metadata: { mfaEnabled: false } });
  revalidatePath("/settings/security");
  return { ok: true };
}

// ---------- features ----------

/** Switch one optional feature on or off for the whole network. Owner only, recorded in the audit log. */
export async function setFeature(formData: FormData) {
  const user = await requireOwnerAction();
  const key = formData.get("key"); const on = formData.get("on") === "1";
  if (!isFeatureKey(key)) throw new Error("Unknown feature");
  const t = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { features: true } });
  const next = { ...featuresOf(t?.features), [key]: on };
  await prisma.tenant.update({ where: { id: user.tenantId }, data: { features: next } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "feature.update", entityType: "Tenant", entityId: user.tenantId, metadata: { feature: key, on } });
  revalidatePath("/", "layout");
}
