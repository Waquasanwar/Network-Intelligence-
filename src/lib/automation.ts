/**
 * What the platform does on its own, and who you should go and see.
 *
 * Two halves of the same idea. The first is the automation people expect from software: rules that
 * run quietly, each one stateable in a sentence, each one switchable off. The second is the part
 * that makes a referral network work at all — actually seeing people. A coffee is not a CRM task,
 * so the suggestions here are written the way you would say them to yourself.
 *
 * Deterministic and offline. Shared by the Next.js app and the browser prototype. No I/O.
 */

export type AutomationKey =
  | "reconnect" | "staleStatus" | "screenInvite" | "refreshShortlists"
  | "alertJoiners" | "alertPitches" | "weeklyDigest" | "catchUpRadar" | "retentionSweep";

export type Automation = {
  key: AutomationKey;
  label: string;
  /** What it does, in one sentence, in the present tense. */
  does: string;
  /** Why it exists — the thing that goes wrong without it. */
  why: string;
  cadence: string;
  /** On unless someone says otherwise; the noisier ones start off. */
  defaultOn: boolean;
};

export const AUTOMATIONS: Automation[] = [
  { key: "reconnect", label: "Reconnect queue", does: "Puts anyone you have worked with, or who is on the bench, back in front of you when their status goes cold.", why: "A network decays quietly. This is the thing that stops it.", cadence: "daily", defaultOn: true },
  { key: "staleStatus", label: "Availability check", does: "Marks a status stale once it is past its check date, and suggests a two-line message.", why: "Proposing someone whose situation changed six months ago is how trust is lost.", cadence: "daily", defaultOn: true },
  { key: "screenInvite", label: "Screening invitations", does: "Invites anyone who registered but has not had the conversation yet.", why: "A registration with no conversation is a name, not a profile.", cadence: "daily", defaultOn: true },
  { key: "refreshShortlists", label: "Shortlist refresh", does: "Re-runs the hard-requirement checks on every open requirement when a brief or a profile changes.", why: "A visa or a location changes and a shortlist silently becomes wrong.", cadence: "on change", defaultOn: true },
  { key: "alertJoiners", label: "New joiner alerts", does: "Tells you the moment someone joins through the link, with how they found us.", why: "The first 24 hours is when a new member is actually interested.", cadence: "immediate", defaultOn: true },
  { key: "alertPitches", label: "Pitch and referral alerts", does: "Tells you when a member pitches for something or refers somebody.", why: "Somebody put their name to something. That deserves a same-day reply.", cadence: "immediate", defaultOn: true },
  { key: "weeklyDigest", label: "Monday digest", does: "One email on Monday: who joined, who is stale, what is open, what is owed.", why: "So the network gets ten minutes a week even in a busy one.", cadence: "weekly", defaultOn: false },
  { key: "catchUpRadar", label: "Catch-up radar", does: "Suggests people to see in person when you are in the same city, or when it has simply been too long.", why: "This is a network of people you know. Knowing them has a half-life.", cadence: "weekly", defaultOn: true },
  { key: "retentionSweep", label: "Retention sweep", does: "Flags anything past its retention date for deletion or anonymisation, and anyone whose consent needs re-asking.", why: "Keeping data forever is the easiest promise to break.", cadence: "monthly", defaultOn: true },
];

export const DEFAULT_AUTOMATIONS: Record<AutomationKey, boolean> = AUTOMATIONS.reduce(
  (acc, a) => { acc[a.key] = a.defaultOn; return acc; },
  {} as Record<AutomationKey, boolean>,
);

// ---------- the human half: who to go and see ----------

export type CatchUpKind = "coffee" | "lunch" | "brunch" | "call" | "walk";

export const CATCH_UPS: { key: CatchUpKind; label: string; verb: string; emoji: string; minutes: number }[] = [
  { key: "coffee", label: "Coffee", verb: "grab a coffee", emoji: "☕", minutes: 45 },
  { key: "brunch", label: "Brunch", verb: "do brunch", emoji: "🍳", minutes: 90 },
  { key: "lunch", label: "Lunch", verb: "get lunch", emoji: "🥗", minutes: 60 },
  { key: "walk", label: "Walk", verb: "go for a walk", emoji: "🚶", minutes: 40 },
  { key: "call", label: "Call", verb: "have a proper call", emoji: "📞", minutes: 30 },
];

export type CatchUpPerson = {
  id: string;
  name: string;
  city?: string | null;
  lastContactAt?: string | Date | null;
  workedTogether: boolean;
  openTo?: CatchUpKind[];
  interests?: string[];
};

export type CatchUpSuggestion = {
  personId: string;
  name: string;
  reason: string;
  /** What to suggest doing, picked from what they said they are up for. */
  kind: CatchUpKind;
  /** Higher is more worth doing this week. */
  score: number;
  months: number | null;
};

const monthsSince = (d: string | Date | null | undefined, now: Date): number | null => {
  if (!d) return null;
  const t = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(t.getTime())) return null;
  return (now.getFullYear() - t.getFullYear()) * 12 + (now.getMonth() - t.getMonth());
};

/**
 * Who is worth seeing, and why. Being in the same city beats everything, because that is the week
 * it is actually possible; after that it is simply how long it has been.
 */
export function catchUpSuggestions(people: CatchUpPerson[], myCity: string | null | undefined, now = new Date(), limit = 5): CatchUpSuggestion[] {
  const here = (myCity ?? "").trim().toLowerCase();
  const out: CatchUpSuggestion[] = people.map((p) => {
    const months = monthsSince(p.lastContactAt, now);
    const sameCity = !!here && (p.city ?? "").trim().toLowerCase() === here;
    const openTo = p.openTo ?? [];
    const kind: CatchUpKind = openTo[0] ?? (sameCity ? "coffee" : "call");
    let score = 0;
    if (sameCity) score += 40;
    if (openTo.length) score += 20;
    if (p.workedTogether) score += 15;
    if (months === null) score += 25; // never spoken properly is its own kind of overdue
    else score += Math.min(40, months * 5);
    const reason = months === null
      ? sameCity ? `In ${p.city} like you, and you have never sat down properly` : "You have never had a proper catch-up"
      : months === 0
        ? sameCity ? `Both in ${p.city} — an easy one to line up` : "Spoke recently; worth keeping warm"
        : sameCity ? `Both in ${p.city}, and it has been ${months} month${months === 1 ? "" : "s"}` : `${months} month${months === 1 ? "" : "s"} since you spoke`;
    return { personId: p.id, name: p.name, reason, kind, score, months };
  });
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** A line to open with, so nobody has to think of one. Interests make it a message, not a ping. */
export function catchUpOpener(s: CatchUpSuggestion, interests: string[] = [], me = "me"): string {
  const kind = CATCH_UPS.find((c) => c.key === s.kind) ?? CATCH_UPS[0];
  const hook = interests.length ? ` I still owe you a conversation about ${interests[0].toLowerCase()}.` : "";
  const gap = s.months === null ? "we have never had a proper catch-up" : s.months >= 6 ? `it has been ${s.months} months` : s.months === 0 ? "I am around this week" : "it has been a while";
  return `${s.name.split(" ")[0]} — ${gap}. Fancy a ${kind.label.toLowerCase()} in the next couple of weeks?${hook}`;
}
