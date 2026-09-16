"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireInternalAction, requireUser } from "@/server/session";
import { getSchedulingProvider } from "@/lib/scheduling";
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

export async function toggleMfa(formData: FormData) {
  const user = await requireUser();
  const enabled = formData.get("enabled") === "on";
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: enabled } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "user.role_change", entityType: "User", entityId: user.id, metadata: { mfaEnabled: enabled } });
  revalidatePath("/settings/security");
}
