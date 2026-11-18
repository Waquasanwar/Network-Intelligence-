"use server";
import { z } from "zod";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isInternal, isMember } from "@/lib/authz";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { signMemberInvite, signPersonalInvite } from "@/lib/invite";
import { passwordProblem } from "@/lib/password";
import { DEFAULT_PRIVACY } from "@/lib/privacy";
import { requireAdminAction, requireInternalAction, requireUser } from "@/server/session";
import { resolveMemberPerson } from "@/server/queries";
import { INVITE_DAYS, mayInvite, networkInviteToken, resolveInvite } from "@/server/invites";

// ---------- sending invitations ----------

export type InviteLinkResult = { ok: true; token: string; kind: "network" | "member" } | { ok: false; error: string };

/**
 * The caller's own reusable link: a member's personal link once they are approved, or the
 * network's general link for the internal team.
 */
export async function myInviteLink(asPersonId?: string): Promise<InviteLinkResult> {
  const user = await requireUser();
  if (isMember(user) || (isInternal(user) && asPersonId)) {
    const me = await resolveMemberPerson(user, typeof asPersonId === "string" ? asPersonId : null);
    if (!me) return { ok: false, error: "No member profile." };
    if (!mayInvite(me)) return { ok: false, error: "You can invite people once your screening has been reviewed." };
    return { ok: true, token: signMemberInvite(me.id), kind: "member" };
  }
  if (isInternal(user)) return { ok: true, token: await networkInviteToken(user.tenantId), kind: "network" };
  return { ok: false, error: "Only members of the network can invite." };
}

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional(),
  personId: z.string().max(40).optional().or(z.literal("")),
  asPersonId: z.string().max(40).optional().or(z.literal("")),
});

export type CreateInviteResult = { ok: true; id: string; token: string; name: string } | { ok: false; error: string };

/**
 * A personal, tracked invitation for one named person. Sent by the internal team, or by an
 * approved member. With `personId` (internal only) it lets an existing contact claim the profile
 * the network already holds, instead of registering as a duplicate.
 */
export async function createInvite(input: z.input<typeof inviteSchema>): Promise<CreateInviteResult> {
  const user = await requireUser();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add their name, and check the email address if you gave one." };
  const d = parsed.data;
  if (!(await rateLimit("mutate", `invite:${user.id}`)).success) return { ok: false, error: "That is a lot of invitations at once. Wait a minute and carry on." };

  let tenantId: string, inviterPersonId: string | null = null, createdById: string | null = null, claimPersonId: string | null = null;
  if (isInternal(user) && !d.asPersonId) {
    tenantId = user.tenantId; createdById = user.id;
    if (d.personId) {
      const p = await prisma.person.findFirst({ where: { id: d.personId, tenantId }, select: { id: true, memberUser: { select: { id: true } } } });
      if (!p) return { ok: false, error: "That person was not found in your network." };
      if (p.memberUser) return { ok: false, error: "They already have a login." };
      claimPersonId = p.id;
    }
  } else {
    const me = await resolveMemberPerson(user, d.asPersonId || null);
    if (!me) return { ok: false, error: "No member profile." };
    if (!mayInvite(me)) return { ok: false, error: "You can invite people once your screening has been reviewed." };
    tenantId = me.tenantId; inviterPersonId = me.id; createdById = isInternal(user) ? user.id : null;
    const open = await prisma.invite.count({ where: { inviterPersonId: me.id, status: { in: ["SENT", "OPENED"] }, expiresAt: { gt: new Date() } } });
    if (open >= 25) return { ok: false, error: "You have 25 invitations still open. Wait for some to be used, or cancel one." };
  }
  if (d.email && (await prisma.user.findFirst({ where: { email: d.email, tenantId }, select: { id: true } }))) return { ok: false, error: "Someone with that email is already in the network." };

  const invite = await prisma.invite.create({
    data: { tenantId, createdById, inviterPersonId, personId: claimPersonId, name: d.name, email: d.email || null, note: d.note || null, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) },
  });
  await audit({ tenantId, actorId: user.id, action: "invite.create", entityType: "Invite", entityId: invite.id, metadata: { by: inviterPersonId ? "member" : "team", claim: !!claimPersonId } });
  revalidatePath("/invite"); revalidatePath("/member");
  return { ok: true, id: invite.id, token: signPersonalInvite(invite.id), name: invite.name };
}

