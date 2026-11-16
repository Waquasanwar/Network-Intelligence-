import { loadAll } from "@/lib/journal";
import { apiAuthorized, unauthorized } from "@/lib/api-auth";
import { loggedAt } from "@/lib/schema";

// GET /api/entries?since=2026-01-01&type=Decision   Authorization: Bearer <CAPTURE_TOKEN>
// Every entry with people and projects resolved to names, for spreadsheets, BI tools or AI analysis.
export async function GET(req: Request) {
  if (!apiAuthorized(req)) return unauthorized();
  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const type = url.searchParams.get("type");
  const { entries, people, projects } = await loadAll();
  const name = (ids: string[], refs: { id: string; name: string }[]) => ids.map((id) => refs.find((r) => r.id === id)?.name ?? id);
  const rows = entries
    .filter((e) => !since || loggedAt(e) >= since)
    .filter((e) => !type || e.type === type)
    .map(({ projectIds, peopleIds, ...e }) => ({ ...e, loggedAt: loggedAt(e), projects: name(projectIds, projects), people: name(peopleIds, people) }));
  return Response.json({ count: rows.length, entries: rows });
}
