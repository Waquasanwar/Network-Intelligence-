import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { canAccessPath } from "@/lib/authz";
import type { Role, TenantType } from "@prisma/client";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user as (typeof req.auth extends null ? never : { id: string; tenantId: string; role: Role; tenantType: TenantType }) | undefined;

  if (!user) {
    if (pathname === "/login" || pathname.startsWith("/api/auth") || pathname.startsWith("/api/webhooks") || pathname === "/api/health") return NextResponse.next();
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/" || pathname === "/login") {
    const home = user.role === "PARTNER" ? "/partner-portal" : user.role === "CLIENT" ? "/client-workspace" : "/overview";
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  // Server-side route authorisation by role (spec §12). Object-level checks happen in server code.
  if (!pathname.startsWith("/api") && !canAccessPath({ id: user.id, tenantId: user.tenantId, role: user.role, tenantType: user.tenantType }, pathname)) {
    return NextResponse.redirect(new URL("/forbidden", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|forbidden|.*\\.(?:svg|png|jpg|ico)).*)"],
};