/** The link for an invitation the caller sent earlier (to copy it again or send a reminder). */
export async function inviteLink(inviteId: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const inv = await ownInvite(user, String(inviteId));
  if (!inv || inv.status === "REVOKED" || inv.status === "JOINED") return { ok: false, error: "That invitation is no longer open." };
  return { ok: true, token: signPersonalInvite(inv.id) };
}

async function ownInvite(user: Awaited<ReturnType<typeof requireUser>>, id: string) {
  const inv = await prisma.invite.findUnique({ where: { id } });
  if (!inv) return null;
  if (isInternal(user)) return inv.tenantId === user.tenantId ? inv : null;
  const me = await resolveMemberPerson(user, null);
  return me && inv.inviterPersonId === me.id ? inv : null;
}

/** Cancel an invitation that has not been used. Its link stops working immediately. */
export async function revokeInvite(formData: FormData) {
  const user = await requireUser();
  const inv = await ownInvite(user, String(formData.get("inviteId")));
  if (!inv) throw new Error("Invitation not found");
  if (inv.status === "SENT" || inv.status === "OPENED") {
    await prisma.invite.update({ where: { id: inv.id }, data: { status: "REVOKED" } });
    await audit({ tenantId: inv.tenantId, actorId: user.id, action: "invite.revoke", entityType: "Invite", entityId: inv.id });
  }
  revalidatePath("/invite"); revalidatePath("/member");
}

/** Replace the network's general link. Every copy of the old one stops working. */
export async function resetNetworkLink() {
  const user = await requireAdminAction();
  await prisma.tenant.update({ where: { id: user.tenantId }, data: { inviteVersion: { increment: 1 } } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "invite.reset_link", entityType: "Tenant", entityId: user.tenantId });
  revalidatePath("/invite"); revalidatePath("/overview");
}

// ---------- joining (public) ----------

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  headline: z.string().trim().max(200).optional(),
  linkedinUrl: z.string().trim().max(300).optional(),
  inviteToken: z.string().min(10).max(400),
  consent: z.literal("on"),
});

/** Only a real LinkedIn profile address is kept; anything else is dropped rather than stored. */
function linkedin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.protocol === "https:" && /(^|\.)linkedin\.com$/i.test(u.hostname) ? u.toString().slice(0, 300) : null;
  } catch { return null; }
}

/**
 * A new member registers through an invitation. There is no other way in: the signed link decides
 * which network they join and who invited them, and nothing on the form can change that.
 */
