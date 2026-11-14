"use server";
import { prisma } from "@/lib/db";
import { requireInternalAction } from "@/server/session";
import { getAIProvider } from "@/lib/ai";
import { textSearchClauses } from "@/server/network-search";
import { trustScore, trustBand, TRUST_BAND_LABEL } from "@/lib/trust";
import { assessFreshness, ACTIVE_STATUSES } from "@/lib/availability";
import { AVAILABILITY_LABELS, ROUTE_LABELS } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import type { EngagementRoute, Prisma } from "@prisma/client";

export type AgentPerson = {
  id: string; name: string; headline: string; trust: number; band: string;
  availability: string; open: boolean; city: string | null; worked: boolean; vouchedBy: number;
  /** Plain reasons this person came back for this question — every one is a fact on their record. */
  why: string[];
};
export type AgentAnswer =
  | { ok: true; query: string; understood: string[]; total: number; searched: number; answer: string; people: AgentPerson[]; href: string }
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
  if (q.length < 2) return { ok: false, error: "Ask about a skill, a place or a kind of work — for example “cyber lead in Dubai, available now”." };

  const now = new Date();
  const intent = await getAIProvider().parseSearch(q);
  const select = {
    id: true, firstName: true, lastName: true, preferredName: true, headline: true, capabilities: true, sectors: true,
    primaryCity: true, primaryCountry: true, targetLocations: true, engagementPreferences: true,
    screeningStatus: true, screenedAt: true, availabilityStatus: true, availabilityConfirmedAt: true, nextCheckDate: true,
    relationships: { select: { workedTogether: true, wouldWorkTogetherAgain: true } },
    vouches: { select: { wouldRecommend: true, voucherKind: true } },
    evidence: { select: { evidenceType: true } },
    conversations: { select: { approvalStatus: true } },
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
    const t = trustScore({
      vouches: p.vouches.map((v) => ({ wouldRecommend: v.wouldRecommend, external: v.voucherKind === "EXTERNAL" })),
      workedWith: p.relationships.filter((r) => r.workedTogether).length,
      wouldWorkAgain: p.relationships.filter((r) => r.wouldWorkTogetherAgain === true).length,
      evidence: p.evidence.filter((e) => e.evidenceType !== "CAUTION").length,
      cautions: p.evidence.filter((e) => e.evidenceType === "CAUTION").length,
      approvedConversations: p.conversations.filter((c) => c.approvalStatus === "APPROVED").length,
      screened: p.screeningStatus === "APPROVED" || !!p.screenedAt,
      freshness: assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate }, now),
      referralsAccepted: p.referralsMade.filter((r) => r.status === "ACCEPTED").length,
    });
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

  return { ok: true, query: q, understood, total, searched, answer, people: people.slice(0, 4), href: `/network?q=${encodeURIComponent(q)}` };
}
