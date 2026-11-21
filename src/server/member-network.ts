import "server-only";
/**
 * A member's own corner of the network, and what the matcher thinks of the work open to them.
 *
 * Everything here is about people the member already knows: who brought them in, who they brought
 * in, and who they are connected with. Nobody else's details are shown, and the client behind a
 * requirement stays hidden: the budget and our commercial reading are never used in what a member
 * is told about their own fit.
 */
import { prisma } from "@/lib/db";
import { briefPeople } from "@/server/briefs";
import { matchBrief, type BriefMatch } from "@/lib/demand";
import { toDomain } from "@/lib/brief-domain";
import type { Brief as DbBrief } from "@prisma/client";

const SEL = { id: true, firstName: true, lastName: true, headline: true } as const;
export type NetPerson = { id: string; firstName: string; lastName: string; headline: string | null };
export type NetTie = NetPerson & { how: "invited" | "referred" | "introduced" | "connected"; knownHow: string | null };

export async function memberNetwork(personId: string, tenantId: string) {
  const [viaInvite, viaIntro, invited, referred, introduced, conns] = await Promise.all([
    prisma.invite.findFirst({ where: { tenantId, joinedPersonId: personId, inviterPersonId: { not: null } }, select: { inviterPerson: { select: SEL } } }),
    prisma.relationship.findFirst({ where: { personId, introducedById: { not: null } }, select: { introducedBy: { select: SEL } } }),
    prisma.invite.findMany({ where: { tenantId, inviterPersonId: personId, joinedPersonId: { not: null } }, select: { knownHow: true, joinedPerson: { select: SEL } } }),
    prisma.referral.findMany({ where: { tenantId, referrerPersonId: personId, referredPersonId: { not: null } }, select: { knownHow: true, referred: { select: SEL } } }),
    prisma.relationship.findMany({ where: { introducedById: personId }, select: { person: { select: SEL } } }),
    prisma.connection.findMany({ where: { tenantId, status: "ACCEPTED", OR: [{ fromPersonId: personId }, { toPersonId: personId }] }, select: { fromPersonId: true, from: { select: SEL }, to: { select: SEL } } }),
  ]);
  const broughtMeIn: NetPerson | null = viaInvite?.inviterPerson ?? viaIntro?.introducedBy ?? null;
  const ties = new Map<string, NetTie>();
  const add = (p: NetPerson | null | undefined, how: NetTie["how"], knownHow: string | null = null) => { if (p && p.id !== personId && p.id !== broughtMeIn?.id && !ties.has(p.id)) ties.set(p.id, { ...p, how, knownHow }); };
  invited.forEach((i) => add(i.joinedPerson, "invited", i.knownHow));
  referred.forEach((r) => add(r.referred, "referred", r.knownHow));
  introduced.forEach((r) => add(r.person, "introduced"));
  conns.forEach((c) => add(c.fromPersonId === personId ? c.to : c.from, "connected"));
  const all = [...ties.values()];
  return { broughtMeIn, broughtIn: all.filter((t) => t.how !== "connected"), connected: all.filter((t) => t.how === "connected") };
}

export type Fit = { score: number; band: "strong" | "good" | "worth a look" | "stretch"; label: string; why: string[]; gaps: string[] };
export type RoleFit = { mine: Fit | null; fromNetwork: (NetPerson & { fit: Fit })[] };

const BAND: Record<Fit["band"], string> = { strong: "Strong fit", good: "Good fit", "worth a look": "Worth a look", stretch: "A stretch" };
// Signals a member may see about themselves. Our relationship notes, conversation records and the
// client's budget stay out of it.
const SHOWN = new Set(["Required capability", "Industry relevance", "Location / mobility", "Seniority", "Availability & engagement preference"]);

function fitOf(r: BriefMatch): Fit {
  const score = r.match.fitScore;
  const band: Fit["band"] = r.tier === "stretch" ? "stretch" : score >= 70 ? "strong" : score >= 50 ? "good" : score >= 30 ? "worth a look" : "stretch";
  const dims = r.match.dimensions.filter((d) => SHOWN.has(d.name));
  const why = dims.filter((d) => d.score >= 60).sort((a, b) => b.score - a.score).slice(0, 2).map((d) => d.note.replace(/\.$/, ""));
  const gaps = [
    ...r.checks.filter((c) => c.state !== "met").map((c) => c.note.replace(/\.$/, "")),
    ...dims.filter((d) => d.score < 40 && d.name === "Required capability").map((d) => d.note.replace(/\.$/, "")),
  ].slice(0, 2);
  return { score, band, label: BAND[band], why, gaps };
}

/** For each requirement: how it suits the member, and who among the people they know could suit it. */
export async function roleFits(personId: string, tenantId: string, briefs: DbBrief[], network: NetPerson[]): Promise<Map<string, RoleFit>> {
  const out = new Map<string, RoleFit>();
  if (!briefs.length) return out;
  const known = new Map(network.map((n) => [n.id, n]));
  const people = await briefPeople(tenantId, [personId, ...known.keys()]);
  for (const b of briefs) {
    const results = matchBrief(toDomain(b), people, people.length);
    const mine = results.find((r) => r.match.personId === personId);
    const fromNetwork = results
      .filter((r) => r.match.personId !== personId && known.has(r.match.personId) && r.tier !== "stretch" && r.match.fitScore >= 40)
      .slice(0, 2)
      .map((r) => ({ ...known.get(r.match.personId)!, fit: fitOf(r) }));
    out.set(b.id, { mine: mine ? fitOf(mine) : null, fromNetwork });
  }
  return out;
}
