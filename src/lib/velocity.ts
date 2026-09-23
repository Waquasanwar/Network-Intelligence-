/**
 * How big the network really is, and whether knowing somebody actually helps.
 *
 * A referral network makes one claim: that starting from people you already know beats starting
 * from a search. That claim is either true in your own record or it is marketing, so this file
 * derives it rather than asserting it — how long a requirement takes to reach somebody's first day,
 * split by whether anybody here had worked with that person before.
 *
 * Two things are kept honest throughout:
 *
 *  - Medians, not averages. One nine-month placement should not move the headline.
 *  - A sample size on every figure, and a `thin` flag when there is too little to mean anything.
 *    A network with two placements should say "two placements", not imply a trend.
 *
 * Shared by the Next.js app and the browser prototype. No I/O.
 */

const DAY = 86_400_000;

export const daysBetween = (a: string | Date | null | undefined, b: string | Date | null | undefined): number | null => {
  if (!a || !b) return null;
  const x = new Date(a).getTime(), y = new Date(b).getTime();
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  const d = Math.round((y - x) / DAY);
  return d < 0 ? null : d;
};

export function median(xs: number[]): number | null {
  const v = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

// ---------- how big the network is ----------

export type ReachInput = {
  people: { id: string }[];
  /** Who in the network has said they would vouch for somebody not yet here. */
  referrals: { referredPersonId?: string | null }[];
  /** Relationships carry who introduced whom, which is the second degree. */
  relationships: { personId: string; introducedById?: string | null }[];
};

export type Reach = {
  /** People we hold a record for. */
  inNetwork: number;
  /** Of those, the ones somebody here reached through an introduction rather than knowing directly. */
  viaIntroduction: number;
  /** Named to us but not yet in the network — the edge of what we can reach. */
  namedNotYetJoined: number;
  /** Everybody we could get to today. */
  reachable: number;
};

export function reach(i: ReachInput): Reach {
  const inNetwork = i.people.length;
  const viaIntroduction = new Set(i.relationships.filter((r) => r.introducedById).map((r) => r.personId)).size;
  const namedNotYetJoined = i.referrals.filter((r) => !r.referredPersonId).length;
  return { inNetwork, viaIntroduction, namedNotYetJoined, reachable: inNetwork + namedNotYetJoined };
}

// ---------- how fast ----------

export type TimedPlacement = {
  personId: string;
  briefId: string;
  /** Requirement taken → this person proposed to the account. */
  toProposed: number | null;
  /** Requirement taken → somebody's first day. The number that matters. */
  toStart: number | null;
  /** Did anybody here work with this person before we proposed them? */
  knownBefore: boolean;
};

export type VelocityInput = {
  briefs: { id: string; createdAt: string }[];
  shortlist: { briefId: string; personId: string; decision: string; createdAt: string; updatedAt: string }[];
  /** Person ids somebody in the network had worked with directly. */
  workedWith: Set<string> | string[];
};

export type Velocity = {
  placements: TimedPlacement[];
  /** Median days from taking a requirement to somebody's first day. */
  daysToStart: number | null;
  /** Median days from taking a requirement to the first person being proposed. */
  daysToProposed: number | null;
  fastest: number | null;
  count: number;
  /** Too few placements to read anything into. */
  thin: boolean;
};

const PLACED = "PLACED";
const PROPOSED_ONWARD = ["PROPOSED", "CLIENT_INTERESTED", "CLIENT_PASSED", "INTRODUCED", "PLACED"];

export function velocity(i: VelocityInput): Velocity {
  const known = i.workedWith instanceof Set ? i.workedWith : new Set(i.workedWith);
  const briefAt = new Map(i.briefs.map((b) => [b.id, b.createdAt]));

  const placements: TimedPlacement[] = i.shortlist
    .filter((x) => x.decision === PLACED)
    .map((x) => {
      const opened = briefAt.get(x.briefId) ?? null;
      return {
        personId: x.personId,
        briefId: x.briefId,
        toProposed: daysBetween(opened, x.createdAt),
        toStart: daysBetween(opened, x.updatedAt),
        knownBefore: known.has(x.personId),
      };
    });

  const starts = placements.map((p) => p.toStart).filter((n): n is number => n !== null);
  // Time to first proposal is worth knowing for every requirement, not only the ones that filled.
  const firstProposed: number[] = [];
  for (const b of i.briefs) {
    const first = i.shortlist
      .filter((x) => x.briefId === b.id && PROPOSED_ONWARD.includes(x.decision))
      .map((x) => daysBetween(b.createdAt, x.createdAt))
      .filter((n): n is number => n !== null)
      .sort((a, c) => a - c)[0];
    if (first !== undefined) firstProposed.push(first);
  }

  return {
    placements,
    daysToStart: median(starts),
    daysToProposed: median(firstProposed),
    fastest: starts.length ? Math.min(...starts) : null,
    count: placements.length,
    thin: placements.length < 5,
  };
}

// ---------- does knowing somebody actually help ----------

export type Advantage = {
  /** Placements of people somebody here had worked with, and of people they had not. */
  known: { placements: number; medianDays: number | null };
  newToUs: { placements: number; medianDays: number | null };
  /** Days saved, when both sides have something to compare. Null when they do not. */
  daysSaved: number | null;
  /** Share of placements that were somebody we already knew, 0–100. */
  sharePct: number;
  thin: boolean;
  /** What the record actually supports, said plainly — including when it supports nothing yet. */
  line: string;
};

export function advantage(v: Velocity): Advantage {
  const known = v.placements.filter((p) => p.knownBefore);
  const fresh = v.placements.filter((p) => !p.knownBefore);
  const kd = median(known.map((p) => p.toStart).filter((n): n is number => n !== null));
  const nd = median(fresh.map((p) => p.toStart).filter((n): n is number => n !== null));
  const daysSaved = kd !== null && nd !== null ? nd - kd : null;
  const sharePct = v.placements.length ? Math.round((known.length / v.placements.length) * 100) : 0;

  let line: string;
  if (!v.placements.length) line = "No placements yet. The moment one lands, this is where the case for the network gets made or does not.";
  else if (daysSaved === null && known.length) line = `Every placement so far — ${known.length} of ${v.placements.length} — was somebody here had already worked with.`;
  else if (daysSaved === null) line = `${v.placements.length} placement${v.placements.length === 1 ? "" : "s"} so far, none of them somebody we had worked with before.`;
  else if (daysSaved > 0) line = `Somebody we had worked with reached their first day ${daysSaved} day${daysSaved === 1 ? "" : "s"} sooner than somebody new to us.`;
  else if (daysSaved < 0) line = `People new to us have actually been quicker by ${Math.abs(daysSaved)} day${Math.abs(daysSaved) === 1 ? "" : "s"}. Worth knowing rather than assuming.`;
  else line = "No difference in speed between people we knew and people we did not — on the placements so far.";

  return { known: { placements: known.length, medianDays: kd }, newToUs: { placements: fresh.length, medianDays: nd }, daysSaved, sharePct, thin: v.thin, line };
}

// ---------- everything the demand side has ever asked for ----------

export type DemandTotals = {
  /** Requirements plus opportunities, ever — not just the open ones. */
  taken: number;
  open: number;
  filled: number;
  /** Requirements filled as a share of those that reached a conclusion. */
  fillRatePct: number;
  /** People asked for across every requirement, since one requirement can want three. */
  headcount: number;
};

export function demandTotals(
  briefs: { status: string; headcount?: number | null }[],
  opportunities: { status: string }[],
): DemandTotals {
  const closedStates = ["FILLED", "CLOSED"];
  const filled = briefs.filter((b) => b.status === "FILLED").length;
  const concluded = briefs.filter((b) => closedStates.includes(b.status)).length;
  const openBriefs = briefs.filter((b) => !closedStates.includes(b.status)).length;
  const openOpps = opportunities.filter((o) => !["CLOSED_WON", "CLOSED_LOST"].includes(o.status)).length;
  return {
    taken: briefs.length + opportunities.length,
    open: openBriefs + openOpps,
    filled,
    fillRatePct: concluded ? Math.round((filled / concluded) * 100) : 0,
    headcount: briefs.reduce((a, b) => a + Math.max(1, b.headcount ?? 1), 0),
  };
}
