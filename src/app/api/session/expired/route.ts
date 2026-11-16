import { NextResponse } from "next/server";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Where a request lands when its cookie is still validly signed but the session behind it has been
 * revoked (account removed, role changed, signed out everywhere). Clears the cookie and returns to
 * sign-in. It re-checks first, so following a link here cannot sign out a healthy session.
 */
export async function GET(req: Request) {
  const session = await auth();
  const u = session?.user as { id?: string; sv?: number } | undefined;
  if (u?.id) {
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { sessionVersion: true } });
    if (row && row.sessionVersion === (u.sv ?? 0)) return NextResponse.redirect(new URL("/", req.url));
    await signOut({ redirect: false });
  }
  return NextResponse.redirect(new URL("/login?expired=1", req.url));
}
