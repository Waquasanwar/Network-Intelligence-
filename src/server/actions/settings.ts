"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireInternalAction, requireUser } from "@/server/session";
import { getSchedulingProvider } from "@/lib/scheduling";
import { newSecret, otpauthUri, verifyTotp, newRecoveryCodes, consumeRecoveryCode } from "@/lib/mfa";
import QRCode from "qrcode";
import type { Role, SchedulingProviderKind } from "@prisma/client";

export async function connectIntegration(formData: FormData) {
  const user = await requireInternalAction();
  const kind = String(formData.get("provider")) as SchedulingProviderKind;
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
  const kind = String(formData.get("provider")) as SchedulingProviderKind;
  await prisma.schedulingConnection.updateMany({ where: { userId: user.id, provider: kind }, data: { revokedAt: new Date(), encryptedCredentialReference: null } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "integration.disconnect", entityType: "SchedulingConnection", metadata: { provider: kind } });
  revalidatePath("/settings/integrations");
}

export async function changeUserRole(formData: FormData) {
  const actor = await requireInternalAction();
  if (actor.role !== "OWNER" && actor.role !== "ADMIN") throw new Error("Not permitted");
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role")) as Role;
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.tenantId !== actor.tenantId) throw new Error("User not found");
  if (target.role === "OWNER" && actor.role !== "OWNER") throw new Error("Only the owner can change the owner's role");
  if (!["OWNER", "ADMIN", "CONTRIBUTOR"].includes(role)) throw new Error("Invalid role for this tenant");
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await audit({ tenantId: actor.tenantId, actorId: actor.id, action: "user.role_change", entityType: "User", entityId: userId, metadata: { from: target.role, to: role } });
  revalidatePath("/settings/security");
}

/** Step 1 of enrolment: mint a secret, store it (not yet active), and return what to scan. */
export async function beginMfaSetup(): Promise<{ secret: string; uri: string; qr: string }> {
  const user = await requireUser();
  const dbu = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
  const secret = newSecret();
  await prisma.user.update({ where: { id: user.id }, data: { mfaSecret: secret } });
  const uri = otpauthUri(dbu!.email, secret);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 196 });
  return { secret, uri, qr };
}

/** Step 2: verify the first code, turn MFA on, and hand back one-time recovery codes to save. */
export async function confirmMfaSetup(code: string): Promise<{ ok: boolean; recoveryCodes?: string[]; error?: string }> {
  const user = await requireUser();
  const dbu = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, mfaSecret: true } });
  if (!dbu?.mfaSecret) return { ok: false, error: "Setup expired. Start again." };
  if (!verifyTotp(dbu.email, dbu.mfaSecret, code)) return { ok: false, error: "That code didn't match. Check the app's clock and try the newest code." };
  const { codes, hashes } = newRecoveryCodes();
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaRecoveryCodes: hashes } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "settings.security", entityType: "User", entityId: user.id, metadata: { mfaEnabled: true } });
  revalidatePath("/settings/security");
  return { ok: true, recoveryCodes: codes };
}

/** Turn MFA off. Requires a current authenticator code or a recovery code, so a walk-up on an open
 *  session can't silently remove it. */
export async function disableMfa(code: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const dbu = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, mfaSecret: true, mfaRecoveryCodes: true, mfaEnabled: true } });
  if (!dbu?.mfaEnabled || !dbu.mfaSecret) {
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: [] } });
    revalidatePath("/settings/security");
    return { ok: true };
  }
  const ok = verifyTotp(dbu.email, dbu.mfaSecret, code) || consumeRecoveryCode(code, dbu.mfaRecoveryCodes) !== null;
  if (!ok) return { ok: false, error: "Enter a current code from your authenticator to turn MFA off." };
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: [] } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "settings.security", entityType: "User", entityId: user.id, metadata: { mfaEnabled: false } });
  revalidatePath("/settings/security");
  return { ok: true };
}
