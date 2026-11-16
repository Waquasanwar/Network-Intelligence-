import { loadAll } from "@/lib/journal";
import { weeklyBrief } from "@/lib/planning";
import { todayIn } from "@/lib/parse";
import { apiAuthorized, unauthorized } from "@/lib/api-auth";

// GET /api/brief   Authorization: Bearer <CAPTURE_TOKEN>
// This week's priorities as Markdown (default) or JSON (?format=json), for Shortcuts or email.
export async function GET(req: Request) {
  if (!apiAuthorized(req)) return unauthorized();
  const { entries, people, projects } = await loadAll();
  const brief = weeklyBrief(entries, projects, people, todayIn(process.env.JOURNAL_TIMEZONE || "UTC"));
  if (new URL(req.url).searchParams.get("format") === "json") return Response.json({ title: brief.title, sections: brief.sections });
  const md = [`# ${brief.title}`, ...brief.sections.flatMap((s) => ["", `## ${s.heading}`, ...(s.items.length ? s.items.map((i) => `- [ ] ${i}`) : ["- Nothing here"])])].join("\n");
  return new Response(md, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
