/**
 * Why anyone should believe us about this person.
 *
 * The strongest thing we can say is not a score: it is that someone here has worked with them, or
 * that we have used them ourselves and would again. This turns those facts into a short strip of
 * badges, strongest first — one version for inside the network, where people are named, and one
 * for a client or agency, where the same fact is said without naming anybody.
 *
 * Shared by the Next.js app and the browser prototype. No I/O.
 */

export type CredRelationship = {
  ownerName?: string | null;
  /** How this person came to us: our own contact, a colleague's, or an introduction from outside. */
  ownerKind?: "me" | "colleague" | "external";
  sourceLabel?: string | null;
  introducedByName?: string | null;
  workedTogether: boolean;
  workedTogetherContext?: string | null;
  yearsKnown?: number | null;
  wouldWorkTogetherAgain?: boolean | null;
};

export type CredInput = {
  relationships: CredRelationship[];
  /** Somebody here has sat across from them. The strongest single thing we can say. */
  metInPerson?: { by: string; when?: string | null } | null;
  /** Team members who put their own name behind them, not just a vouch in the system. */
  personallyReferredBy?: string[];
  /** We have put them on our own work, not just introduced them. */
  usedByUs: boolean;
  engagements?: number;
  onBench: boolean;
  vouchCount: number;
  wouldRecommendCount?: number;
  screened: boolean;
  evidenceCount: number;
  conversationCount?: number;
};

export type CredStrength = "strong" | "medium" | "light";
export type CredBadge = { key: string; label: string; note: string; strength: CredStrength; icon: string };

const yearsNote = (r: CredRelationship) => (r.yearsKnown ? `${r.yearsKnown} year${r.yearsKnown === 1 ? "" : "s"}` : "");

/** Inside the network: the facts, with the names attached. */
export function credibility(i: CredInput): CredBadge[] {
  const out: CredBadge[] = [];
  const worked = i.relationships.filter((r) => r.workedTogether);
  const again = worked.filter((r) => r.wouldWorkTogetherAgain === true);

  // Whose contact this is, said plainly. "Richard knows them" is a different fact from "somebody
  // in the network knows them", and it is the first thing you want to see on a profile.
  const named = i.relationships.filter((r) => r.ownerName);
  const mineNames = named.filter((r) => r.ownerKind === "me").map((r) => r.ownerName!) as string[];
  const otherNames = named.filter((r) => r.ownerKind !== "me").map((r) => r.ownerName!) as string[];
  if (named.length) {
    const via = named.find((r) => r.introducedByName)?.introducedByName;
    const label = mineNames.length && !otherNames.length ? "Your own contact"
      : mineNames.length ? `Yours, and ${otherNames.join(" and ")}'s`
      : otherNames.length === 1 ? `${otherNames[0]}'s contact` : `${otherNames.join(" and ")}'s contact`;
    const note = [
      otherNames.length ? "Amana Network team" : null,
      named[0]?.sourceLabel ?? null,
      via ? `introduced by ${via}` : null,
    ].filter(Boolean).join(" · ") || "one of our own contacts";
    out.push({ key: "whose", label, note, strength: mineNames.length ? "strong" : "medium", icon: "person" });
  }

  if (i.personallyReferredBy?.length) {
    out.push({ key: "referred", label: `Personally referred by ${i.personallyReferredBy.join(" and ")}`, note: "put their own name behind them, not just a note in the system", strength: "strong", icon: "vouch" });
  }
  if (i.metInPerson) {
    out.push({ key: "met", label: "Met in person", note: [i.metInPerson.by, i.metInPerson.when].filter(Boolean).join(" · "), strength: "strong", icon: "person" });
  }
  if (worked.length) {
    const first = again[0] ?? worked[0];
    const who = worked.map((r) => r.ownerName).filter(Boolean) as string[];
    const bits = [who.length ? who.join(", ") : null, first.workedTogetherContext ?? null, yearsNote(first) ? `known ${yearsNote(first)}` : null, again.length ? "would work together again" : null].filter(Boolean);
    out.push({ key: "worked", label: worked.length > 1 ? `Worked with by ${worked.length} of us` : "Worked with directly", note: bits.join(" · "), strength: again.length ? "strong" : "medium", icon: "worked" });
  }
  if (i.usedByUs) {
    const n = i.engagements ?? 0;
    out.push({ key: "used", label: "We have used them ourselves", note: n ? `on ${n} engagement${n === 1 ? "" : "s"}` : "on our own delivery work", strength: "strong", icon: "check" });
  }
  if (i.onBench && !i.usedByUs) out.push({ key: "bench", label: "On our bench", note: "trusted for our own project work", strength: "medium", icon: "trust" });

  const rec = i.wouldRecommendCount ?? i.vouchCount;
  if (rec > 0) out.push({ key: "vouched", label: `Vouched for by ${rec}`, note: rec === 1 ? "one person put their name behind them" : "people who put their names behind them", strength: rec >= 3 ? "strong" : "medium", icon: "vouch" });
  if (i.evidenceCount > 0) out.push({ key: "evidence", label: `${i.evidenceCount} piece${i.evidenceCount === 1 ? "" : "s"} of evidence`, note: "things people saw them deliver", strength: "medium", icon: "evidence" });
  if (i.screened) out.push({ key: "screened", label: "Screened in conversation", note: "a real 30 minutes, reviewed by a person", strength: "light", icon: "screening" });
  else if (i.conversationCount) out.push({ key: "spoken", label: "We have spoken", note: `${i.conversationCount} conversation${i.conversationCount === 1 ? "" : "s"} on the record`, strength: "light", icon: "conversation" });

  if (!out.length) out.push({ key: "new", label: "New to us", note: "nobody has worked with them yet — worth a conversation", strength: "light", icon: "ask" });
  return out;
}

