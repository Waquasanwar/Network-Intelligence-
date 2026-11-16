/**
 * The reference a client or agency uses to talk about someone before they know who it is
 * ("NI-4F2A91C0"). It is a keyed hash of the person's id together with the audience it is shown to,
 * so it cannot be worked back to an id, cannot be recomputed by anyone holding a list of ids, and
 * differs between two agencies looking at the same person — they cannot compare notes.
 */
import "server-only";
import { createHmac } from "crypto";
import { mac } from "@/lib/secrets";

export function partnerRef(audienceId: string, personId: string): string {
  const tag = Buffer.from(mac("partner-ref", `${audienceId}:${personId}`, 43), "base64url").subarray(0, 4).toString("hex").toUpperCase();
  return `NI-${tag}`;
}

/** Stable, non-reversible key for React lists that must not carry a database id to the browser. */
export function opaqueKey(scope: string, id: string): string {
  return createHmac("sha256", mac("list-key", scope)).update(id).digest("base64url").slice(0, 12);
}
