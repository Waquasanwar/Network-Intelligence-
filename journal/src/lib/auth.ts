// Single-user passcode sign-in. The cookie holds an HMAC of the passcode, so changing
// APP_PASSCODE or AUTH_SECRET signs every device out. Uses Web Crypto so it runs in middleware.

export const SESSION_COOKIE = "journal_session";

export function authEnabled(): boolean {
  return !!process.env.APP_PASSCODE;
}

export async function sessionToken(): Promise<string> {
  const secret = process.env.AUTH_SECRET || "dev-secret-change-me";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`journal:${process.env.APP_PASSCODE ?? ""}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
