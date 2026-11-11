import { prisma } from "@/lib/db";
import { trustScore, trustBand, TRUST_BAND_LABEL } from "@/lib/trust";
import { assessFreshness, ACTIVE_STATUSES } from "@/lib/availability";
import { matchBrief, type BriefPerson } from "@/lib/demand";
import { toDomain } from "@/server/actions/demand";
import { AVAILABILITY_LABELS, ROUTE_LABELS } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import type { FitScores } from "@/lib/fit";
import type { GNode, GLink, GRole } from "@/components/domain/network-graph";

const HUB = "__hub__";

/**
 * Everything the network map needs, built once for both the home page and the full map:
 * people as nodes (sized by the real trust score), provenance as edges, and — the part that turns
 * a picture into a tool — the open requirements each person genuinely fits, from the same
 * matching engine the shortlists use. "Stretch" matches (a hard check unmet) are left out here so
 * "roles they fit" stays honest; they still appear on the requirement itself.
 */
export async function buildNetworkMap(user: { tenantId: string; name: string }, now = new Date()): Promise<{ nodes: GNode[]; links: GLink[]; openRoles: number }> {
  const [people, briefs] = await Promise.all([
    prisma.person.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true, firstName: true, lastName: true, preferredName: true, headline: true, memberSince: true,
        capabilities: true, sectors: true, seniority: true, engagementPreferences: true, primaryCity: true, primaryCountry: true, targetLocations: true,
        rateExpectation: true, salaryExpectation: true, workRights: true, relocationInterest: true, attributes: true,
        screeningStatus: true, screenedAt: true, availabilityStatus: true, availabilityConfirmedAt: true, nextCheckDate: true,
        relationships: { select: { relationshipType: true, workedTogether: true, wouldWorkTogetherAgain: true, yearsKnown: true, introducedById: true } },
        vouches: { select: { wouldRecommend: true, voucherKind: true, attributes: true } },
        evidence: { select: { evidenceType: true, confidence: true, context: true } },
        conversations: { select: { approvalStatus: true } },
        referralsMade: { select: { status: true } },
      },
      take: 400,
    }),
    prisma.brief.findMany({ where: { tenantId: user.tenantId, status: { notIn: ["FILLED", "CLOSED"] } }, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);

  // Which open requirements does each person fit?
  const briefPeople: BriefPerson[] = people.map((p) => ({
    id: p.id, capabilities: p.capabilities, sectors: p.sectors, seniority: p.seniority, engagementPreferences: p.engagementPreferences,
    primaryCity: p.primaryCity, primaryCountry: p.primaryCountry, targetLocations: p.targetLocations,
    availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate,
    rateExpectation: p.rateExpectation, salaryExpectation: p.salaryExpectation,
    relationships: p.relationships.map((r) => ({ relationshipType: r.relationshipType, workedTogether: r.workedTogether, wouldWorkTogetherAgain: r.wouldWorkTogetherAgain, yearsKnown: r.yearsKnown })),
    evidence: p.evidence.map((e) => ({ evidenceType: e.evidenceType, confidence: e.confidence, context: e.context })),
    approvedConversations: p.conversations.filter((c) => c.approvalStatus === "APPROVED").length,
    workRights: p.workRights, relocationInterest: p.relocationInterest,
    attributes: (p.attributes as FitScores | null) ?? null,
    observedAttributes: p.vouches.map((v) => v.attributes as FitScores | null).filter((a): a is FitScores => !!a),
  }));
  const rolesFor = new Map<string, GRole[]>();
  for (const b of briefs) {
    const domain = await toDomain(b);
    for (const m of matchBrief(domain, briefPeople, 12, now)) {
      if (m.tier === "stretch") continue;
      const list = rolesFor.get(m.match.personId) ?? [];
      list.push({ id: b.id, title: b.roles[0] ?? b.title, route: b.engagementRoute ? ROUTE_LABELS[b.engagementRoute] : null, location: b.locations[0] ?? null, tier: m.tier, fit: m.match.fitScore });
      rolesFor.set(m.match.personId, list);
    }
  }

  const ids = new Set(people.map((p) => p.id));
  const nodes: GNode[] = [{ id: HUB, name: `${user.name.split(" ")[0]}’s network`, headline: "You — the centre of the network", trust: 100, worked: true, hub: true }];
  const links: GLink[] = [];

  for (const p of people) {
    const worked = p.relationships.some((r) => r.workedTogether);
    const freshness = assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate }, now);
    const t = trustScore({
      vouches: p.vouches.map((v) => ({ wouldRecommend: v.wouldRecommend, external: v.voucherKind === "EXTERNAL" })),
      workedWith: p.relationships.filter((r) => r.workedTogether).length,
      wouldWorkAgain: p.relationships.filter((r) => r.wouldWorkTogetherAgain === true).length,
      evidence: p.evidence.filter((e) => e.evidenceType !== "CAUTION").length,
      cautions: p.evidence.filter((e) => e.evidenceType === "CAUTION").length,
      approvedConversations: p.conversations.filter((c) => c.approvalStatus === "APPROVED").length,
      screened: p.screeningStatus === "APPROVED" || !!p.screenedAt,
      freshness,
      referralsAccepted: p.referralsMade.filter((r) => r.status === "ACCEPTED").length,
    });
    const open = ACTIVE_STATUSES.includes(p.availabilityStatus);
    nodes.push({
      id: p.id, name: p.preferredName || fullName(p), headline: p.headline ?? "", trust: t.score, worked,
      band: TRUST_BAND_LABEL[trustBand(t.score)], vouchedBy: t.vouchedBy,
      capabilities: p.capabilities.slice(0, 6), city: p.primaryCity ?? p.primaryCountry ?? null,
      availability: AVAILABILITY_LABELS[p.availabilityStatus], availabilityTone: p.availabilityStatus === "NEEDS_REFRESH" || freshness !== "fresh" ? "amber" : open ? "teal" : "neutral", open,
      member: !!p.memberSince, screened: p.screeningStatus === "APPROVED" || !!p.screenedAt,
      roles: (rolesFor.get(p.id) ?? []).sort((a, b) => (a.tier === b.tier ? b.fit - a.fit : a.tier === "meets" ? -1 : 1)).slice(0, 4),
    });

    const primary = p.relationships[0];
    const introducer = primary?.introducedById && ids.has(primary.introducedById) ? primary.introducedById : null;
    links.push({ source: introducer ?? HUB, target: p.id, worked: !!primary?.workedTogether });
  }

  return { nodes, links, openRoles: briefs.length };
}
