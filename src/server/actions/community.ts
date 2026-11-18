"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EngagementRoute } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isInternal } from "@/lib/authz";
import { rateLimit } from "@/lib/rate-limit";
import { privacyOf } from "@/lib/privacy";
import { parseBrief } from "@/lib/demand";
import { requireUser } from "@/server/session";
import { resolveMemberPerson, loadRateCard } from "@/server/queries";
import { mayInvite } from "@/server/invites";
import { boardAccount, briefData, termsFor, forecastFee, runShortlist } from "@/server/briefs";

/**
 * The members' community board. Members share work they know about, say when they are looking for
 * someone or are free, refer each other and connect. It is free for them, and work found here still
 * runs through the network: every WORK or HELP post is also a lead in the owner's Requirements, and
 * posting one means agreeing to that.
 *
 * Only members whose screening has been accepted take part. A member is shown to other members only
 * if they have switched that on, and contact details are shared only once a connection is accepted.
 */

const ROUTES = ["PERMANENT", "CONTRACT", "INTERIM", "FRACTIONAL", "ADVISORY", "SOW"] as const;
const back = (q: string): never => redirect(`/community?${q}`);

/** The signed-in member, if they may take part. Internal users act only as moderators. */
async function participant(user: Awaited<ReturnType<typeof requireUser>>) {
  if (isInternal(user)) return { user, me: null };
  const base = await resolveMemberPerson(user, null);
  const me = base ? await prisma.person.findUnique({ where: { id: base.id }, select: { id: true, tenantId: true, firstName: true, lastName: true, memberSince: true, screeningStatus: true, screenedAt: true, privacy: true } }) : null;
  if (!me || !mayInvite(me)) back("notice=screening");
  return { user, me: me! };
}

const postSchema = z.object({
  kind: z.enum(["WORK", "HELP", "AVAILABLE"]),
  title: z.string().trim().min(4).max(120),
  body: z.string().trim().min(10).max(2000),
  route: z.enum(ROUTES).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional(),
});

export async function createPost(formData: FormData) {
  const { user, me } = await participant(await requireUser());
  if (!me) back("notice=members-only");
  if (!(await rateLimit("mutate", `post:${user.id}`)).success) back("notice=slow-down");
  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("notice=post-details");
  const d = parsed.data!;
  const lead = d.kind !== "AVAILABLE";
  if (lead && formData.get("terms") !== "on") back("notice=post-terms");
  const open = await prisma.boardPost.count({ where: { authorPersonId: me!.id, status: "OPEN" } });
  if (open >= 10) back("notice=too-many");

  let briefId: string | null = null;
  if (lead) {
    // The work comes to the network first: a lead in Requirements, matched against everyone.
    const account = await boardAccount(me!.tenantId);
    const card = await loadRateCard(me!.tenantId);
    const said = `${d.title}. ${d.body}${d.location ? ` Location: ${d.location}.` : ""}`;
    const p = parseBrief(said);
    const route = (d.route || p.engagementRoute || null) as EngagementRoute | null;
    const terms = await termsFor(account, route, card);
    const b = await prisma.brief.create({ data: { tenantId: me!.tenantId, accountId: account.id, submittedVia: "BOARD", status: "NEW", ...briefData({ ...p, title: d.title, engagementRoute: route, rawText: `Shared on the member board by ${me!.firstName} ${me!.lastName} (${d.kind === "WORK" ? "work they know about" : "looking for someone"}):\n\n${said}` }, terms) } });
    await forecastFee(b, me!.tenantId, card);
    await runShortlist(b, me!.tenantId);
    briefId = b.id;
  }
  const post = await prisma.boardPost.create({ data: { tenantId: me!.tenantId, authorPersonId: me!.id, kind: d.kind, title: d.title, body: d.body, route: (d.route || null) as EngagementRoute | null, location: d.location || null, briefId } });
  await audit({ tenantId: me!.tenantId, actorId: user.id, action: "board.post", entityType: "BoardPost", entityId: post.id, metadata: { kind: d.kind, briefId } });
  revalidatePath("/community"); revalidatePath("/requirements");
  back("notice=posted");
}

/** The author closes their own post; the team can hide anyone's. */
export async function closePost(formData: FormData) {
  const user = await requireUser();
  const post = await prisma.boardPost.findUnique({ where: { id: String(formData.get("postId") || "") } });
  if (!post) return;
  if (isInternal(user)) {
    if (post.tenantId !== user.tenantId) return;
    await prisma.boardPost.update({ where: { id: post.id }, data: { status: "HIDDEN" } });
  } else {
    const me = await resolveMemberPerson(user, null);
    if (!me || me.id !== post.authorPersonId) return;
    await prisma.boardPost.update({ where: { id: post.id }, data: { status: "CLOSED" } });
  }
  await audit({ tenantId: post.tenantId, actorId: user.id, action: "board.close", entityType: "BoardPost", entityId: post.id, metadata: { by: isInternal(user) ? "team" : "author" } });
  revalidatePath("/community");
}

