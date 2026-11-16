import { publishWeeklyBrief } from "@/lib/journal";
import { safeEqual } from "@/lib/auth";

// Called by Vercel Cron on Monday mornings (see vercel.json). Two UTC times are scheduled so
// 9am local is hit in both winter and summer time; the run outside 9am local does nothing.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !given || !safeEqual(given, secret)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tz = process.env.JOURNAL_TIMEZONE || "Europe/London";
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now));
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(now);
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && (weekday !== "Mon" || hour !== 9)) return Response.json({ skipped: true, reason: `It is ${weekday} ${hour}:00 in ${tz}` });

  const brief = await publishWeeklyBrief();
  return Response.json({ ok: true, title: brief.title, url: brief.url, priorities: brief.top.length });
}
