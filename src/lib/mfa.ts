import { APP_NAME } from "@/lib/brand";
/**
 * TOTP multi-factor authentication (control: "Require a second factor to sign in").
 *
 * A standard RFC-6238 authenticator app (Google Authenticator, 1Password, Authy …) holds the
 * secret; we store only the same shared secret, and one-time recovery codes as SHA-256 hashes so a
 * database leak never yields a usable code. All of this runs server-side, in the Node runtime
 * (never the edge, never the browser).
 */
import * as OTPAuth from "otpauth";
import { createHash, randomBytes } from "crypto";

const ISSUER = APP_NAME;

function totp(email: string, secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

/** A fresh base32 secret to enrol a new authenticator against. */
export function newSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

/** The otpauth:// URI an authenticator app scans or imports. */
export function otpauthUri(email: string, secret: string): string {
  return totp(email, secret).toString();
}

/**
 * The time-step a 6-digit code belongs to, allowing one 30-second step of clock drift either way,
 * or null when it does not match. Callers store the step they accepted and refuse anything at or
 * below it, so a code that was watched over a shoulder cannot be used a second time.
 */
export function totpStep(email: string, secret: string, token: unknown): number | null {
  const t = (typeof token === "string" ? token : "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(t)) return null;
  const delta = totp(email, secret).validate({ token: t, window: 1 });
  return delta === null ? null : Math.floor(Date.now() / 30_000) + delta;
}

/** True if the 6-digit code matches. Prefer totpStep() where the result is persisted. */
export function verifyTotp(email: string, secret: string, token: unknown): boolean {
  return totpStep(email, secret, token) !== null;
}

/** Ten human-friendly one-time codes, returned as plaintext (shown once) plus their stored hashes. */
export function newRecoveryCodes(n = 10): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: n }, () => {
    // 80 bits each: far beyond offline guessing even though the stored hash is unsalted.
    const raw = randomBytes(10).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`;
  });
  return { codes, hashes: codes.map(hashRecoveryCode) };
}

export function hashRecoveryCode(code: unknown): string {
  return createHash("sha256").update((typeof code === "string" ? code : "").replace(/[\s-]/g, "").toUpperCase()).digest("hex");
}

/**
 * If `input` matches one of the stored hashes, returns the remaining hashes (that code consumed);
 * otherwise null. The caller persists the returned list so each code works exactly once.
 */
export function consumeRecoveryCode(input: unknown, hashes: string[]): string[] | null {
  const h = hashRecoveryCode(input);
  return hashes.includes(h) ? hashes.filter((x) => x !== h) : null;
}
