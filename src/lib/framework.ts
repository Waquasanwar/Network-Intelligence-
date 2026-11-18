/**
 * The Amana trust framework: 22 checks in five areas, behind the one trust score.
 *
 * Each check is something that can be verified, never something a person says about themselves.
 * Seventeen are worked out from the record (an introduction, a vouch, a reference, a screening, a
 * date). Five can only be confirmed by someone on the team, and are stored with their name and the
 * date, so "checked" always means "checked by whom, and when". The score is the weight of the
 * checks held, out of 100.
 *
 * The six proofs (src/lib/standard.ts) are the plain summary shown to members and clients. This is
 * the detail behind them, for the team. Shared by the app and tests. No I/O.
 */
import type { StandardInput } from "@/lib/standard";
import { trustBand, type TrustBand } from "@/lib/trust";

export type ManualKey = "email" | "linkedin" | "met" | "personal" | "qualifications";
export type CheckKey =
  | ManualKey | "rightToWork"
  | "named" | "yearsKnown" | "introducer"
  | "vouchedInside" | "reference" | "twoBackers" | "workedWith" | "delivery" | "wouldAgain"
  | "screened" | "screeningRead" | "expertise"
  | "current" | "noCaution" | "consent" | "privacy";
export type AreaKey = "identity" | "relationship" | "record" | "competence" | "reliability";
/** Who can make a check true: the record alone, a person on the team, or either. */
export type How = "record" | "you" | "either";

type Def = { key: CheckKey; title: string; weight: number; how: How; means: string };
export const AREAS: { key: AreaKey; title: string; question: string; checks: Def[] }[] = [
  { key: "identity", title: "Identity", question: "Are they who they say they are?", checks: [
    { key: "email", title: "Email confirmed", weight: 3, how: "you", means: "Their email address is theirs: they answered from it, or you confirmed it." },
    { key: "linkedin", title: "LinkedIn checked", weight: 4, how: "you", means: "Their LinkedIn matches their name and the history they gave." },
    { key: "met", title: "Met by video or in person", weight: 5, how: "either", means: "Someone here has seen them, not only read about them." },
    { key: "rightToWork", title: "Right to work stated", weight: 3, how: "record", means: "Where they can work, from their screening." },
  ] },
  { key: "relationship", title: "Relationship", question: "How do we know them?", checks: [
    { key: "named", title: "Came through a named person", weight: 5, how: "record", means: "An invitation or introduction from someone we can name." },
    { key: "personal", title: "Known personally", weight: 7, how: "either", means: "Someone on the team knows them first hand, not through a list." },
    { key: "yearsKnown", title: "Years known recorded", weight: 3, how: "record", means: "How long the relationship goes back." },
    { key: "introducer", title: "Their introducer is trusted", weight: 5, how: "record", means: "Whoever brought them in is the team, or a screened member someone vouches for." },
  ] },
  { key: "record", title: "Track record", question: "What have other people seen?", checks: [
    { key: "vouchedInside", title: "Vouched for inside the network", weight: 8, how: "record", means: "Someone in the network has put their name behind them." },
    { key: "reference", title: "Outside reference", weight: 5, how: "record", means: "A named person outside the network answered a reference by link." },
    { key: "twoBackers", title: "Two or more backers", weight: 5, how: "record", means: "More than one person stands behind them, independently." },
    { key: "workedWith", title: "Worked with someone here", weight: 7, how: "record", means: "Someone on the team or in the network has delivered alongside them." },
    { key: "delivery", title: "Delivery seen first hand", weight: 6, how: "record", means: "Something they delivered, written down by the person who saw it." },
    { key: "wouldAgain", title: "Would work with again", weight: 4, how: "record", means: "Someone who worked with them says they would do it again." },
  ] },
  { key: "competence", title: "Competence", question: "Can they do the work?", checks: [
    { key: "screened", title: "Screening complete", weight: 7, how: "record", means: "A structured conversation about what they do and how they work." },
    { key: "screeningRead", title: "Screening read by a person", weight: 3, how: "record", means: "Someone here read it, rather than it being accepted automatically." },
    { key: "expertise", title: "Expertise confirmed by a witness", weight: 5, how: "record", means: "Their skills are recorded and someone who saw them work backs them." },
    { key: "qualifications", title: "Qualifications checked", weight: 5, how: "you", means: "A professional body, licence or certificate you looked up (for example ACCA, PMP, FCA)." },
  ] },
  { key: "reliability", title: "Reliability", question: "Are they current and dependable?", checks: [
    { key: "current", title: "Availability confirmed lately", weight: 4, how: "record", means: "Confirmed in the last 45 days, by them or by us." },
    { key: "noCaution", title: "No caution on record", weight: 3, how: "record", means: "Nobody has recorded a reason to be careful." },
    { key: "consent", title: "Agreed to be put forward", weight: 2, how: "record", means: "They have said yes to being referred for work." },
    { key: "privacy", title: "Privacy choices up to date", weight: 1, how: "record", means: "They have reviewed what we may do with their profile in the last year." },
  ] },
];
export const CHECKS = AREAS.flatMap((a) => a.checks.map((c) => ({ ...c, area: a.key })));
export const MANUAL_KEYS: ManualKey[] = ["email", "linkedin", "met", "personal", "qualifications"];
export const isManualKey = (v: unknown): v is ManualKey => typeof v === "string" && (MANUAL_KEYS as string[]).includes(v);

