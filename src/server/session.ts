import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Role, TenantType } from "@prisma/client";
import { type Actor, AuthorizationError, assertInternal, isInternal } from "@/lib/authz";

export type SessionUser = Actor & { email: string; name: string; tenantName: string };

/** Resolve the current actor. Redirects to /login when unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const u = session?.user as (typeof session extends null ? never : { id: string; email: string; name: string; tenantId: string; role: Role; tenantType: TenantType; tenantName: string }) | undefined;
  if (!u?.id) redirect("/login");
  return { id: u.id, email: u.email, name: u.name, tenantId: u.tenantId, role: u.role, tenantType: u.tenantType, tenantName: u.tenantName };
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
