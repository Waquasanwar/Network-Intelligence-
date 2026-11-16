import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { exchangeCode } from "@/lib/linkedin-api";

export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/connect?${q}`, env.appUrl()));
  const { searchParams } = req.nextUrl;
  const error = searchParams.get("error_description") ?? searchParams.get("error");
  if (error) return back(`error=${encodeURIComponent(error)}`);
  const state = searchParams.get("state");
  if (!state || state !== req.cookies.get("li_state")?.value) return back("error=state-mismatch");
  try {
    await exchangeCode(searchParams.get("code") ?? "");
  } catch (e) {
    return back(`error=${encodeURIComponent(e instanceof Error ? e.message : "LinkedIn sign-in failed")}`);
  }
  const res = back("connected=1");
  res.cookies.delete("li_state");
  return res;
}