/** A check someone on the team confirmed: who, when, and what they looked at. */
export type Signed = { by: string; at: string; note?: string | null };

export type FrameworkInput = Pick<StandardInput, "knownVia" | "screened" | "screeningRead" | "conversations" | "vouches" | "references" | "worked" | "workedBy" | "wouldWorkAgain" | "evidence" | "freshness" | "confirmedDaysAgo"> & {
  manual: Partial<Record<ManualKey, Signed>>;
  /** Approved conversations that were a real call or meeting, not a screening form. */
  calls: number;
  workRights: number;
  /** The relationship is recorded as a personal contact or as having worked together. */
  personalContact: boolean;
  yearsKnown: number | null;
  /** Null when they were not introduced by a member. */
  introducerTrusted: boolean | null;
  capabilities: number;
  cautions: number;
  referralConsent: string | null;
  privacyReviewedDaysAgo: number | null;
};

export type Check = { key: CheckKey; area: AreaKey; title: string; means: string; weight: number; how: How; held: boolean; fact: string; signed: Signed | null; canSign: boolean };
export type Area = { key: AreaKey; title: string; question: string; checks: Check[]; held: number; of: number; points: number; max: number };
export type Framework = { score: number; band: TrustBand; held: number; of: number; areas: Area[]; vouchedBy: number };