/**
 * The same facts for a client or an agency: no names, no employers, nothing that identifies the
 * person or the people who vouched. It is still the strongest thing we can say, said carefully.
 */
export function credibilityForPartner(i: CredInput, ownerLabel = "the network lead"): CredBadge[] {
  const out: CredBadge[] = [];
  const worked = i.relationships.filter((r) => r.workedTogether);
  const again = worked.filter((r) => r.wouldWorkTogetherAgain === true);
  // Our own name is ours to give; the expert's and the voucher's are not.
  if (i.personallyReferredBy?.length) out.push({ key: "referred", label: `Personally referred by ${ownerLabel}`, note: "not a database match — someone here vouches for them by name", strength: "strong", icon: "vouch" });
  if (i.metInPerson) out.push({ key: "met", label: "Met in person", note: `by ${ownerLabel}${i.metInPerson.when ? ` · ${i.metInPerson.when}` : ""}`, strength: "strong", icon: "person" });
  if (worked.length) out.push({ key: "worked", label: "Worked with directly", note: again.length ? "by someone in our network, who would do it again" : "by someone in our network", strength: again.length ? "strong" : "medium", icon: "worked" });
  if (i.usedByUs) { const n = i.engagements ?? 0; out.push({ key: "used", label: "We have used them ourselves", note: n ? `on ${n} of our own engagement${n === 1 ? "" : "s"}` : "on our own delivery work", strength: "strong", icon: "check" }); }
  const rec = i.wouldRecommendCount ?? i.vouchCount;
  if (rec > 0) out.push({ key: "vouched", label: `Vouched for by ${rec}`, note: "people in our network, named to us and not to you", strength: rec >= 3 ? "strong" : "medium", icon: "vouch" });
  if (i.evidenceCount > 0) out.push({ key: "evidence", label: `${i.evidenceCount} piece${i.evidenceCount === 1 ? "" : "s"} of evidence`, note: "delivery someone here observed first hand", strength: "medium", icon: "evidence" });
  if (i.screened) out.push({ key: "screened", label: "Screened in conversation", note: "30 minutes, reviewed by a person here", strength: "light", icon: "screening" });
  if (!out.length) out.push({ key: "new", label: "Known, not yet worked with", note: "in our network; nobody here has delivered alongside them yet", strength: "light", icon: "ask" });
  return out;
}

/** One line for a table or a card, when there is no room for the strip. */
export function credibilityLine(badges: CredBadge[]): string {
  return badges.slice(0, 2).map((b) => b.label).join(" · ");
}
