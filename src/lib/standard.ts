/**
 * The standard: six proofs.
 *
 * A directory verifies people with a checklist of things they declare about themselves, reviewed
 * once, ending in one badge. A referral network can do better, because it holds something a
 * directory does not: who knows whom, and what they have seen. So each proof here is a fact on
 * record, with a witness, and not a promise. A person either holds it or does not yet, and the
 * last one lapses if it is not kept up.
 *
 * The same six are shown everywhere, said three ways: to the team with names, to the person
 * themselves with what would earn the next one, and to a client or agency with nothing that
 * identifies anybody. Nothing here reads cautions, so no audience can infer one from it.
 *
 * Shared by the app, the public page and tests. No I/O.
 */

export type ProofKey = "known" | "screened" | "vouched" | "worked" | "delivered" | "current";
export type Audience = "internal" | "self" | "outside";

/** The published wording: what each proof means, in one sentence anybody can check us against. */
export const PROOFS: { key: ProofKey; title: string; means: string }[] = [
  { key: "known", title: "Came through someone we know", means: "A named person in the network brought them in, or knows them first hand. We record who." },
  { key: "screened", title: "Screened", means: "A structured conversation about what they do and how they work, by voice or in writing. A person reads anything incomplete or unusual." },
  { key: "vouched", title: "Vouched for", means: "Someone who has seen them work has put their own name behind them, in their own words." },
  { key: "worked", title: "Worked with", means: "Someone here has delivered alongside them, and says whether they would again." },
  { key: "delivered", title: "Delivery on record", means: "Something they delivered, written down by the person who saw it." },
  { key: "current", title: "Up to date", means: "They have confirmed their availability recently. This proof lapses if it is not kept up." },
];

export type StandardInput = {
  /** How they reached us, if through a person. `null` means they came to us directly. */
  knownVia: { how: "introduced" | "contact"; by?: string | null } | null;
  screened: boolean;
  /** False when a complete screening was accepted without a person reading it. Said plainly to the team. */
  screeningRead?: boolean;
  /** Conversations a person here has approved the write-up of. */
  conversations: number;
  /** People inside the network who would recommend them. */
  vouches: number;
  /** Named references from outside the network, usually answered by link. Counted, and said apart. */
  references?: number;
  /** People here who have delivered alongside them, and the names where we may show them. */
  worked: number;
  workedBy?: string[];
  wouldWorkAgain: boolean;
  /** Pieces of delivery someone else saw and wrote down. Cautions and self-reported work excluded. */
  evidence: number;
  freshness: "fresh" | "aging" | "stale" | "unknown";
  /** Whole days since availability was last confirmed, when known. */
  confirmedDaysAgo?: number | null;
};

export type Proof = {
  key: ProofKey;
  title: string;
  held: boolean;
  /** What is on record, in words fit for the audience. */
  fact: string;
  /** What would earn it. Only for a proof not yet held, and never shown outside. */
  next: string | null;
};

