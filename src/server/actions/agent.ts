"use server";
import { prisma } from "@/lib/db";
import { trustFor } from "@/lib/trust-for";
import { TRUST_SELECT } from "@/lib/trust-include";
import { rateLimit } from "@/lib/rate-limit";
import { requireInternalAction } from "@/server/session";
import { getAIProvider } from "@/lib/ai";
import { textSearchClauses } from "@/server/network-search";
import { trustBand, TRUST_BAND_LABEL } from "@/lib/trust";
import { ACTIVE_STATUSES } from "@/lib/availability";
import { AVAILABILITY_LABELS, ROUTE_LABELS } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import type { EngagementRoute, Prisma } from "@prisma/client";
import { copilotEnabled, runCopilot } from "@/server/copilot";

export type AgentPerson = {
  id: string; name: string; headline: string; trust: number; band: string;
  availability: string; open: boolean; city: string | null; worked: boolean; vouchedBy: number;
  /** Plain reasons this person came back for this question — every one is a fact on their record. */
  why: string[];
};
export type AgentAnswer =
  | { ok: true; query: string; understood: string[]; total: number; searched: number; answer: string; people: AgentPerson[]; href: string;
      /** What the agent actually did, in order. */ steps: string[];
      /** "claude" when the AI co-pilot answered; "rules" when the built-in matcher did. */ engine: "claude" | "rules" }
  | { ok: false; error: string };

const STOP = new Set(["who", "whom", "what", "which", "with", "that", "have", "from", "could", "would", "should", "know", "need", "find", "show", "someone", "somebody", "anyone", "people", "person", "lead", "role", "work", "fits", "does", "there", "their", "them", "they", "about", "into", "some", "available", "soon"]);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * "Ask your network." The agent reads the question into structured intent, runs the same search the
 * Network list runs, ranks by the real trust score and says why each person came back. The answer
 * sentence is assembled from those facts — it never claims anything the records do not show.
 */
