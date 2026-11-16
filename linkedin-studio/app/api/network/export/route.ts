import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { getIcp, listPeople } from "@/lib/notion";
import { rankLeads } from "@/lib/people";

/** CSV of your network or your ranked leads, for a CRM or a spreadsheet. Protected by the app password. */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") === "leads" ? "leads" : "people";
  const people = await listPeople();
  let csv: string;
  if (type === "leads") {
    const leads = rankLeads(people, await getIcp(), 5000);
    csv = toCsv([
      ["Name", "Position", "Company", "Profile URL", "Email", "Seniority", "Function", "Fit", "Warmth", "Score", "Suggested action", "Why", "Status"],
      ...leads.map((l) => [l.person.name, l.person.position, l.person.company, l.person.url, l.person.email, l.person.seniority, l.person.function, l.fit, l.warmth, l.score, l.action, l.reasons.join("; "), l.person.leadStatus]),
    ]);
  } else {
    csv = toCsv([
      ["Name", "Position", "Company", "Profile URL", "Email", "Connected on", "Seniority", "Function", "Engaged count", "Last engaged", "Engaged on", "Watch", "Status"],
      ...people.map((p) => [p.name, p.position, p.company, p.url, p.email, p.connectedOn, p.seniority, p.function, p.engagedCount, p.lastEngaged, p.engagedOn, p.watch ? "yes" : "", p.leadStatus]),
    ]);
  }
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="linkedin-${type}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
