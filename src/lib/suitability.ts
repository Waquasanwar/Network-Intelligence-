/**
 * One signal for "is this a good match", built from the things we already know.
 *
 * Matching people to work is not recruitment screening and it is not a keyword search. The question
 * is narrower and more human: can they do this, will we vouch for them, can they actually take it,
 * and will they land well in that room. Those four are scored separately and shown separately —
 * a high score that comes entirely from capability means something different from one that comes
 * from trust, and hiding that in a single number would be dishonest.
 *
 * The output is deliberately shaped for a quick decision: one figure, four bars, one sentence, and
 * the single thing most likely to sink it.
 *
 * Shared by the Next.js app and the browser prototype. No I/O.
 */
import type { HardCheck } from "./demand";
import type { FitCheck } from "./fit";

export type SuitabilityInput = {
  /** 0–100 from the matcher: capability, sector and seniority overlap with this brief. */
  capabilityScore: number;
  /** 0–100 network confidence in the person, independent of any brief. */
  trustScore: number;
  /** The brief's hard requirements: location, work rights, route. */
  checks: HardCheck[];
  /** How the working-style traits the brief asked for line up. */
  fit: FitCheck[];
  /** Pieces of observed delivery evidence. */
  evidenceCount: number;
  /** Somebody here has worked with them, or we have used them ourselves. */
  workedWith: boolean;
  usedByUs: boolean;
  /** Availability as a fraction: 1 means available now, 0 means not looking. */
  availability: number;
};

export type SuitabilityPart = { key: "capability" | "trust" | "practical" | "fit"; label: string; score: number; weight: number; note: string };

export type Suitability = {
  score: number;
  band: "strong" | "worth a conversation" | "stretch" | "no";
  parts: SuitabilityPart[];
  /** The one thing most likely to stop this working, said plainly. Null when there isn't one. */
  watchOut: string | null;
  /** A sentence a human would actually say. */
  line: string;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const BAND_LABEL: Record<Suitability["band"], string> = {
  strong: "Strong match",
  "worth a conversation": "Worth a conversation",
  stretch: "Stretch",
  no: "Not for this",
};
export const suitabilityLabel = (b: Suitability["band"]) => BAND_LABEL[b];

/**
 * Practical fit: can they actually take this? A failed hard requirement is not a small deduction,
 * because "brilliant, but cannot work there" is not a match at all.
 */
function practicalScore(checks: HardCheck[], availability: number): { score: number; note: string } {
  if (!checks.length) return { score: Math.round(60 + availability * 40), note: "Nothing hard to check on this brief." };
  const unmet = checks.filter((c) => c.state === "unmet");
  const unknown = checks.filter((c) => c.state === "unknown");
  let score = 100 - unmet.length * 45 - unknown.length * 15;
  score = score * (0.6 + availability * 0.4);
  const note = unmet.length ? `${unmet[0].label} does not work.` : unknown.length ? `${unknown[0].label} still to confirm.` : "Everything the brief insists on is met.";
  return { score: clamp(score), note };
}

function fitScore(fit: FitCheck[]): { score: number; note: string } {
  if (!fit.length) return { score: 55, note: "The brief did not ask for a particular style." };
  const v = { strong: 100, moderate: 65, unknown: 45, gap: 20 } as const;
  const avg = fit.reduce((a, f) => a + v[f.state], 0) / fit.length;
  const gap = fit.find((f) => f.state === "gap");
  const strong = fit.find((f) => f.state === "strong");
  return { score: clamp(avg), note: gap ? `${gap.label} is the gap.` : strong ? `${strong.label} is a strength.` : "Style is roughly right." };
}

/**
 * The combined signal. Capability and trust carry the most, because a person who can do it and
 * whom somebody here stands behind is the whole proposition; practical fit gates the rest.
 */
export function suitability(i: SuitabilityInput): Suitability {
  const practical = practicalScore(i.checks, i.availability);
  const fit = fitScore(i.fit);
  const trustBoost = clamp(i.trustScore + (i.usedByUs ? 8 : 0) + (i.workedWith ? 5 : 0) + Math.min(10, i.evidenceCount * 4));

  const parts: SuitabilityPart[] = [
    { key: "capability", label: "Capability", score: clamp(i.capabilityScore), weight: 0.34, note: i.capabilityScore >= 70 ? "Does this kind of work." : i.capabilityScore >= 45 ? "Adjacent, not central." : "Not their patch." },
    { key: "trust", label: "Trust", score: trustBoost, weight: 0.3, note: i.usedByUs ? "We have used them ourselves." : i.workedWith ? "Someone here has worked with them." : trustBoost >= 60 ? "Several people stand behind them." : "Not many people have vouched yet." },
    { key: "practical", label: "Practical", score: practical.score, weight: 0.24, note: practical.note },
    { key: "fit", label: "Style", score: fit.score, weight: 0.12, note: fit.note },
  ];

  let score = clamp(parts.reduce((a, p) => a + p.score * p.weight, 0));
  // A hard requirement that is genuinely unmet caps the whole thing: no amount of brilliance fixes a visa.
  const unmet = i.checks.filter((c) => c.state === "unmet");
  if (unmet.length) score = Math.min(score, 44);

  const band: Suitability["band"] = unmet.length && practical.score < 30 ? "no" : score >= 72 ? "strong" : score >= 52 ? "worth a conversation" : "stretch";

  const watchOut = unmet.length ? unmet[0].note
    : i.checks.find((c) => c.state === "unknown")?.note
    ?? (trustBoost < 45 ? "Nobody has worked with them yet — a vouch would change this." : null);

  const strongest = [...parts].sort((a, b) => b.score - a.score)[0];
  const weakest = [...parts].sort((a, b) => a.score - b.score)[0];
  const line = band === "no"
    ? `Not for this one: ${weakest.note.toLowerCase()}`
    : `${BAND_LABEL[band]} — strongest on ${strongest.label.toLowerCase()}${weakest.score < 50 ? `, weakest on ${weakest.label.toLowerCase()}` : ""}. ${strongest.note}`;

  return { score, band, parts, watchOut, line };
}