export async function askNetwork(query: string): Promise<AgentAnswer> {
  const user = await requireInternalAction();
  const q = String(query ?? "").trim().slice(0, 300);
  if (!(await rateLimit("ai", `ask:${user.id}`)).success) return { ok: false, error: "That is a lot of questions at once. Give it a moment and ask again." };
  if (q.length < 2) return { ok: false, error: "Ask about a skill, a place or a kind of work — for example “cyber lead in Dubai, available now”." };

  if (copilotEnabled()) {
    try {
      const [searched, r] = await Promise.all([prisma.person.count({ where: { tenantId: user.tenantId } }), runCopilot(user.tenantId, q)]);
      const people: AgentPerson[] = r.picks.flatMap(({ id, why }) => {
        const p = r.found.get(id);
        if (!p) return [];
        const t = trustFor(p);
        return [{
          id: p.id, name: p.preferredName || fullName(p), headline: p.headline ?? "", trust: t.score, band: TRUST_BAND_LABEL[trustBand(t.score)],
          availability: AVAILABILITY_LABELS[p.availabilityStatus], open: ACTIVE_STATUSES.includes(p.availabilityStatus),
          city: p.primaryCity ?? p.primaryCountry ?? null, worked: p.relationships.some((x) => x.workedTogether), vouchedBy: t.vouchedBy, why: [why],
        }];
      });
      return { ok: true, query: q, understood: r.understood, total: r.found.size, searched, answer: r.answer, people, href: `/network?q=${encodeURIComponent(q)}`, steps: r.steps, engine: "claude" };
    } catch (err) {
      console.warn("[copilot] falling back to the built-in matcher", err instanceof Error ? err.message : err);
    }
  }

  const intent = await getAIProvider().parseSearch(q);
  const select = {
    id: true, firstName: true, lastName: true, preferredName: true, headline: true, sectors: true,
    primaryCity: true, primaryCountry: true, targetLocations: true, engagementPreferences: true,
    ...TRUST_SELECT,
    referralsMade: { select: { status: true } },
  } satisfies Prisma.PersonSelect;
  const [searched, exact] = await Promise.all([
    prisma.person.count({ where: { tenantId: user.tenantId } }),
    prisma.person.findMany({ where: { tenantId: user.tenantId, AND: textSearchClauses(q, intent) }, select, take: 80 }),
  ]);
  // A question in ordinary words ("who could run a procurement programme?") may name nothing the
  // lexicon knows. Rather than answer "nobody", fall back to its meaningful words.
  let rows = exact;
  if (!rows.length) {
    const words = [...new Set(q.toLowerCase().split(/[^a-z0-9&+#]+/).filter((w) => w.length > 3 && !STOP.has(w)))].slice(0, 6);
    if (words.length) {
      rows = await prisma.person.findMany({
        where: { tenantId: user.tenantId, OR: words.flatMap((w) => [{ headline: { contains: w, mode: "insensitive" as const } }, { currentRole: { contains: w, mode: "insensitive" as const } }, { lastName: { contains: w, mode: "insensitive" as const } }, { firstName: { contains: w, mode: "insensitive" as const } }]) },
        select, take: 80,
      });
    }
  }

  const people: AgentPerson[] = rows.map((p) => {
    const worked = p.relationships.some((r) => r.workedTogether);
    const t = trustFor(p);
    const why: string[] = [];
    const caps = p.capabilities.filter((c) => intent.capabilities.some((k) => same(k, c) || c.toLowerCase().includes(k.toLowerCase())));
    if (caps.length) why.push(`strong at ${caps.slice(0, 2).join(" and ")}`);
    const place = intent.locations.find((l) => [p.primaryCity, p.primaryCountry].some((x) => x && x.toLowerCase().includes(l.toLowerCase())));
    const target = !place ? intent.locations.find((l) => p.targetLocations.some((x) => same(x, l))) : undefined;
    if (place) why.push(`based in ${p.primaryCity ?? p.primaryCountry}`); else if (target) why.push(`open to ${target}`);
    const route = intent.routes.find((r) => p.engagementPreferences.includes(r as EngagementRoute));
    if (route) why.push(`open to ${ROUTE_LABELS[route as EngagementRoute].toLowerCase()}`);
    if (worked) why.push("you've worked together");
    if (t.vouchedBy) why.push(`vouched by ${t.vouchedBy}`);
    return {
      id: p.id, name: p.preferredName || fullName(p), headline: p.headline ?? "", trust: t.score, band: TRUST_BAND_LABEL[trustBand(t.score)],
      availability: AVAILABILITY_LABELS[p.availabilityStatus], open: ACTIVE_STATUSES.includes(p.availabilityStatus),
      city: p.primaryCity ?? p.primaryCountry ?? null, worked, vouchedBy: t.vouchedBy, why,
    };
  }).sort((a, b) => b.trust - a.trust || Number(b.open) - Number(a.open));

  const title = (x: string) => x.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  // "cyber" adds nothing once "cyber security" is understood — keep the most specific of each.
  const caps = intent.capabilities.filter((c, _i, all) => !all.some((o) => o !== c && o.toLowerCase().includes(c.toLowerCase())));
  const understood = [
    ...caps.map(title),
    ...intent.sectors.map((s) => `${title(s)} sector`),
    ...intent.locations.map((l) => `in or open to ${title(l)}`),
    ...intent.routes.map((r) => ROUTE_LABELS[r as EngagementRoute] ?? r),
    ...(intent.availableSoon ? ["available soon"] : []),
    ...(intent.workedWithOnly ? ["people you've worked with"] : []),
  ];

  const total = people.length;
  const top = people[0];
  const openCount = people.filter((p) => p.open).length;
  const answer = !total
    ? `Nobody in the network matches that yet. I looked across all ${searched} people. Try a broader skill or drop the location, or add the person you have in mind.`
    : `${total === 1 ? "One person matches" : `${total} people match`}${openCount ? `, ${openCount === total ? (total === 1 ? "and they are open to work" : "all open to work") : `${openCount} open to work`}` : ""}. ${top.name} is the strongest — trust ${Math.round(top.trust)} (${top.band.toLowerCase()})${top.why.length ? `, ${top.why.slice(0, 2).join(", ")}` : ""}.`;

  return { ok: true, query: q, understood, total, searched, answer, people: people.slice(0, 4), href: `/network?q=${encodeURIComponent(q)}`, steps: [`Matched your words against ${searched} people`, "Ranked by trust"], engine: "rules" };
}