/** "I'm interested" on work someone shared. It reaches the owner as a pitch on the lead. */
export async function interestedInPost(formData: FormData) {
  const { user, me } = await participant(await requireUser());
  if (!me) back("notice=members-only");
  const post = await prisma.boardPost.findFirst({ where: { id: String(formData.get("postId") || ""), tenantId: me!.tenantId, status: "OPEN", kind: { in: ["WORK", "HELP"] } } });
  if (!post?.briefId || post.authorPersonId === me!.id) back("notice=post-gone");
  const note = String(formData.get("note") || "").trim().slice(0, 600) || "Interested, from the member board.";
  await prisma.pitch.upsert({ where: { briefId_personId: { briefId: post!.briefId!, personId: me!.id } }, create: { briefId: post!.briefId!, personId: me!.id, note }, update: { note, status: "SUBMITTED" } });
  await audit({ tenantId: me!.tenantId, actorId: user.id, action: "pitch.create", entityType: "Brief", entityId: post!.briefId!, metadata: { via: "board" } });
  revalidatePath("/community"); revalidatePath("/referrals");
  back("notice=interested");
}

const referSchema = z.object({ postId: z.string().max(40), name: z.string().trim().min(2).max(120), email: z.string().trim().max(200).optional(), context: z.string().trim().min(5).max(600) });

/** Refer someone you would stand behind for work on the board. Credited to you if they are placed. */
export async function referToPost(formData: FormData) {
  const { user, me } = await participant(await requireUser());
  if (!me) back("notice=members-only");
  if (!(await rateLimit("mutate", `refer:${user.id}`)).success) back("notice=slow-down");
  const parsed = referSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("notice=refer-details");
  const d = parsed.data!;
  const post = await prisma.boardPost.findFirst({ where: { id: d.postId, tenantId: me!.tenantId, status: "OPEN", kind: { in: ["WORK", "HELP"] } } });
  if (!post?.briefId) back("notice=post-gone");
  const existing = await prisma.person.findFirst({ where: { tenantId: me!.tenantId, OR: [...(d.email ? [{ email: { equals: d.email, mode: "insensitive" as const } }] : []), { firstName: { equals: d.name.split(/\s+/)[0], mode: "insensitive" as const }, lastName: { equals: d.name.split(/\s+/).slice(1).join(" "), mode: "insensitive" as const } }] }, select: { id: true } });
  await prisma.referral.create({ data: { tenantId: me!.tenantId, referrerPersonId: me!.id, referredPersonId: existing?.id ?? null, name: d.name, email: d.email || null, context: d.context, note: "Referred on the member board", briefId: post!.briefId } });
  await audit({ tenantId: me!.tenantId, actorId: user.id, action: "referral.create", entityType: "Brief", entityId: post!.briefId!, metadata: { via: "board" } });
  revalidatePath("/community"); revalidatePath("/referrals");
  back("notice=referred");
}

/** Ask another member to connect. Both must have switched on "Show me to other members". */
export async function connect(formData: FormData) {
  const { user, me } = await participant(await requireUser());
  if (!me) back("notice=members-only");
  if (!privacyOf({ privacy: me!.privacy }).consents.memberDirectory) back("notice=directory-off");
  if (!(await rateLimit("mutate", `connect:${user.id}`)).success) back("notice=slow-down");
  const toId = String(formData.get("personId") || "");
  if (toId === me!.id) back("tab=members");
  const to = await prisma.person.findFirst({ where: { id: toId, tenantId: me!.tenantId, memberUser: { isNot: null } }, select: { id: true, memberSince: true, screeningStatus: true, screenedAt: true, privacy: true } });
  if (!to || !mayInvite(to) || !privacyOf({ privacy: to.privacy }).consents.memberDirectory) back("notice=not-available");
  const either = await prisma.connection.findFirst({ where: { OR: [{ fromPersonId: me!.id, toPersonId: to!.id }, { fromPersonId: to!.id, toPersonId: me!.id }] } });
  if (!either) {
    const c = await prisma.connection.create({ data: { tenantId: me!.tenantId, fromPersonId: me!.id, toPersonId: to!.id, message: String(formData.get("message") || "").trim().slice(0, 300) || null } });
    await audit({ tenantId: me!.tenantId, actorId: user.id, action: "connection.request", entityType: "Connection", entityId: c.id });
  } else if (either.status === "PENDING" && either.toPersonId === me!.id) {
    // They had already asked you: asking back is a yes.
    await prisma.connection.update({ where: { id: either.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
  }
  revalidatePath("/community");
  back("tab=members&notice=asked");
}

/** Accept or decline a request someone sent you. */
export async function answerConnection(formData: FormData) {
  const { user, me } = await participant(await requireUser());
  if (!me) back("notice=members-only");
  const c = await prisma.connection.findFirst({ where: { id: String(formData.get("id") || ""), toPersonId: me!.id, status: "PENDING" } });
  if (!c) back("tab=connections");
  const yes = formData.get("answer") === "accept";
  await prisma.connection.update({ where: { id: c!.id }, data: { status: yes ? "ACCEPTED" : "DECLINED", respondedAt: new Date() } });
  await audit({ tenantId: me!.tenantId, actorId: user.id, action: "connection.answer", entityType: "Connection", entityId: c!.id, metadata: { accepted: yes } });
  revalidatePath("/community");
  back("tab=connections");
}

/** One switch on the board itself, the same consent as in Privacy & data. */
export async function setDirectory(formData: FormData) {
  const { user, me } = await participant(await requireUser());
  if (!me) back("notice=members-only");
  const on = formData.get("on") === "1";
  const current = privacyOf({ privacy: me!.privacy });
  await prisma.person.update({ where: { id: me!.id }, data: { privacy: { ...current, consents: { ...current.consents, memberDirectory: on } } } });
  await audit({ tenantId: me!.tenantId, actorId: user.id, action: "consent.update", entityType: "Person", entityId: me!.id, metadata: { memberDirectory: on } });
  revalidatePath("/community");
  back(`tab=members`);
}
