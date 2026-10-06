import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { canAccessPath } from "@/lib/authz";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { Role, TenantType } from "@prisma/client";

const { auth } = NextAuth(authConfig);

const isDev = process.env.NODE_ENV !== "production";

/** CSP with a per-request nonce. In production scripts must carry the nonce (no 'unsafe-inline');
 *  'strict-dynamic' lets Next's own nonced loader pull the rest. In development we keep
 *  'unsafe-inline'/'unsafe-eval' so hot-module reloading works. */
function cspFor(nonce: string): string {
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

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

  // A fresh nonce per request; Next reads it from the request's CSP header and stamps its scripts.
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = cspFor(nonce);
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("content-security-policy", csp);
  const withCsp = <T extends NextResponse>(res: T): T => { res.headers.set("content-security-policy", csp); return res; };
  const pass = () => withCsp(NextResponse.next({ request: { headers: reqHeaders } }));

  const user = req.auth?.user as (typeof req.auth extends null ? never : { id: string; tenantId: string; role: Role; tenantType: TenantType }) | undefined;

  if (!user) {
    if (pathname === "/login" || pathname === "/join" || pathname.startsWith("/api/auth") || pathname.startsWith("/api/webhooks") || pathname.startsWith("/api/cron") || pathname === "/api/health") return pass();
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return withCsp(NextResponse.redirect(url));
  }

  if (pathname === "/" || pathname === "/login") {
    const home = user.role === "PARTNER" ? "/partner-portal" : user.role === "CLIENT" ? "/client-workspace" : user.role === "MEMBER" ? "/member" : "/overview";
    return withCsp(NextResponse.redirect(new URL(home, req.nextUrl)));
  }

  // Server-side route authorisation by role (spec §12). Object-level checks happen in server code.
  if (pathname === "/join") return pass();
  if (!pathname.startsWith("/api") && !canAccessPath({ id: user.id, tenantId: user.tenantId, role: user.role, tenantType: user.tenantType }, pathname)) {
    return withCsp(NextResponse.redirect(new URL("/forbidden", req.nextUrl)));
  }
  return pass();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|forbidden|.*\\.(?:svg|png|jpg|ico)).*)"],
};
