/**
 * The characteristics you can tap rather than type.
 *
 * After meeting someone, nobody wants to fill in a form. This is the vocabulary for that: short,
 * concrete phrases you would actually say about a person, each one mapped to something the system
 * already understands — the eight working-style attributes in fit.ts, or a human tag that lives on
 * the profile so we remember who they are.
 *
 * Two rules the list obeys:
 *  - every phrase describes behaviour at work or a stated interest, never a protected characteristic;
 *  - nothing here is a judgement of the person, so the low end of a scale is a real answer
 *    ("steady and thorough") rather than a failing.
 *
 * Shared by the Next.js app and the browser prototype. No I/O.
 */
import { ATTRIBUTES, type AttributeKey, type FitScores } from "./fit";

/** A tappable phrase that sets one attribute. `score` is what selecting it means, 1–5. */
export type TraitChip = { key: string; label: string; attribute: AttributeKey; score: number };

export const TRAIT_CHIPS: TraitChip[] = [
  { key: "holds-line", label: "Holds the line", attribute: "assertiveness", score: 5 },
  { key: "says-it", label: "Says the difficult thing", attribute: "assertiveness", score: 4 },
  { key: "accommodating", label: "Accommodating", attribute: "assertiveness", score: 2 },

  { key: "resolves", label: "Resolves conflict head-on", attribute: "conflict", score: 5 },
  { key: "diplomatic", label: "Diplomatic", attribute: "conflict", score: 4 },
  { key: "avoids-conflict", label: "Avoids confrontation", attribute: "conflict", score: 2 },

  { key: "reads-room", label: "Reads the room", attribute: "political", score: 5 },
  { key: "stakeholder", label: "Good with stakeholders", attribute: "political", score: 4 },
  { key: "face-value", label: "Takes things at face value", attribute: "political", score: 2 },

  { key: "commercial", label: "Commercially sharp", attribute: "commercial", score: 5 },
  { key: "cost-aware", label: "Cost-aware", attribute: "commercial", score: 4 },
  { key: "delivery-first", label: "Delivery first, money second", attribute: "commercial", score: 2 },

  { key: "builds-team", label: "Builds a team around them", attribute: "collaboration", score: 5 },
  { key: "generous", label: "Generous with credit", attribute: "collaboration", score: 4 },
  { key: "lone", label: "Works best alone", attribute: "collaboration", score: 2 },

  { key: "thrives-mess", label: "Thrives in a mess", attribute: "ambiguity", score: 5 },
  { key: "makes-start", label: "Makes a start with no brief", attribute: "ambiguity", score: 4 },
  { key: "needs-structure", label: "Wants structure", attribute: "ambiguity", score: 2 },

  { key: "gravitas", label: "Has gravitas at board level", attribute: "influence", score: 5 },
  { key: "persuades", label: "Brings people with them", attribute: "influence", score: 4 },
  { key: "through-hierarchy", label: "Works through the hierarchy", attribute: "influence", score: 2 },

  { key: "decisive", label: "Fast and decisive", attribute: "pace", score: 5 },
  { key: "gets-moving", label: "Gets things moving", attribute: "pace", score: 4 },
  { key: "thorough", label: "Steady and thorough", attribute: "pace", score: 2 },
];

/** Human tags: what they are like to be around. Kept inside the network, never on a client card. */
export const PERSON_TAGS: string[] = [
  "Warm", "Funny", "Blunt", "Calm", "High energy", "Quiet", "Curious", "Humble",
  "Straight-talking", "Patient", "Competitive", "Detail-obsessed", "Big picture",
  "Generous with time", "Unflappable", "Impatient with waffle", "Asks good questions",
];

/** How the conversation happened, because "met at a client site" is not "spoke on the phone". */
export const MEETING_KINDS: [string, string][] = [
  ["IN_PERSON", "Met in person"],
  ["VIDEO", "Video call"],
  ["PHONE", "Phone call"],
  ["WORKED_TOGETHER", "Worked alongside them"],
  ["EVENT", "Met at an event"],
];

/** Turn tapped chips into attribute scores. Later taps on the same attribute win. */
export function traitsToScores(keys: string[]): FitScores {
  const out: FitScores = {};
  for (const k of keys) {
    const chip = TRAIT_CHIPS.find((c) => c.key === k);
    if (chip) out[chip.attribute] = chip.score;
  }
  return out;
}

/** The chips that correspond to a set of scores, so a saved impression can be shown back. */
export function scoresToTraits(scores: FitScores): TraitChip[] {
  return TRAIT_CHIPS.filter((c) => scores[c.attribute] === c.score);
}

/** Group the chips by attribute for a picker, in the order the attributes are defined. */
export function chipsByAttribute(): { key: AttributeKey; label: string; chips: TraitChip[] }[] {
  return ATTRIBUTES.map((a) => ({ key: a.key, label: a.label, chips: TRAIT_CHIPS.filter((c) => c.attribute === a.key) }));
}

/**
 * A sentence from a first-hand meeting, for the profile and for the write-up. It is deliberately
 * in the first person: this is somebody's own impression, not a system verdict.
 */
export function meetingSummary(input: {
  by: string;
  kind: string;
  when: string | null;
  where?: string | null;
  traits: string[];
  tags: string[];
  note?: string | null;
  wouldRefer: boolean;
}): string {
  const kind = MEETING_KINDS.find(([k]) => k === input.kind)?.[1] ?? "Spoke with them";
  const traitWords = TRAIT_CHIPS.filter((c) => input.traits.includes(c.key)).map((c) => c.label.toLowerCase());
  const bits = [
    `${kind}${input.where ? ` at ${input.where}` : ""}${input.when ? ` on ${input.when}` : ""}.`,
    traitWords.length ? `Came across as ${traitWords.join(", ")}.` : "",
    input.tags.length ? `${input.tags.join(", ")}.` : "",
    input.note ? `${input.note.trim().replace(/\.?$/, ".")}` : "",
    input.wouldRefer ? `${input.by} would personally refer them.` : `${input.by} has met them; not a referral yet.`,
  ];
  return bits.filter(Boolean).join(" ");
}
