import { cache } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Role, TenantType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { type Actor, AuthorizationError, assertInternal, isInternal } from "@/lib/authz";

export type SessionUser = Actor & { email: string; name: string; tenantName: string };

/**
 * The signed cookie says who signed in; the database says whether that is still true. Once per
 * request we re-read the user so that a deleted account, a changed role or a "sign out everywhere"
 * (User.sessionVersion) takes effect immediately instead of at the end of the 8-hour cookie.
 * Role and tenant are taken from the database, never from the cookie.
 */
const currentUser = cache(async (): Promise<SessionUser | "expired" | null> => {
  const session = await auth();
  const u = session?.user as { id?: string; sv?: number } | undefined;
  if (!u?.id) return null;
  const row = await prisma.user.findUnique({
    where: { id: u.id },
    select: { id: true, email: true, name: true, role: true, tenantId: true, sessionVersion: true, tenant: { select: { type: true, name: true, brandName: true } } },
  });
  if (!row || row.sessionVersion !== (u.sv ?? 0)) return "expired";
  return { id: row.id, email: row.email, name: row.name, tenantId: row.tenantId, role: row.role as Role, tenantType: row.tenant.type as TenantType, tenantName: row.tenant.brandName ?? row.tenant.name };
});

/** Resolve the current actor. Redirects to /login when unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (user === "expired") redirect("/api/session/expired");
  if (!user) redirect("/login");
  return user;
}

/** The current actor, or null — for route handlers that answer with a status code instead of a redirect. */
export async function getUser(): Promise<SessionUser | null> {
  const user = await currentUser();
  return user && user !== "expired" ? user : null;
}

/** For pages and actions that only internal users (owner / admin / contributor) may reach. */
export async function requireInternal(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isInternal(user)) redirect("/forbidden");
  return user;
}

/** Same as requireInternal but throws (for server actions called from forms). */
export async function requireInternalAction(): Promise<SessionUser> {
  const user = await requireUser();
  try {
    assertInternal(user);
  } catch (e) {
    if (e instanceof AuthorizationError) throw e;
    throw new AuthorizationError();
  }
  return user;
}

/** Owner or admin of an internal tenant: commercial terms, roles, exports, identity reveals. */
export async function requireAdminAction(): Promise<SessionUser> {
  const user = await requireInternalAction();
  if (user.role !== "OWNER" && user.role !== "ADMIN") throw new AuthorizationError("Owner or admin access required");
  return user;
}

/** The owner alone: fees, commercial terms and the rate card. */
export async function requireOwnerAction(): Promise<SessionUser> {
  const user = await requireInternalAction();
  if (user.role !== "OWNER") throw new AuthorizationError("Only the owner can see or change fees and commercial terms");
  return user;
}

/** Sign every device of this user out. The caller's own cookie stops working on its next request too. */
export async function revokeSessions(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}