export async function registerMember(formData: FormData) {
  const token = String(formData.get("inviteToken") || "");
  const back = (error: string): never => redirect(`/join?t=${encodeURIComponent(token)}&error=${error}`);
  if (!(await rateLimit("join", `register:${clientIp(await headers())}`)).success) back("throttled");

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(formData.get("consent") === "on" ? "details" : "consent");
  const d = parsed.data!;
  const pw = passwordProblem(d.password, [d.email, d.firstName, d.lastName]);
  if (pw) back(pw);

  const resolved = await resolveInvite(d.inviteToken);
  if (!resolved.ok) redirect(`/join?error=${resolved.problem}`);
  const inv = resolved.invite!;
  if (await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } })) back("exists");

  const owner = await prisma.user.findFirst({ where: { tenantId: inv.tenantId, role: "OWNER" }, select: { id: true } });
  const passwordHash = await hash(d.password, 12);
  const now = new Date();
  const privacy = { ...DEFAULT_PRIVACY, reviewedAt: now.toISOString() } as unknown as Prisma.InputJsonValue;
  // Who knows this person. A member's link: that member introduced them. A personal invitation the
  // team wrote by name: whoever sent it knows them first hand. The general link, or an application
  // that came in through the public page: nobody here knows them yet, and the record says so.
  const sent = inv.inviteId && !inv.inviter ? await prisma.invite.findUnique({ where: { id: inv.inviteId }, select: { createdById: true, createdBy: { select: { name: true } } } }) : null;
  const applied = inv.inviteId ? await prisma.publicRequest.count({ where: { inviteId: inv.inviteId } }) : 0;
  const knownBy = sent?.createdById && !applied ? sent : null;
  const relationship = owner
    ? {
        networkOwnerId: knownBy?.createdById ?? owner.id,
        sourceType: knownBy ? ("PERSONAL_NETWORK" as const) : ("INBOUND" as const),
        relationshipType: inv.inviter ? ("INTRODUCED" as const) : ("DIRECT" as const),
        introducedById: inv.inviter?.id ?? null,
        relationshipNotes: inv.inviter ? `Registered through ${inv.inviter.firstName} ${inv.inviter.lastName}'s invitation.` : knownBy ? `Invited by name by ${knownBy.createdBy?.name ?? "the team"}.` : applied ? "Applied through the public page, then invited." : "Registered through the network's general link.",
      }
    : null;

  let personId: string;
  try {
    personId = await prisma.$transaction(async (tx) => {
      let pid: string;
      if (inv.claimPersonId) {
        // Claim the profile the network already holds. What the owner recorded stays as it is; the
        // person adds their login, their consent and anything that was blank.
        const existing = await tx.person.findFirst({ where: { id: inv.claimPersonId, tenantId: inv.tenantId, memberUser: null } });
        if (!existing) throw new Error("claimed");
        await tx.person.update({ where: { id: existing.id }, data: { email: existing.email ?? d.email, headline: existing.headline ?? (d.headline || null), linkedinUrl: existing.linkedinUrl ?? linkedin(d.linkedinUrl), memberSince: existing.memberSince ?? now, screeningStatus: ["NONE", "INVITED"].includes(existing.screeningStatus) ? "REGISTERED" : existing.screeningStatus, referralConsent: existing.referralConsent ?? "ask", privacy, nextAction: existing.screenedAt ? existing.nextAction : "Screening call", nextActionDate: existing.screenedAt ? existing.nextActionDate : new Date(Date.now() + 3 * 86_400_000) } });
        pid = existing.id;
      } else {
        const p = await tx.person.create({ data: { tenantId: inv.tenantId, firstName: d.firstName, lastName: d.lastName, email: d.email, headline: d.headline || null, linkedinUrl: linkedin(d.linkedinUrl), availabilityStatus: "NEEDS_REFRESH", screeningStatus: "REGISTERED", referralConsent: "ask", privacy, memberSince: now, nextAction: "Screening call", nextActionDate: new Date(Date.now() + 3 * 86_400_000), relationships: relationship ? { create: relationship } : undefined } });
        pid = p.id;
      }
      await tx.user.create({ data: { tenantId: inv.tenantId, email: d.email, name: `${d.firstName} ${d.lastName}`, role: "MEMBER", personId: pid, passwordHash } });
      if (inv.inviteId) {
        // Single use, enforced in the database: of two simultaneous registrations only one wins.
        const used = await tx.invite.updateMany({ where: { id: inv.inviteId, status: { in: ["SENT", "OPENED"] } }, data: { status: "JOINED", joinedAt: now, joinedPersonId: pid } });
        if (used.count !== 1) throw new Error("claimed");
      }
      return pid;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "claimed") redirect("/join?error=used");
    // Two registrations racing for the same email address: the database's unique index decides.
    if ((e as { code?: string })?.code === "P2002") back("exists");
    throw e;
  }
  await audit({ tenantId: inv.tenantId, actorId: null, action: "member.register", entityType: "Person", entityId: personId, metadata: { via: inv.kind, referrerId: inv.inviter?.id ?? null, inviteId: inv.inviteId, claimed: !!inv.claimPersonId } });
  // Straight in: they have just chosen their password, so asking for it again is only friction.
  try {
    await signIn("credentials", { email: d.email, password: d.password, code: "", redirectTo: "/member?welcome=1" });
  } catch (err) {
    if (err instanceof AuthError) redirect(`/login?registered=1&callbackUrl=${encodeURIComponent("/member?welcome=1")}`);
    throw err;
  }
}

// ---------- joining up duplicates ----------

/**
 * Someone registered who the network already had as a contact. An owner or admin confirms it is
 * the same person and the new login is attached to the existing profile. Deliberately a human
 * decision: an email typed into a form is not proof of who someone is.
 */
