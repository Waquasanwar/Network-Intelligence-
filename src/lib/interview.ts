/**
 * The interview, as a conversation rather than a form.
 *
 * The screening script (see screening.ts) says what has to be captured. This file decides how it
 * is said out loud: a warm opening, a natural phrasing of each question, a short acknowledgement
 * that proves the interviewer was listening, one probe when an answer is thin, a bridge between
 * sections, and a close that offers a real call with a human.
 *
 * It also reads the working-style attributes out of what the person actually said, so nobody is
 * asked to rate their own assertiveness out of five. The self-rating stays available as a check.
 *
 * Deterministic and offline: same input, same words. Shared by the Next.js app and the browser
 * prototype. No I/O, no model calls, and nothing here leaves the tenant.
 */
import { ATTRIBUTES, type AttributeKey, type FitScores } from "./fit";
import type { ScreeningQuestion, ScreeningSection } from "./screening";

export type Speaker = "interviewer" | "person";
export type Turn = { who: Speaker; text: string; at: number; key?: string };

/** Pick one of a set, stably: the same question and the same person get the same wording. */
function pick<T>(list: T[], seed: string): T {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

const firstNameOf = (name: string) => (name || "").trim().split(/\s+/)[0] || "there";

// ---------- opening and close ----------

export function opening(name: string, minutes: number, sections: number): string[] {
  const n = firstNameOf(name);
  return [
    `Hello ${n} — thanks for making the time.`,
    `This is a conversation, not a form. I will ask about your work, what you are good at, where you can work and what you are looking for. About ${minutes} minutes, ${sections} short parts.`,
    `Talk normally. I write it down, you get to read and change every word at the end, and nothing goes on your profile until a person has read it.`,
  ];
}

export function closing(name: string, opts: { missing: string[]; wantsCall: boolean }): string[] {
  const n = firstNameOf(name);
  const out = [`That is everything I needed, ${n}. Thank you — that was genuinely useful.`];
  if (opts.missing.length) out.push(`Two things I did not get: ${opts.missing.slice(0, 2).join(" and ")}. You can add them on the summary, or leave them and we will pick them up when we speak.`);
  out.push(opts.wantsCall
    ? `I will set up a call with Waqas — he will come back to you directly.`
    : `Have a read of the summary. If you would rather talk it through with a person, ask for a call and Waqas will pick it up himself.`);
  return out;
}

/** The offer of a real call, made once, near the end. */
export const CALL_OFFER = "One last thing — would you like a proper call with Waqas? Some things are easier said to a person than to me.";

// ---------- how each question is actually said ----------

/**
 * Spoken phrasings. Written prompts stay in screening.ts for the typed version; these are what a
 * person hears. Several per question so a repeated screening does not sound canned.
 */
const SPOKEN: Record<string, string[]> = {
  headline: ["So, in one line — what are you known for?", "Start me off: what do people come to you for?"],
  currentRole: ["And what are you doing at the moment, and where?", "Where are you right now, and doing what?"],
  proudest: ["Tell me about a piece of work you are proud of. What was the situation, what did you do, and what happened?", "Give me one piece of work you would put your name to. What was going on, and what did you actually do?"],
  capabilities: ["What are you genuinely strong at? The things you would want to be called about.", "If I were describing you to a client, what would I say you are strong at?"],
  sectors: ["Which industries do you know from the inside?", "Which sectors do you actually know, rather than have read about?"],
  seniority: ["What level do you operate at?", "Where do you sit — lead, director, exec?"],
  avoid: ["And what do you not want to be put forward for?", "What would you rather I never call you about?"],
  status: ["Where are you right now on availability? It is a spectrum, not a yes or no.", "How available are you, honestly?"],
  routes: ["What kinds of engagement would you consider?", "Perm, contract, interim, fractional, advisory — what is on the table?"],
  noticePeriod: ["How quickly could you start, or what is your notice?", "If something came up next month, could you take it?"],
  location: ["Where are you based?", "Which city are you in?"],
  targetLocations: ["Where else would you work, or move to?", "Anywhere else you would take work?"],
  workRights: ["What rights to work do you hold? Visas only — I never ask about nationality.", "What visas or rights to work do you have?"],
  relocation: ["If a move happened, would it be with family, and would you want help with schools or housing?", "Would a move be with family? And would help with the practical side matter?"],
  rate: ["What day rate, or salary, are you looking for?", "What are the numbers — day rate or salary?"],
  constraints: ["Anything we should respect? Travel, days on site, a current employer not to approach.", "Any boundaries I should write down? Travel, on-site days, anyone not to contact."],
  pushback: ["Tell me about a time you pushed back on someone senior. What did you do, and how did it land?", "When did you last tell a senior person they were wrong? How did that go?"],
  politics: ["On your last piece of work — how did you work out who really decided, and what they needed to hear?", "Who actually made the decisions where you were last, and how did you find that out?"],
  commercialCall: ["What commercial trade-off have you had to make? Cost against scope, margin against goodwill.", "Tell me about a call you made where the money mattered."],
  ambiguity: ["Tell me about starting something where nobody could tell you what good looked like. What did you do first?", "When did you last walk into a mess with no brief? What was your first move?"],
  workingStyle: ["What kind of team or client brings out your best — and what wears you down?", "Where do you do your best work, and what drains you?"],
  outsideWork: ["Away from work — what are you into?", "What do you get up to when you are not working?"],
  interests: ["Anything you are learning at the moment, or obsessed with?", "What are you into outside the job?"],
  motivation: ["What actually gets you out of bed for a piece of work? Money, mess, mission, the team — no wrong answer.", "What makes a job worth doing, for you?"],
  howToWorkWith: ["If someone is about to work with you, what should they know? How you like feedback, what winds you up.", "What is the user manual for working with you?"],
  languages: ["Which languages do you work in?", "What languages can you work in?"],
  surprising: ["Tell me something people are surprised to learn about you.", "What do people not expect about you?"],
  knows: ["Who do you know that you would genuinely put your name behind? Anyone already with us, or someone we should meet.", "Who would you vouch for? Names, and what you have seen them do."],
  referralConsent: ["Are you happy for us to refer you for work, anonymously until you say yes?", "Can we put you forward for things, without your name until you agree?"],
  contactPreference: ["How do you prefer to be contacted, and when should I check back in?", "Best way to reach you, and when should we next speak?"],
};

/** What the person hears for this question. */
export function askLine(q: ScreeningQuestion, seed = ""): string {
  const options = SPOKEN[q.key];
  if (options) return pick(options, q.key + seed);
  if (q.key.startsWith("attr:")) return q.prompt; // the self-check questions read fine as written
  return q.prompt;
}

/** A line between sections, so it does not feel like a list. */
export function bridge(next: ScreeningSection, previous?: ScreeningSection): string | null {
  if (!previous) return null;
  const lines: Record<string, string[]> = {
    expertise: ["Right — let's get specific about what you are good at."],
    availability: ["That's the work. Now the practical side.", "Good. Let's talk about timing."],
    location: ["Two quick ones about where you can work."],
    commercials: ["Money and boundaries, so nobody wastes anybody's time.", "Let's do the numbers."],
    fit: ["Now the part clients ask me about most: how you work.", "This next bit is about how you operate, not what you know."],
    person: ["Right — enough about the work. Tell me about you.", "Let's do the human part. None of this goes to a client."],
    network: ["Last part, and it is the one that makes this network worth being in."],
  };
  const l = lines[next.key];
  return l ? pick(l, next.key) : null;
}

// ---------- listening back ----------

export type Quality = "empty" | "thin" | "ok";

/** How much there is to work with. Long answers need substance; a city name does not. */
export function answerQuality(q: ScreeningQuestion, said: unknown): Quality {
  if (said === null || said === undefined) return "empty";
  if (Array.isArray(said)) {
    const items = said.filter((x) => (typeof x === "string" ? x.trim() : x && typeof x === "object" ? Object.values(x).some(Boolean) : false));
    return items.length === 0 ? "empty" : q.kind === "people" && items.length < 1 ? "thin" : "ok";
  }
  const text = String(said).trim();
  if (!text) return "empty";
  if (q.kind === "long") {
    const words = text.split(/\s+/).length;
    if (words < 12) return "thin";
    // A story with no outcome is still thin: we want situation, action, result.
    if (words < 30 && !/\b(so|because|result|ended up|we got|went live|saved|delivered|landed|turned)\b/i.test(text)) return "thin";
    return "ok";
  }
  if (q.kind === "chips") return text.split(/[,;]/).filter((x) => x.trim().length > 1).length < 2 ? "thin" : "ok";
  // Some short answers are complete ("Dubai", "4 weeks"); others are a phrase or they are nothing.
  const words = text.split(/\s+/).filter(Boolean).length;
  const need = MIN_WORDS[q.key] ?? 1;
  if (words < need) return "thin";
  return text.replace(/\s+/g, "").length < 3 ? "thin" : "ok";
}

/** Short answers that still need to be a phrase rather than a word. */
const MIN_WORDS: Record<string, number> = { headline: 4, currentRole: 3, relocation: 3, constraints: 2, contactPreference: 2 };

/** One probe, when the answer is too thin to be useful. Never more than one per question. */
const OPTIONAL = new Set(["outsideWork", "interests", "surprising", "languages"]);

export function probe(q: ScreeningQuestion, said: unknown): string | null {
  if (answerQuality(q, said) === "ok") return null;
  if (OPTIONAL.has(q.key)) return null; // the human questions are a gift, never an interrogation
  const specific: Record<string, string> = {
    proudest: "Give me the detail — what was actually going wrong when you arrived, and what was different by the time you left?",
    pushback: "What did you say, and what happened next? That is the part clients ask me about.",
    workingStyle: "And the other half — what wears you down? That matters as much.",
    politics: "Who were the people, and how did you work out what they actually cared about?",
    commercialCall: "What did it cost, and what did you protect? Even roughly.",
    ambiguity: "What did you do in the first week, before anyone could tell you what good looked like?",
    headline: "Say it the way a client would say it to a colleague.",
    capabilities: "Name three or four specifically. 'Delivery' is too broad to match on.",
    knows: "Even one name helps. Who have you worked with that you would put your name behind?",
    rate: "A range is fine. I would rather write down a range than nothing.",
    workRights: "Just the visas or rights you hold — for example right to work in the UK, or a UAE residence visa.",
    motivation: "Even roughly. Is it the problem, the people, the money, or the chance to build something?",
    howToWorkWith: "Anything at all — how you like to be given feedback, or the thing that winds you up fastest.",
  };
  if (specific[q.key]) return specific[q.key];
  if (q.kind === "long") return "Can you give me a bit more? The specifics are what make this worth reading.";
  if (q.kind === "chips") return "A few more would help — the more specific, the better the match.";
  return null;
}

/**
 * A short acknowledgement that proves the interviewer heard the answer, and sometimes reflects
 * the thing that matters commercially ("already in Dubai, with the visa — that is the hard part").
 */
export function ack(q: ScreeningQuestion, said: unknown, name = ""): string | null {
  const text = Array.isArray(said) ? said.filter((x) => typeof x === "string").join(", ") : typeof said === "string" ? said : "";
  const n = firstNameOf(name);
  if (q.key === "location") {
    const gulf = /\b(dubai|abu dhabi|sharjah|riyadh|jeddah|doha|manama|kuwait|muscat)\b/i.exec(text);
    if (gulf) return `${gulf[0]} — good, a lot of what comes to us is in the Gulf.`;
    return text ? `${text.split(",")[0].trim()}, noted.` : null;
  }
  if (q.key === "workRights") {
    if (/\b(golden visa|own sponsorship|residence visa|right to work|settled|ilr|citizen)\b/i.test(text)) return "That matters more than people realise — it takes sponsorship off the table.";
    if (/\b(sponsor|need|would require)\b/i.test(text)) return "Understood. I will flag that sponsorship would be needed, so it is never a surprise.";
    return null;
  }
  if (q.key === "rate") return text ? "Noted — and it stays a band to clients, never your exact number." : null;
  if (q.key === "outsideWork") return text.trim() ? "I like that. It is the kind of thing that makes a person memorable, and it never goes to a client." : null;
  if (q.key === "motivation") return text.trim() ? "Useful — that tells me which work to bring you and which to leave alone." : null;
  if (q.key === "howToWorkWith") return text.trim() ? "Noted. I will pass that on to anyone you end up working with." : null;
  if (q.key === "languages") return text.trim() ? "Good to know — it comes up more often than you would think." : null;
  if (q.key === "surprising") return text.trim() ? "Ha — I will remember that one." : null;
  if (q.key === "knows") return "Thank you. I will not contact anyone without asking you first.";
  if (q.key === "proudest") return answerQuality(q, said) === "ok" ? "That is the kind of thing a client actually wants to hear." : null;
  if (q.key === "pushback") return answerQuality(q, said) === "ok" ? "Useful. That is the story I would test with someone who has worked with you." : null;
  if (q.key === "capabilities") { const count = text.split(/,|;/).filter((x) => x.trim()).length; return count >= 3 ? "Good — specific enough to match on." : null; }
  if (q.key === "status") return "Right, that is how I will describe it — as a spectrum, not a yes or no.";
  if (q.key === "referralConsent") return /^y/i.test(text) ? `Thank you ${n}. Anonymous until you say yes, every time.` : "Understood — I will ask you each time.";
  if (q.kind === "long") return answerQuality(q, said) === "ok" ? "Got it." : null;
  return null;
}

// ---------- reading working style out of what was said ----------

/** Phrases that lean low on a trait, so a mention is not automatically a strength. */
const HEDGE = /\b(not really|rarely|avoid(ing)?|uncomfortable|struggle|prefer not|tend not|dislike|would rather not)\b/i;
const STRONG = /\b(always|every time|had to|insisted|refused|stood my ground|took it to|owned|drove|led|repeatedly)\b/i;

/** Which answers actually speak to each attribute. A story about money says nothing about conflict. */
const SOURCE: Record<AttributeKey, string[]> = {
  assertiveness: ["pushback"],
  conflict: ["pushback", "workingStyle"],
  political: ["politics"],
  commercial: ["commercialCall", "rate"],
  collaboration: ["workingStyle", "proudest"],
  ambiguity: ["ambiguity"],
  influence: ["pushback", "politics"],
  pace: ["ambiguity", "proudest"],
};

const EXTRA: Record<AttributeKey, RegExp> = {
  assertiveness: /\b(said no|told (them|him|her)|stood (my|his|her) ground|escalat(e|ed)|would not sign|refused)\b/i,
  conflict: /\b(mediat(e|ed)|brought them together|got them in a room|unblocked|cleared the air|fell out)\b/i,
  political: /\b(sponsor|steering (group|committee)|who really|behind the scenes|pre[- ]wired|informal)\b/i,
  commercial: /\b(business case|day rate|margin|cost|budget|invoice|revenue|saved|commercial)\b/i,
  collaboration: /\b(with the team|we|together|handover|coached|mentored|pair(ed)?)\b/i,
  ambiguity: /\b(no (brief|scope)|nobody knew|from scratch|first ninety days|blank sheet|figured out)\b/i,
  influence: /\b(no authority|not my team|persuad|brought (them|people) with|board|convinced)\b/i,
  pace: /\b(in (a|two|three) weeks?|quickly|fast|urgent|deadline|overnight|slow(ly)?|carefully)\b/i,
};

/**
 * Read the eight working-style attributes out of the free text the person gave. Answers are
 * evidence, not a self-rating: mention plus intensity raises a score, hedging lowers it, and
 * anything with no signal is left unscored rather than guessed at 3.
 */
export function inferAttributes(answers: Record<string, unknown>): FitScores {
  const textOf = (keys: string[]) => keys.map((k) => { const v = answers[k]; return Array.isArray(v) ? v.filter((x) => typeof x === "string").join(" ") : typeof v === "string" ? v : ""; }).join("\n").trim();
  const everything = textOf(Object.keys(answers).filter((k) => !k.startsWith("attr:")));
  const out: FitScores = {};
  for (const a of ATTRIBUTES) {
    const primary = textOf(SOURCE[a.key]);
    const hay = primary || everything;
    if (!hay) continue;
    const hits = (hay.match(a.keywords) ?? []).length + (hay.match(EXTRA[a.key]) ?? []).length;
    const words = primary.split(/\s+/).filter(Boolean).length;
    if (!hits && words < 12) continue; // nothing to go on; better unscored than guessed
    let score = words >= 25 ? 3 : 2;
    if (hits >= 1) score += 1;
    if (hits >= 3) score += 1;
    if (STRONG.test(hay)) score += 1;
    if (HEDGE.test(hay)) score -= 1;
    if (a.key === "pace" && /\b(steady|thorough|methodical|carefully)\b/i.test(hay) && !/\b(fast|quick|urgent|decisive|overnight)\b/i.test(hay)) score = Math.min(score, 2);
    out[a.key] = Math.max(1, Math.min(5, score));
  }
  // Anything the person rated themselves is kept, and wins: they know themselves better than a regex.
  for (const a of ATTRIBUTES) {
    const self = answers[`attr:${a.key}`];
    const n = typeof self === "number" ? self : typeof self === "string" ? Number(self) : NaN;
    if (Number.isFinite(n) && n >= 1 && n <= 5) out[a.key] = n;
  }
  return out;
}

/** Which attributes the conversation did not give us enough to say anything about. */
export function attributeGaps(scores: FitScores): AttributeKey[] {
  return ATTRIBUTES.filter((a) => typeof scores[a.key] !== "number").map((a) => a.key);
}

/** A sentence for the write-up: what the conversation suggested about how they work. */
export function attributeNarrative(scores: FitScores): string {
  const high = ATTRIBUTES.filter((a) => (scores[a.key] ?? 0) >= 4);
  const low = ATTRIBUTES.filter((a) => (scores[a.key] ?? 5) <= 2);
  const parts: string[] = [];
  if (high.length) parts.push(`Came across strongest on ${high.map((a) => a.label.toLowerCase()).join(", ")}`);
  if (low.length) parts.push(`${parts.length ? "and " : "Leans the other way on "}${low.map((a) => a.label.toLowerCase()).join(", ")}`);
  if (!parts.length) return "Not enough in the conversation to read their working style — worth a vouch or a follow-up call.";
  return `${parts.join(", ")}. Read from what they said, not a self-rating; a vouch carries more weight.`;
}
