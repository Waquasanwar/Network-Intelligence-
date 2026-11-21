import "server-only";
/**
 * The agent that does the recruiting, so members do not have to.
 *
 * When a requirement comes in it searches the network (the shortlist), then tells the people who
 * should know, in plain words: the team (who it found), members who fit (asking first, unless they
 * have said yes to being put forward), the members who brought someone in (when that person moves
 * forward), and the client (when people are proposed). Each note has a key, so running the agent
 * again never says the same thing twice.
 *
 * Members are never told who the client is or what the budget is.
 */
import { Prisma, type ShortlistDecision } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ROUTE_LABELS } from "@/lib/labels";

type NoteIn = { audience: "OWNER" | "MEMBER" | "ACCOUNT"; key: string; kind: string; title: string; body?: string | null; href?: string | null; personId?: string | null; accountId?: string | null; briefId?: string | null; aboutId?: string | null };

async function say(tenantId: string, n: NoteIn) {
  try { await prisma.agentNote.create({ data: { tenantId, ...n } }); }
  catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return; throw e; } // already said
}

/** How a role reads to someone outside the deal: what and where, never who or for how much. */
export function roleLine(b: { roles: string[]; engagementRoute: keyof typeof ROUTE_LABELS | null; locations: string[] }) {
  return [b.roles[0] ?? "A role", b.engagementRoute ? ROUTE_LABELS[b.engagementRoute].toLowerCase() : null, b.locations[0] ?? null].filter(Boolean).join(" · ");
}

const PERSON = { id: true, firstName: true, lastName: true, referralConsent: true, memberUser: { select: { id: true } } } as const;

/** The members who brought this person into the network: by invitation, referral or introduction. */
async function broughtInBy(personId: string, tenantId: string) {
  const [inv, ref, rel] = await Promise.all([
    prisma.invite.findMany({ where: { tenantId, joinedPersonId: personId, inviterPersonId: { not: null } }, select: { inviterPersonId: true } }),
    prisma.referral.findMany({ where: { tenantId, referredPersonId: personId }, select: { referrerPersonId: true } }),
    prisma.relationship.findMany({ where: { personId, introducedById: { not: null } }, select: { introducedById: true } }),
  ]);
  const ids = [...new Set([...inv.map((i) => i.inviterPersonId!), ...ref.map((r) => r.referrerPersonId), ...rel.map((r) => r.introducedById!)])].filter((id) => id !== personId);
  if (!ids.length) return [];
  return prisma.person.findMany({ where: { id: { in: ids }, tenantId, memberUser: { isNot: null } }, select: { id: true } });
}

/** A requirement has been searched: tell the team, the client, and the members who fit. */
export async function agentOnBrief(briefId: string) {
  const b = await prisma.brief.findUnique({ where: { id: briefId }, include: { shortlist: { include: { person: { select: PERSON } }, orderBy: { fitScore: "desc" } } } });
  if (!b) return;
  const items = b.shortlist.filter((s) => s.decision !== "NOT_FOR_THIS");
  const meets = items.filter((s) => s.tier === "meets").length;
  const top = items.slice(0, 3).map((s) => `${s.person.firstName} ${s.person.lastName}`);
  await say(b.tenantId, {
    audience: "OWNER", key: `found:${b.id}:${items.length}`, kind: "found", briefId: b.id, href: `/requirements/${b.id}`,
    title: items.length ? `I searched the network for “${b.title}” and found ${items.length} ${items.length === 1 ? "person" : "people"} worth a look` : `I searched the network for “${b.title}” and found nobody obvious yet`,
    body: items.length ? `${meets} meet every hard requirement. Strongest: ${top.join(", ")}.` : "Add capabilities or a location to the requirement, or bring more people in.",
  });
  if (b.submittedVia === "PORTAL") await say(b.tenantId, { audience: "ACCOUNT", accountId: b.accountId, key: `received:${b.id}`, kind: "update", briefId: b.id, href: "/portal", title: `We are searching people we know for “${b.title}”`, body: "You will see anonymised people here as soon as we propose them." });

  // Members who fit: asked first unless they have told us to put them forward.
  const role = roleLine(b);
  // Asking costs them one tap, so anyone who meets every hard requirement is asked from a lower score.
  const fits = (x: (typeof items)[number]) => x.tier === "meets" ? Number(x.fitScore) >= 35 : x.tier === "conversation" && Number(x.fitScore) >= 50;
  for (const s of items.filter((x) => x.person.memberUser && fits(x)).slice(0, 5)) {
    const consent = s.person.referralConsent ?? "ask";
    if (consent === "no") continue;
    await say(b.tenantId, consent === "yes"
      ? { audience: "MEMBER", personId: s.personId, key: `fit:${b.id}:${s.personId}`, kind: "forward", briefId: b.id, title: `I am putting you forward for ${role}`, body: b.memberSummary ?? "You told us we can put you forward. I will tell you how it goes." }
      : { audience: "MEMBER", personId: s.personId, key: `fit:${b.id}:${s.personId}`, kind: "fit", briefId: b.id, title: `A role has come in that fits you: ${role}`, body: `${b.memberSummary ? `${b.memberSummary} ` : ""}Shall I put you forward? Your name is only shared with your yes.` });
  }
}

