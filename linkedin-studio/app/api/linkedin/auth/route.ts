import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { linkedinReady } from "@/lib/env";
import { authorizeUrl } from "@/lib/linkedin-api";

export async function GET() {
  if (!linkedinReady()) return NextResponse.redirect(new URL("/connect?error=missing-config", process.env.APP_URL ?? "http://localhost:3100"));
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("li_state", state, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 600, path: "/" });
  return res;
}