export type Standard = { proofs: Proof[]; held: number; of: number; line: string };

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const ago = (days: number | null | undefined) => (days == null ? "recently" : days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

export function standard(i: StandardInput, audience: Audience = "internal"): Standard {
  const self = audience === "self", outside = audience === "outside";
  const spoken = i.screened || i.conversations > 0;
  const refs = i.references ?? 0, backers = i.vouches + refs;
  const whom = self ? "you" : "them";
  const current = i.freshness === "fresh" || i.freshness === "aging";
  const by = !outside && i.knownVia?.by ? i.knownVia.by : null;
  const workedNames = !outside && !self ? (i.workedBy ?? []).filter(Boolean) : [];

  const rows: Record<ProofKey, { held: boolean; fact: string; next: string }> = {
    known: {
      held: !!i.knownVia,
      fact: !i.knownVia ? (self ? "You came to us directly" : "Came to us directly")
        : outside ? "Came through someone we know"
        : i.knownVia.how === "introduced" ? (by ? (self ? `${by} introduced you` : `Introduced by ${by}`) : self ? "Someone we know introduced you" : "Introduced by someone we know")
        : by ? (self ? `${by} knows you first hand` : `${by} knows them first hand`) : self ? "Someone here knows you first hand" : "Someone here knows them first hand",
      next: self ? "Ask someone in the network who knows you to introduce you" : "Record who here knows them, or have one of us meet them",
    },
    screened: {
      held: spoken,
      fact: !spoken ? (self ? "You have not done your screening yet" : "Not screened yet")
        : outside ? "Screened in conversation"
        : i.screened ? (self ? "Your screening is complete" : i.screeningRead === false ? "Screening complete, accepted automatically" : "Screening complete, read by a person")
        : self ? `${n(i.conversations, "conversation", "conversations")} with us on record` : `${n(i.conversations, "conversation", "conversations")} on record`,
      next: self ? "Do your screening. It takes about 15 minutes, in your own time" : "Send them the screening. It runs without you",
    },
    vouched: {
      held: backers > 0,
      fact: backers === 0 ? (self ? "Nobody has vouched for you yet" : "Nobody has vouched for them yet")
        : outside ? `Vouched for by ${backers}`
        : [i.vouches ? `${n(i.vouches, "person here has", "people here have")} put their name behind ${whom}` : null, refs ? `${n(refs, "named reference", "named references")} from outside` : null].filter(Boolean).join(", plus "),
      next: self ? "Ask someone who has worked with you for a reference. It takes them a minute" : "Send a reference request to someone who has seen them deliver",
    },
    worked: {
      held: i.worked > 0,
      fact: i.worked === 0 ? (self ? "Nobody here has delivered with you yet" : "Nobody here has delivered with them yet")
        : outside ? (i.wouldWorkAgain ? "Worked with first hand, and would again" : "Worked with first hand")
        : self ? `${n(i.worked, "person here has", "people here have")} delivered with you`
        : `${workedNames.length ? `${workedNames.join(" and ")} ${workedNames.length === 1 ? "has" : "have"}` : n(i.worked, "person here has", "people here have")} delivered with them${i.wouldWorkAgain ? ", and would again" : ""}`,
      next: self ? "Earned on your first engagement through the network" : "Earned on a first engagement together",
    },
    delivered: {
      held: i.evidence > 0,
      fact: i.evidence === 0 ? (self ? "Nothing you delivered is on record yet" : "Nothing they delivered is on record yet")
        : outside ? "Delivery on record, seen first hand"
        : `${n(i.evidence, "piece", "pieces")} of delivery on record`,
      next: self ? "Earned when someone here writes down work they saw you deliver" : "Write down something you saw them deliver",
    },
    current: {
      held: current,
      fact: !current ? (self ? "Your availability has not been confirmed lately" : "Availability not confirmed lately")
        : outside ? "Availability confirmed recently"
        : `Availability confirmed ${ago(i.confirmedDaysAgo)}${i.freshness === "aging" ? ", due a check soon" : ""}`,
      next: self ? "Confirm your availability" : "Confirm their availability",
    },
  };

  const proofs: Proof[] = PROOFS.map(({ key, title }) => ({ key, title, held: rows[key].held, fact: rows[key].fact, next: rows[key].held || outside ? null : rows[key].next }));
  const held = proofs.filter((p) => p.held).length;
  return { proofs, held, of: PROOFS.length, line: `${held} of ${PROOFS.length} proofs` };
}

/** For a client or agency card: only the proofs held, as short statements that name nobody. */
export function proofsForOutside(i: StandardInput): string[] {
  return standard(i, "outside").proofs.filter((p) => p.held).map((p) => p.fact);
}

/** How many people in a list lack each proof. Where the network is thin, in one pass. */
export function gaps(all: StandardInput[]): Record<ProofKey, number> {
  const out = { known: 0, screened: 0, vouched: 0, worked: 0, delivered: 0, current: 0 } as Record<ProofKey, number>;
  for (const i of all) for (const p of standard(i).proofs) if (!p.held) out[p.key]++;
  return out;
}

export const isProofKey = (v: unknown): v is ProofKey => typeof v === "string" && PROOFS.some((p) => p.key === v);
