import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, safeEqual, sessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // API routes authenticate with their own bearer token (CAPTURE_TOKEN).
  if (pathname.startsWith("/api/") || pathname === "/login") return NextResponse.next();

  if (!authEnabled()) {
    if (process.env.NODE_ENV === "production" && process.env.NOTION_TOKEN) {
      return new NextResponse("Set APP_PASSCODE to protect your journal before deploying.", { status: 503 });
    }
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await sessionToken())) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
