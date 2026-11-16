/**
 * Server-side secret handling. Everything here needs the Node runtime; never import it from the
 * middleware or a client component.
 *
 * One application secret (AUTH_SECRET) is stretched with HKDF into separate, purpose-bound keys, so
 * the key that signs invite links can never be used to decrypt an MFA secret, and so on. In
 * production a missing or placeholder secret is a hard failure rather than a silent weak default.
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "crypto";

const DEV_FALLBACK = "insecure-dev-secret-do-not-use-in-production";

function rootSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (process.env.NODE_ENV === "production" && (s.length < 32 || s === "change-me")) {
    throw new Error("AUTH_SECRET is missing or too short. Generate one with: openssl rand -base64 32");
  }
  return s || DEV_FALLBACK;
}

const keys = new Map<string, Buffer>();
function key(purpose: string): Buffer {
  let k = keys.get(purpose);
  if (!k) { k = Buffer.from(hkdfSync("sha256", rootSecret(), "network-intelligence", purpose, 32)); keys.set(purpose, k); }
  return k;
}

/** Keyed MAC, base64url. `purpose` separates uses so a tag from one can't be replayed in another. */
export function mac(purpose: string, payload: string, length = 32): string {
  return createHmac("sha256", key(purpose)).update(payload).digest("base64url").slice(0, length);
}

export function macEquals(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Constant-time comparison for bearer tokens and signatures of any length. */
export function safeEqual(a: string, b: string): boolean {
  const x = createHmac("sha256", "cmp").update(a).digest(), y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y);
}

const PREFIX = "enc:v1:";

/** AES-256-GCM at rest, for values that must be recoverable (the TOTP shared secret). */
export function seal(purpose: string, plaintext: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(purpose), iv, { authTagLength: 16 });
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return PREFIX + [iv, ct, c.getAuthTag()].map((b) => b.toString("base64url")).join(".");
}

/** Reverses seal(). Values written before encryption was introduced are returned as they are. */
export function unseal(purpose: string, stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored;
  try {
    const [iv, ct, tag] = stored.slice(PREFIX.length).split(".").map((p) => Buffer.from(p, "base64url"));
    // Full-length tag only: GCM would otherwise accept a shortened one, which is far easier to forge.
    if (!iv || !ct || !tag || iv.length !== 12 || tag.length !== 16) return null;
    const d = createDecipheriv("aes-256-gcm", key(purpose), iv, { authTagLength: 16 });
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * OAuth `state`: proves the callback belongs to a connection this same user started in the last
 * ten minutes. Without it, someone could finish their own authorisation inside another person's
 * session and bind that person's account to the attacker's calendar.
 */
export function oauthState(userId: string, provider: string): string {
  const ts = Date.now().toString(36);
  return `${ts}.${mac("oauth-state", `${userId}:${provider}:${ts}`)}`;
}

export function checkOauthState(state: string | null, userId: string, provider: string): boolean {
  if (!state) return false;
  const [ts, tag] = state.split(".");
  if (!ts || !tag) return false;
  const age = Date.now() - parseInt(ts, 36);
  if (!(age >= 0 && age < 10 * 60_000)) return false;
  return macEquals(tag, mac("oauth-state", `${userId}:${provider}:${ts}`));
}
