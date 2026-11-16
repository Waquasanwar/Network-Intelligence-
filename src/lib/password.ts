/**
 * Password rules for people creating their own login. Length does the work; the short list only
 * turns away the handful of choices that are tried first in any guessing attack.
 */
export const PASSWORD_MIN = 10;

const COMMON = ["password", "passw0rd", "qwerty", "letmein", "welcome", "iloveyou", "admin", "abc123", "football", "monkey", "dragon", "sunshine", "princess", "changeme", "network"];

/** An error code for the join form, or null when the password is acceptable. */
export function passwordProblem(password: string, personal: string[] = []): "password-short" | "password-weak" | null {
  if (password.length < PASSWORD_MIN) return "password-short";
  const p = password.toLowerCase();
  const stripped = p.replace(/[^a-z]/g, "");
  if (/^(.)\1+$/.test(p) || /^(0?1234567890?|12345678910?)/.test(p) || "abcdefghijklmnopqrstuvwxyz".includes(stripped) && stripped.length >= 8) return "password-weak";
  if (COMMON.some((c) => stripped === c || stripped === c + c)) return "password-weak";
  for (const s of personal) {
    const part = s.toLowerCase().split("@")[0]!.replace(/[^a-z0-9]/g, "");
    if (part.length >= 4 && p.replace(/[^a-z0-9]/g, "") === part) return "password-weak";
  }
  return null;
}