const MOVES: Partial<Record<ShortlistDecision, { you: string; them: (first: string) => string }>> = {
  PROPOSED: { you: "You have been put forward for", them: (f) => `${f}, who you brought in, has been put forward for` },
  CLIENT_INTERESTED: { you: "A client would like to meet you about", them: (f) => `A client would like to meet ${f}, who you brought in, about` },
  INTRODUCED: { you: "You have been introduced for", them: (f) => `${f}, who you brought in, has been introduced for` },
  PLACED: { you: "Congratulations. You have been placed in", them: (f) => `${f}, who you brought in, has been placed in` },
};

/** Someone on a shortlist has moved forward: tell them, the members who brought them in, and the client. */
export async function agentOnDecision(itemId: string) {
  const s = await prisma.shortlistItem.findUnique({ where: { id: itemId }, include: { brief: true, person: { select: PERSON } } });
  if (!s) return;
  const b = s.brief; const move = MOVES[s.decision]; const role = roleLine(b);
  if (!move) return;
  if (s.person.memberUser) await say(b.tenantId, { audience: "MEMBER", personId: s.personId, key: `move:${s.id}:${s.decision}`, kind: "update", briefId: b.id, title: `${move.you} ${role}`, body: s.decision === "CLIENT_INTERESTED" ? "I will ask you before your name is shared." : null });
  for (const m of await broughtInBy(s.personId, b.tenantId)) {
    await say(b.tenantId, { audience: "MEMBER", personId: m.id, aboutId: s.personId, key: `move:${s.id}:${s.decision}:${m.id}`, kind: "update", briefId: b.id, title: `${move.them(s.person.firstName)} ${role}`, body: s.decision === "PLACED" ? "Thank you for bringing them in." : null });
  }
  if (s.decision === "PROPOSED") {
    const n = await prisma.shortlistItem.count({ where: { briefId: b.id, decision: { in: ["PROPOSED", "CLIENT_INTERESTED", "INTRODUCED", "PLACED"] } } });
    await say(b.tenantId, { audience: "ACCOUNT", accountId: b.accountId, key: `proposed:${b.id}:${n}`, kind: "proposed", briefId: b.id, href: "/portal", title: `We have proposed ${n} ${n === 1 ? "person" : "people"} for “${b.title}”`, body: "Anonymised until you ask for an introduction and they say yes." });
  }
}

export type NoteView = { id: string; kind: string; title: string; body: string | null; href: string | null; when: Date; unread: boolean; answer: string | null; question: boolean };

/** What the agent has told this reader, newest first. */
export async function notesFor(where: Prisma.AgentNoteWhereInput, take = 20): Promise<NoteView[]> {
  const notes = await prisma.agentNote.findMany({ where, orderBy: { createdAt: "desc" }, take });
  return notes.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, when: n.createdAt, unread: !n.readAt, answer: n.answer, question: n.kind === "fit" }));
}
