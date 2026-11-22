import "server-only";
/**
 * A member's own corner of the network: who brought them in, who they brought in, and who they are
 * connected with. Nobody else's details are shown.
 */
import { prisma } from "@/lib/db";
import { canShowPhoto } from "@/lib/privacy";

const SEL = { id: true, firstName: true, lastName: true, headline: true, photoUrl: true, privacy: true } as const;
type Row = { id: string; firstName: string; lastName: string; headline: string | null; photoUrl: string | null; privacy: unknown };
/** `photo` is set only where that person agreed to show it. Their privacy record never leaves the server. */
export type NetPerson = { id: string; firstName: string; lastName: string; headline: string | null; photo: string | null };
const slim = (r: Row | null | undefined): NetPerson | null =>
  r ? { id: r.id, firstName: r.firstName, lastName: r.lastName, headline: r.headline, photo: canShowPhoto(r, "internal") ? r.photoUrl : null } : null;
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
  const broughtMeIn = slim(viaInvite?.inviterPerson ?? viaIntro?.introducedBy);
  const ties = new Map<string, NetTie>();
  const add = (row: Row | null | undefined, how: NetTie["how"], knownHow: string | null = null) => { const p = slim(row); if (p && p.id !== personId && p.id !== broughtMeIn?.id && !ties.has(p.id)) ties.set(p.id, { ...p, how, knownHow }); };
  invited.forEach((i) => add(i.joinedPerson, "invited", i.knownHow));
  referred.forEach((r) => add(r.referred, "referred", r.knownHow));
  introduced.forEach((r) => add(r.person, "introduced"));
  conns.forEach((c) => add(c.fromPersonId === personId ? c.to : c.from, "connected"));
  const all = [...ties.values()];
  return { broughtMeIn, broughtIn: all.filter((t) => t.how !== "connected"), connected: all.filter((t) => t.how === "connected") };
}