export async function mergeRegistration(formData: FormData) {
  const user = await requireInternalAction();
  if (user.role !== "OWNER" && user.role !== "ADMIN") throw new Error("Only an owner or admin can merge profiles");
  const d = z.object({ newPersonId: z.string().min(1).max(40), existingPersonId: z.string().min(1).max(40) }).parse(Object.fromEntries(formData));
  if (d.newPersonId === d.existingPersonId) throw new Error("Choose two different profiles");
  const [fresh, existing] = await Promise.all([
    prisma.person.findFirst({ where: { id: d.newPersonId, tenantId: user.tenantId }, include: { memberUser: { select: { id: true } }, relationships: true } }),
    prisma.person.findFirst({ where: { id: d.existingPersonId, tenantId: user.tenantId }, include: { memberUser: { select: { id: true } } } }),
  ]);
  if (!fresh || !existing) throw new Error("Profile not found");
  if (!fresh.memberUser) throw new Error("The newer profile has no login to move");
  if (existing.memberUser) throw new Error("The existing profile already has a login");

  await prisma.$transaction(async (tx) => {
    const to = { personId: existing.id };
    await tx.user.update({ where: { id: fresh.memberUser!.id }, data: { personId: null } });
    await tx.conversation.updateMany({ where: { personId: fresh.id }, data: to });
    await tx.scheduledConversation.updateMany({ where: { personId: fresh.id }, data: to });
    await tx.vouch.updateMany({ where: { personId: fresh.id }, data: to });
    await tx.vouch.updateMany({ where: { voucherPersonId: fresh.id }, data: { voucherPersonId: existing.id } });
    await tx.referral.updateMany({ where: { referrerPersonId: fresh.id }, data: { referrerPersonId: existing.id } });
    await tx.referral.updateMany({ where: { referredPersonId: fresh.id }, data: { referredPersonId: existing.id } });
    await tx.invite.updateMany({ where: { inviterPersonId: fresh.id }, data: { inviterPersonId: existing.id } });
    await tx.invite.updateMany({ where: { joinedPersonId: fresh.id }, data: { joinedPersonId: existing.id } });
    await tx.relationship.updateMany({ where: { introducedById: fresh.id }, data: { introducedById: existing.id } });
    // Pitches are unique per brief: move the ones that do not clash, drop the rest with the old profile.
    const clash = (await tx.pitch.findMany({ where: { personId: existing.id }, select: { briefId: true } })).map((p) => p.briefId);
    await tx.pitch.updateMany({ where: { personId: fresh.id, briefId: { notIn: clash } }, data: to });
    // Who invited them is worth keeping if the existing profile did not record it.
    const introducedBy = fresh.relationships.find((r) => r.introducedById)?.introducedById;
    if (introducedBy && introducedBy !== existing.id) await tx.relationship.updateMany({ where: { personId: existing.id, introducedById: null }, data: { introducedById: introducedBy } });
    const progressed = ["SUBMITTED", "APPROVED", "BOOKED"].includes(fresh.screeningStatus);
    await tx.person.update({
      where: { id: existing.id },
      data: {
        email: existing.email ?? fresh.email, headline: existing.headline ?? fresh.headline, linkedinUrl: existing.linkedinUrl ?? fresh.linkedinUrl,
        memberSince: existing.memberSince ?? fresh.memberSince ?? new Date(),
        screeningStatus: progressed || ["NONE", "INVITED"].includes(existing.screeningStatus) ? fresh.screeningStatus : existing.screeningStatus,
        screenedAt: existing.screenedAt ?? fresh.screenedAt,
        // Consent is theirs: what they chose when they registered is what applies from now on.
        privacy: (fresh.privacy ?? undefined) as Prisma.InputJsonValue | undefined, referralConsent: fresh.referralConsent ?? existing.referralConsent,
        attributes: (existing.attributes ?? fresh.attributes ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await tx.person.delete({ where: { id: fresh.id } });
    await tx.user.update({ where: { id: fresh.memberUser!.id }, data: { personId: existing.id, sessionVersion: { increment: 1 } } });
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "person.update", entityType: "Person", entityId: existing.id, metadata: { merged: true, from: fresh.id } });
  revalidatePath("/network"); revalidatePath("/referrals"); revalidatePath("/invite");
  redirect(`/network/${existing.id}`);
}
