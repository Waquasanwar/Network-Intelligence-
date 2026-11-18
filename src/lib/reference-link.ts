/**
 * Reference links. A member (or the team, for a member) asks someone who has seen their work to
 * say so, and that person answers from a link with no login. The link is the permission.
 *
 * Like an invitation it carries an encrypted, authenticated claim (AES-256-GCM, key derived from
 * AUTH_SECRET): it cannot be forged or edited, and it names nothing. Whether it is still open
 * (not answered, not cancelled, not expired) is decided against the database.
 */
import "server-only";
import { seal, unseal } from "@/lib/secrets";

const PURPOSE = "reference-link";
const ID = /^[a-z0-9_-]{8,40}$/i;

export const signReference = (requestId: string) => seal(PURPOSE, `r:${requestId}`).slice("enc:v1:".length);

/** The request id inside a token. Null for anything forged, edited, truncated or simply not ours. */
export function readReference(raw: string | undefined | null): string | null {
  if (!raw || raw.length > 400 || !/^[A-Za-z0-9_.-]+$/.test(raw)) return null;
  const payload = unseal(PURPOSE, "enc:v1:" + raw);
  if (!payload) return null;
  const [k, id, rest] = payload.split(":");
  return k === "r" && id && ID.test(id) && rest === undefined ? id : null;
}

export const REFERENCE_DAYS = 30;
/** How the referee knows the person's work. The key is stored; the label is what people read. */
export const REFERENCE_RELATIONS: [string, string][] = [
  ["managed", "They worked for me"],
  ["peer", "We worked alongside each other"],
  ["client", "They delivered for me as a client"],
  ["reported", "I worked for them"],
  ["other", "Another way"],
];
