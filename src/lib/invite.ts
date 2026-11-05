import { createHmac, timingSafeEqual } from "crypto";

/**
 * Shareable invite links without a new table: the referrer's person id is encoded and
 * signed (HMAC) so /join can trust it came from us. Tamper with the link and it fails
 * verification and falls back to choosing the inviter by hand.
 */
const SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "insecure-dev-invite-secret";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url").slice(0, 24);
}

export function signInvite(personId: string): string {
  const payload = Buffer.from(personId).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyInvite(token: string | undefined | null): string | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