const n = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`;
const when = (s: Signed) => { const d = new Date(s.at); return isNaN(d.getTime()) ? "" : ` · ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`; };
const signedFact = (s: Signed, verb: string) => `${verb} by ${s.by}${when(s)}${s.note ? ` · ${s.note}` : ""}`;

/**
 * Work out every check. `audience: "self"` is what the person themselves may see: no check reads
 * a caution, so the score cannot betray that one exists.
 */
export function framework(i: FrameworkInput, audience: "internal" | "self" = "internal"): Framework {
  const self = audience === "self";
  const backers = i.vouches + (i.references ?? 0);
  const m = i.manual;
  const facts: Record<CheckKey, { held: boolean; fact: string; signed?: Signed | null }> = {
    email: m.email ? { held: true, fact: signedFact(m.email, "Confirmed"), signed: m.email } : { held: false, fact: "Not confirmed yet" },
    linkedin: m.linkedin ? { held: true, fact: signedFact(m.linkedin, "Checked"), signed: m.linkedin } : { held: false, fact: "Not checked yet" },
    met: m.met ? { held: true, fact: signedFact(m.met, "Met"), signed: m.met } : i.calls ? { held: true, fact: `${n(i.calls, "call or meeting", "calls or meetings")} on record` } : { held: false, fact: "No call or meeting on record" },
    rightToWork: i.workRights ? { held: true, fact: `${n(i.workRights, "place", "places")} stated` } : { held: false, fact: "Not stated yet; the screening asks" },
    named: i.knownVia ? { held: true, fact: i.knownVia.how === "introduced" ? (i.knownVia.by ? `Introduced by ${i.knownVia.by}` : "Introduced by a member") : i.knownVia.by ? `${i.knownVia.by}'s contact` : "A team contact" } : { held: false, fact: "Came in directly" },
    personal: m.personal ? { held: true, fact: signedFact(m.personal, "Known personally") , signed: m.personal } : i.personalContact ? { held: true, fact: i.knownVia?.by ? `${i.knownVia.by} knows them first hand` : "A personal contact" } : { held: false, fact: "Nobody here knows them personally yet" },
    yearsKnown: i.yearsKnown ? { held: true, fact: `${n(i.yearsKnown, "year", "years")}` } : { held: false, fact: "Not recorded" },
    introducer: i.introducerTrusted === null ? (i.knownVia && i.knownVia.how === "contact" ? { held: true, fact: "Brought in by the team" } : { held: false, fact: "No introducer" }) : i.introducerTrusted ? { held: true, fact: "Their introducer is screened and vouched for" } : { held: false, fact: "Their introducer is not yet screened and vouched for" },
    vouchedInside: i.vouches ? { held: true, fact: `${n(i.vouches, "person", "people")} in the network` } : { held: false, fact: "Nobody inside the network yet" },
    reference: i.references ? { held: true, fact: `${n(i.references ?? 0, "reference", "references")} by link` } : { held: false, fact: "None yet; send a reference link" },
    twoBackers: backers >= 2 ? { held: true, fact: `${backers} backers` } : { held: false, fact: backers ? "One so far" : "None yet" },
    workedWith: i.worked ? { held: true, fact: self || !i.workedBy?.length ? n(i.worked, "person here", "people here") : `${i.workedBy.join(" and ")}` } : { held: false, fact: "Not yet" },
    delivery: i.evidence ? { held: true, fact: n(i.evidence, "piece of delivery", "pieces of delivery") } : { held: false, fact: "Nothing written down by a witness yet" },
    wouldAgain: i.wouldWorkAgain ? { held: true, fact: "Said by someone who worked with them" } : { held: false, fact: "Not said yet" },
    screened: i.screened ? { held: true, fact: "Complete" } : i.conversations ? { held: true, fact: `${n(i.conversations, "conversation", "conversations")} on record` } : { held: false, fact: "Not done yet" },
    screeningRead: i.screened && i.screeningRead !== false ? { held: true, fact: "Read by a person" } : { held: false, fact: i.screened ? "Accepted automatically, not read" : "No screening yet" },
    expertise: i.capabilities && (backers + i.evidence) > 0 ? { held: true, fact: `${n(i.capabilities, "skill", "skills")} recorded, backed by a witness` } : { held: false, fact: i.capabilities ? "Skills recorded, nobody has backed them yet" : "No skills recorded yet" },
    qualifications: m.qualifications ? { held: true, fact: signedFact(m.qualifications, "Checked"), signed: m.qualifications } : { held: false, fact: "Not checked" },
    current: i.freshness === "fresh" || i.freshness === "aging" ? { held: true, fact: i.confirmedDaysAgo == null ? "Recently" : i.confirmedDaysAgo === 0 ? "Today" : `${n(i.confirmedDaysAgo, "day", "days")} ago` } : { held: false, fact: "Not confirmed lately" },
    noCaution: self || !i.cautions ? { held: true, fact: "None" } : { held: false, fact: `${n(i.cautions, "caution", "cautions")}. Read before positioning` },
    consent: i.referralConsent === "yes" ? { held: true, fact: "Yes" } : { held: false, fact: i.referralConsent === "no" ? "Not for now" : "Asked each time" },
    privacy: i.privacyReviewedDaysAgo != null && i.privacyReviewedDaysAgo <= 365 ? { held: true, fact: i.privacyReviewedDaysAgo === 0 ? "Today" : `${n(i.privacyReviewedDaysAgo, "day", "days")} ago` } : { held: false, fact: "Not reviewed in the last year" },
  };
  const areas: Area[] = AREAS.map((a) => {
    const checks: Check[] = a.checks.map((d) => ({ key: d.key, area: a.key, title: d.title, means: d.means, weight: d.weight, how: d.how, held: facts[d.key].held, fact: facts[d.key].fact, signed: facts[d.key].signed ?? null, canSign: isManualKey(d.key) }));
    const held = checks.filter((c) => c.held);
    return { key: a.key, title: a.title, question: a.question, checks, held: held.length, of: checks.length, points: held.reduce((s, c) => s + c.weight, 0), max: checks.reduce((s, c) => s + c.weight, 0) };
  });
  const score = Math.max(0, Math.min(100, areas.reduce((s, a) => s + a.points, 0)));
  const held = areas.reduce((s, a) => s + a.held, 0);
  return { score, band: trustBand(score), held, of: CHECKS.length, areas, vouchedBy: backers };
}
