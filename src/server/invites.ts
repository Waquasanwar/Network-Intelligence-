import "server-only";
import { prisma } from "@/lib/db";
import { readInvite, signNetworkInvite } from "@/lib/invite";
import { privacyOf } from "@/lib/privacy";

export type InviteProblem = "invalid" | "expired" | "used" | "revoked";

export type ResolvedInvite = {
  kind: "network" | "member" | "personal";
  tenantId: string;
  networkName: string;
  /** The member who invited them, when there is one. Only the name is ever shown. */
  inviter: { id: string; firstName: string; lastName: string } | null;
  /** The tracked invitation behind a personal link. */
  inviteId: string | null;
  /** An existing profile this invitation lets the person claim. */
  claimPersonId: string | null;
  prefill: { firstName: string; lastName: string; email: string };
};

/** A member may invite once a person has reviewed and approved them. */
export function mayInvite(p: { memberSince: Date | null; screeningStatus: string; screenedAt: Date | null; privacy?: unknown }): boolean {
  return !!p.memberSince && (p.screeningStatus === "APPROVED" || !!p.screenedAt) && !privacyOf({ privacy: p.privacy }).erasureRequestedAt;
}

const split = (name: string) => { const [first, ...rest] = name.trim().split(/\s+/); return { firstName: first ?? "", lastName: rest.join(" ") }; };

/**
 * Decide, against the database, whether an invitation link is good right now. Everything the join
 * page and the registration action know about an invitation comes from here.
 */
export async function resolveInvite(token: string | undefined | null): Promise<{ ok: true; invite: ResolvedInvite } | { ok: false; problem: InviteProblem }> {
  const claim = readInvite(token);
  if (!claim) return { ok: false, problem: "invalid" };
  const blank = { firstName: "", lastName: "", email: "" };

  if (claim.kind === "network") {
    const t = await prisma.tenant.findUnique({ where: { id: claim.tenantId }, select: { id: true, name: true, brandName: true, type: true, inviteVersion: true } });
    if (!t || (t.type !== "PLATFORM_OWNER" && t.type !== "CONSULTANCY")) return { ok: false, problem: "invalid" };
    if (t.inviteVersion !== claim.version) return { ok: false, problem: "revoked" };
    return { ok: true, invite: { kind: "network", tenantId: t.id, networkName: t.brandName ?? t.name, inviter: null, inviteId: null, claimPersonId: null, prefill: blank } };
  }

  if (claim.kind === "member") {
    const p = await prisma.person.findUnique({ where: { id: claim.personId }, select: { id: true, firstName: true, lastName: true, tenantId: true, memberSince: true, screeningStatus: true, screenedAt: true, privacy: true, tenant: { select: { name: true, brandName: true } } } });
    if (!p) return { ok: false, problem: "invalid" };
    if (!mayInvite(p)) return { ok: false, problem: "revoked" };
    return { ok: true, invite: { kind: "member", tenantId: p.tenantId, networkName: p.tenant.brandName ?? p.tenant.name, inviter: { id: p.id, firstName: p.firstName, lastName: p.lastName }, inviteId: null, claimPersonId: null, prefill: blank } };
  }

  const inv = await prisma.invite.findUnique({
    where: { id: claim.inviteId },
    include: { tenant: { select: { name: true, brandName: true } }, inviterPerson: { select: { id: true, firstName: true, lastName: true } }, person: { select: { id: true, tenantId: true, memberUser: { select: { id: true } } } } },
  });
  if (!inv) return { ok: false, problem: "invalid" };
  if (inv.status === "REVOKED") return { ok: false, problem: "revoked" };
  if (inv.status === "JOINED") return { ok: false, problem: "used" };
  if (inv.expiresAt < new Date()) return { ok: false, problem: "expired" };
  // A profile can be claimed once, and only inside the network that issued the invitation.
  if (inv.person && (inv.person.tenantId !== inv.tenantId || inv.person.memberUser)) return { ok: false, problem: "used" };
  return {
    ok: true,
    invite: { kind: "personal", tenantId: inv.tenantId, networkName: inv.tenant.brandName ?? inv.tenant.name, inviter: inv.inviterPerson, inviteId: inv.id, claimPersonId: inv.person?.id ?? null, prefill: { ...split(inv.name), email: inv.email ?? "" } },
  };
}

/** The network's general invite link token for a tenant, at its current version. */
export async function networkInviteToken(tenantId: string): Promise<string> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { inviteVersion: true } });
  return signNetworkInvite(tenantId, t?.inviteVersion ?? 0);
}

/** How long a personal invitation stays open. */
export const INVITE_DAYS = 30;
