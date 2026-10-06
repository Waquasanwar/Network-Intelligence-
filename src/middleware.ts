import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { canAccessPath } from "@/lib/authz";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { Role, TenantType } from "@prisma/client";

const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Throttle sign-in before anything else: credential stuffing and brute force hit this one POST.
  if (req.method === "POST" && pathname.startsWith("/api/auth/callback/credentials")) {
    const { success, resetMs } = await rateLimit("signin", clientIp(req.headers));
    if (!success) {
      const retry = Math.ceil(resetMs / 1000);
      return new NextResponse("Too many sign-in attempts. Please wait a few minutes and try again.", {
        status: 429,
        headers: { "Retry-After": String(retry), "Content-Type": "text/plain" },
      });
    }
  }

  const user = req.auth?.user as (typeof req.auth extends null ? never : { id: string; tenantId: string; role: Role; tenantType: TenantType }) | undefined;

  if (!user) {
    if (pathname === "/login" || pathname === "/join" || pathname.startsWith("/api/auth") || pathname.startsWith("/api/webhooks") || pathname.startsWith("/api/cron") || pathname === "/api/health") return NextResponse.next();
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/" || pathname === "/login") {
    const home = user.role === "PARTNER" ? "/partner-portal" : user.role === "CLIENT" ? "/client-workspace" : user.role === "MEMBER" ? "/member" : "/overview";
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  // Server-side route authorisation by role (spec §12). Object-level checks happen in server code.
  if (pathname === "/join") return NextResponse.next();
  if (!pathname.startsWith("/api") && !canAccessPath({ id: user.id, tenantId: user.tenantId, role: user.role, tenantType: user.tenantType }, pathname)) {
    return NextResponse.redirect(new URL("/forbidden", req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|forbidden|.*\\.(?:svg|png|jpg|ico)).*)"],
};
