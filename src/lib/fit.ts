/**
 * Fit profile: working-style attributes that help judge whether someone will land well in a
 * client's environment. Self-assessed in the screening call, and observed by people who
 * vouch for them. Shown as a profile, never as a pass/fail. A brief can name the traits it
 * needs ("politically astute", "assertive with the SI") and the match labels the fit.
 *
 * Attributes are about behaviour at work. Never protected characteristics.
 * Shared by the Next.js app and the browser prototype. No I/O.
 */

export type AttributeKey = "assertiveness" | "conflict" | "political" | "commercial" | "collaboration" | "ambiguity" | "influence" | "pace";

export type AttributeDef = { key: AttributeKey; label: string; low: string; high: string; question: string; keywords: RegExp };

export const ATTRIBUTES: AttributeDef[] = [
  { key: "assertiveness", label: "Assertiveness", low: "Accommodating", high: "Holds the line", question: "When a plan is wrong, how readily do you say so, and to whom?", keywords: /\b(assertive|assertiveness|holds? the line|push(es)? back|challenge(s|r)?|no[- ]nonsense|direct)\b/i },
  { key: "conflict", label: "Conflict handling", low: "Avoids", high: "Resolves head-on", question: "How do you handle a disagreement between two senior stakeholders?", keywords: /\b(conflict|difficult conversations?|dispute|confrontation|diplomatic|diplomacy)\b/i },
  { key: "political", label: "Political awareness", low: "Takes things at face value", high: "Reads the room", question: "How do you work out who really decides, and what they need to hear?", keywords: /\b(politic(al|s|ally)|astute|savvy|reads? the room|stakeholder[- ]savvy|navigat(e|es|ing) (the )?(organisation|politics))\b/i },
  { key: "commercial", label: "Commercial awareness", low: "Delivery first", high: "Thinks in P&L", question: "What commercial trade-off have you had to make in the last year?", keywords: /\b(commercial(ly)?( aware| minded| awareness)?|p&l|margin|budget[- ]conscious|cost[- ]aware|value for money)\b/i },
  { key: "collaboration", label: "Collaboration", low: "Works best alone", high: "Builds the team", question: "Do you do your best work leading a team, inside one, or on your own?", keywords: /\b(collaborat(ive|ion|or)|team player|builds? (a |the )?team|inclusive)\b/i },
  { key: "ambiguity", label: "Comfort with ambiguity", low: "Needs structure", high: "Thrives in mess", question: "How do you feel on day one when nobody can tell you what good looks like?", keywords: /\b(ambigu(ity|ous)|messy|unstructured|greenfield|start[- ]?up|chaos|thrives? in)\b/i },
  { key: "influence", label: "Influence without authority", low: "Works through the hierarchy", high: "Brings people with them", question: "Tell me about moving something forward that you did not control.", keywords: /\b(influenc(e|ing)|persuad(e|es|ing)|brings? people|gravitas|credib(le|ility) with the board|board[- ]level)\b/i },
  { key: "pace", label: "Pace", low: "Steady and thorough", high: "Fast and decisive", question: "Would colleagues say you are fast and decisive, or steady and thorough?", keywords: /\b(fast[- ]paced|decisive|quick|urgent|steady|thorough|methodical|pace)\b/i },
];

export type FitScores = Partial<Record<AttributeKey, number>>; // 1–5

export type FitProfileRow = { key: AttributeKey; label: string; self: number | null; peers: number | null; peerCount: number; combined: number | null; low: string; high: string };

/** Combine a self-assessment with what vouchers observed. Peers count more than self when there are two or more. */
export function fitProfile(self: FitScores | null | undefined, observed: FitScores[]): FitProfileRow[] {
  return ATTRIBUTES.map((a) => {
    const s = self?.[a.key] ?? null;
    const obs = observed.map((o) => o[a.key]).filter((v): v is number => typeof v === "number" && v > 0);
    const peers = obs.length ? obs.reduce((x, y) => x + y, 0) / obs.length : null;
    const combined = peers !== null && s !== null ? (obs.length >= 2 ? peers * 0.7 + s * 0.3 : (peers + s) / 2) : peers ?? s;
    return { key: a.key, label: a.label, self: s, peers: peers === null ? null : Math.round(peers * 10) / 10, peerCount: obs.length, combined: combined === null ? null : Math.round(combined * 10) / 10, low: a.low, high: a.high };
  });
}

/** Traits a brief asks for, read from its text. */
export function parseFitTraits(text: string): AttributeKey[] {
  return ATTRIBUTES.filter((a) => a.keywords.test(text)).map((a) => a.key);
}

export type FitCheck = { key: AttributeKey; label: string; state: "strong" | "moderate" | "unknown" | "gap"; note: string };

/** Label how someone's profile lines up with the traits a brief asks for. Never used to exclude. */
export function fitChecks(traits: AttributeKey[], profile: FitProfileRow[]): FitCheck[] {
  return traits.map((t) => {
    const row = profile.find((r) => r.key === t)!;
    const v = row.combined;
    if (v === null) return { key: t, label: row.label, state: "unknown", note: `${row.label} not assessed yet. Ask in the screening or a vouch.` };
    const src = row.peerCount ? `${row.peerCount} ${row.peerCount === 1 ? "person" : "people"} observed` : "self-assessed";
    if (v >= 4) return { key: t, label: row.label, state: "strong", note: `${row.label} ${v}/5 (${src}).` };
    if (v >= 3) return { key: t, label: row.label, state: "moderate", note: `${row.label} ${v}/5 (${src}). Worth exploring.` };
    return { key: t, label: row.label, state: "gap", note: `${row.label} ${v}/5 (${src}). The brief asks for more.` };
  });
}

/** Short, human chips for an anonymised card: the top observed or self-assessed strengths. */
export function fitHighlights(profile: FitProfileRow[], max = 3): string[] {
  return profile.filter((r) => r.combined !== null && r.combined >= 4).sort((a, b) => (b.combined ?? 0) - (a.combined ?? 0)).slice(0, max).map((r) => r.label.toLowerCase());
}
