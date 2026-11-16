import { NextResponse, type NextRequest } from "next/server";
import { env, notionReady } from "@/lib/env";
import { runSync } from "@/lib/sync";

export const maxDuration = 300;

/** Called daily by Vercel Cron (see vercel.json) or any scheduler with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  const secret = env.cronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!notionReady()) return NextResponse.json({ error: "Notion is not configured" }, { status: 500 });
  const report = await runSync();
  return NextResponse.json(report);
}
