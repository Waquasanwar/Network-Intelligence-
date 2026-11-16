"use server";
import { signOut } from "@/auth";
import { audit } from "@/lib/audit";
import { getUser } from "@/server/session";

/** Sign out of this device. Runs as a server action, so it is protected against cross-site requests. */
export async function signOutAction() {
  const user = await getUser();
  if (user) await audit({ tenantId: user.tenantId, actorId: user.id, action: "auth.logout", entityType: "User", entityId: user.id });
  await signOut({ redirectTo: "/login" });
}
