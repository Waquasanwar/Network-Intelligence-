/**
 * Invitation links. Joining the network is by invitation only, and the link is the invitation.
 *
 * A link carries an encrypted, authenticated claim (AES-256-GCM, key derived from AUTH_SECRET), so
 * it cannot be forged or edited, and it reveals nothing — not a person's id, not which network it
 * is for — to whoever it is forwarded to. Three kinds:
 *
 *   network   the owner's general link ("put this on the website"). Many people can use it. It
 *             carries the tenant's invite version, so "reset link" kills every copy at once.
 *   member    a member's own link. Works for as long as they are an approved member.
 *   personal  one named invitation (a row in Invite): single use, expires, can be revoked, and
 *             tells the sender when it was opened and when the person joined.
 *
 * This file only seals and opens tokens. Whether a claim is still good (not revoked, not expired,
 * the member still a member) is decided against the database in src/server/invites.ts.
 */
import "server-only";
import { seal, unseal } from "@/lib/secrets";

export type InviteClaim =
  | { kind: "network"; tenantId: string; version: number }
  | { kind: "member"; personId: string }
  | { kind: "personal"; inviteId: string };

const PURPOSE = "invite-link";
const ID = /^[a-z0-9_-]{8,40}$/i;

function token(payload: string): string {
  // seal() prefixes "enc:v1:"; what is left is base64url parts joined by ".", safe in a URL as it is.
  return seal(PURPOSE, payload).slice("enc:v1:".length);
}

export const signNetworkInvite = (tenantId: string, version: number) => token(`n:${tenantId}:${version}`);
export const signMemberInvite = (personId: string) => token(`m:${personId}`);
export const signPersonalInvite = (inviteId: string) => token(`i:${inviteId}`);

/** Open a token. Null for anything forged, edited, truncated or simply not ours. */
export function readInvite(raw: string | undefined | null): InviteClaim | null {
  if (!raw || raw.length > 400 || !/^[A-Za-z0-9_.-]+$/.test(raw)) return null;
  const payload = unseal(PURPOSE, "enc:v1:" + raw);
  if (!payload) return null;
  const [k, a, b] = payload.split(":");
  if (!a || !ID.test(a)) return null;
  if (k === "n" && b !== undefined && /^\d{1,9}$/.test(b)) return { kind: "network", tenantId: a, version: Number(b) };
  if (k === "m" && b === undefined) return { kind: "member", personId: a };
  if (k === "i" && b === undefined) return { kind: "personal", inviteId: a };
  return null;
}
