import "server-only";
import { prisma } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { privacyOf, type Privacy } from "@/lib/privacy";

/**
 * The one thing worth doing next on a page, read from the state of the network. No model call:
 * each is a plain query, so it is always current, costs nothing, and says exactly why it is there.
 * Every page gets at most one, so the suggestion stays a prompt and never becomes another list.
 */
export type Step = { text: string; label: string; href: string };

const DAY = 86_400_000;
const more = (n: number, one: string, many: string) => (n <= 0 ? "" : ` ${n} more ${n === 1 ? one : many}.`);

/** Network: keep the relationships you have delivered with warm, then bring new people in. */
export async function networkStep(tenantId: string): Promise<Step> {
  const cutoff = new Date(Date.now() - 90 * DAY);
  const quiet = (await prisma.person.findMany({
    where: { tenantId, relationships: { some: { workedTogether: true, OR: [{ lastContactDate: null }, { lastContactDate: { lt: cutoff } }] } } },
    select: { id: true, firstName: true, lastName: true, preferredName: true, privacy: true },
    orderBy: { updatedAt: "asc" }, take: 50,
  })).filter((p) => !privacyOf({ privacy: p.privacy as Partial<Privacy> | null }).erasureRequestedAt);
  if (quiet.length) return { text: `You have delivered with ${fullName(quiet[0])} and not been in touch for three months.${more(quiet.length - 1, "person is in the same place", "people are in the same place")}`, label: `Open ${quiet[0].preferredName ?? quiet[0].firstName}`, href: `/network/${quiet[0].id}` };
  const unmet = await prisma.person.findMany({ where: { tenantId, conversations: { none: {} }, screeningStatus: "NONE" }, select: { id: true, firstName: true, lastName: true, preferredName: true }, orderBy: { createdAt: "desc" }, take: 50 });
  if (unmet.length) return { text: `${fullName(unmet[0])} is in your network and you have not spoken yet.${more(unmet.length - 1, "person is waiting for a first conversation", "people are waiting for a first conversation")}`, label: "Book a conversation", href: `/network/${unmet[0].id}` };
  return { text: "Everyone you know has heard from you recently. A good moment to bring someone new in.", label: "Invite someone", href: "/invite" };
}

/** Requirements: a need that nobody has been found for is the first thing to move. */
export async function requirementsStep(tenantId: string): Promise<Step | null> {
  const bare = await prisma.brief.findMany({ where: { tenantId, status: { in: ["NEW", "QUALIFYING", "SEARCHING"] }, shortlist: { none: {} } }, select: { id: true, title: true }, orderBy: { createdAt: "asc" }, take: 20 });
  if (bare.length) return { text: `“${bare[0].title}” has nobody shortlisted yet.${more(bare.length - 1, "requirement is waiting too", "requirements are waiting too")}`, label: "Find people", href: `/requirements/${bare[0].id}` };
  const undecided = await prisma.brief.findFirst({ where: { tenantId, status: { in: ["SEARCHING", "SHORTLISTED"] }, shortlist: { some: { decision: "CANDIDATE" }, none: { decision: { in: ["PROPOSED", "CLIENT_INTERESTED", "INTRODUCED", "PLACED"] } } } }, select: { id: true, title: true }, orderBy: { updatedAt: "asc" } });
  if (undecided) return { text: `The shortlist for “${undecided.title}” is waiting for your decision on who to propose.`, label: "Review shortlist", href: `/requirements/${undecided.id}` };
  return null;
}

/** Opportunities: a live problem with no one matched against it. */
export async function opportunitiesStep(tenantId: string): Promise<Step | null> {
  const bare = await prisma.opportunity.findMany({ where: { tenantId, status: { in: ["INTAKE", "QUALIFYING", "MATCHING"] }, matches: { none: {} } }, select: { id: true, title: true }, orderBy: { createdAt: "asc" }, take: 20 });
  if (!bare.length) return null;
  return { text: `“${bare[0].title}” has no one matched against it yet.${more(bare.length - 1, "opportunity is the same", "opportunities are the same")}`, label: "Find matches", href: `/opportunities/${bare[0].id}` };
}

/** Conversations: notes waiting for approval first, then the people never spoken to. */
export async function conversationsStep(tenantId: string): Promise<Step | null> {
  const review = await prisma.conversation.count({ where: { person: { tenantId }, approvalStatus: { in: ["NEEDS_REVIEW", "DRAFT"] } } });
  if (review) return { text: `${review} ${review === 1 ? "conversation is" : "conversations are"} written up and waiting for you to approve. Nothing counts until you do.`, label: "Review now", href: "/conversations?tab=review" };
  const unmet = await prisma.person.findMany({ where: { tenantId, conversations: { none: {} }, scheduledMeetings: { none: {} } }, select: { id: true, firstName: true, lastName: true, preferredName: true }, orderBy: { updatedAt: "desc" }, take: 50 });
  if (!unmet.length) return null;
  return { text: `There is no conversation on record with ${fullName(unmet[0])}.${more(unmet.length - 1, "person has none either", "people have none either")}`, label: "Book one", href: `/network/${unmet[0].id}` };
}
