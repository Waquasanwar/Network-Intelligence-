/**
 * The screening call: a 25–30 minute structured first conversation that captures the key
 * data points for someone joining the network, whether run live by the owner or completed
 * by the person themselves as a guided, AI-assisted conversation.
 *
 * Output is a reviewable summary (ExtractedSummary) plus profile field suggestions and any
 * people they mentioned they know. Nothing changes on the profile until a human approves it.
 * Shared by the Next.js app and the browser prototype. No I/O.
 */
import type { ExtractedSummary } from "./ai/types";
import type { AvailabilityStatus, EngagementRoute, Seniority } from "@prisma/client";
import { ATTRIBUTES, type AttributeKey, type FitScores } from "./fit";

export type QuestionKind = "text" | "long" | "select" | "multi" | "chips" | "people" | "scale";
export type ScreeningQuestion = { key: string; prompt: string; help?: string; kind: QuestionKind; options?: [string, string][]; required?: boolean; placeholder?: string; low?: string; high?: string };
export type ScreeningSection = { key: string; title: string; minutes: number; intent: string; questions: ScreeningQuestion[] };

const ROUTES: [string, string][] = [["PERMANENT", "Permanent"], ["CONTRACT", "Contract"], ["INTERIM", "Interim"], ["FRACTIONAL", "Fractional"], ["ADVISORY", "Advisory / expert calls"], ["SOW", "SOW / project team"]];
const STATUSES: [string, string][] = [["AVAILABLE_NOW", "Available now"], ["FINISHING_ENGAGEMENT_SOON", "Finishing an engagement soon"], ["OPEN_TO_CONVERSATIONS", "Open to conversations"], ["QUIETLY_EXPLORING", "Quietly exploring"], ["RIGHT_OPPORTUNITY_ONLY", "Only the right opportunity"], ["FRACTIONAL_AVAILABILITY", "Has fractional capacity"], ["HAPPY_WHERE_I_AM", "Happy where I am"], ["NOT_LOOKING_KEEP_IN_TOUCH", "Not looking, keep in touch"], ["TAKING_A_BREAK", "Taking a break"]];
const SENIORITY: [string, string][] = [["ASSOCIATE", "Associate"], ["MANAGER", "Manager"], ["SENIOR_MANAGER", "Senior manager / lead"], ["DIRECTOR", "Director / head of"], ["EXECUTIVE", "Executive / VP"], ["C_LEVEL", "C-level"]];

/** The script. Six sections, about 27 minutes. Every answer maps to a profile field or a follow-up. */
export const SCREENING_SCRIPT: ScreeningSection[] = [
  { key: "story", title: "Your story", minutes: 5, intent: "What they are known for, in their own words.", questions: [
    { key: "headline", prompt: "In one line, what are you known for?", help: "The sentence a client would repeat about you.", kind: "text", required: true, placeholder: "e.g. Programme director who stabilises troubled transformations" },
    { key: "currentRole", prompt: "What are you doing right now, and where?", kind: "text", placeholder: "e.g. Programme Director at a UK bank, London" },
    { key: "proudest", prompt: "Tell me about a piece of work you are proudest of. What was the situation, what did you do, what happened?", help: "This becomes observable evidence once someone in the network confirms it.", kind: "long" },
  ] },
  { key: "expertise", title: "Expertise", minutes: 5, intent: "Capabilities and sectors, specific enough to match on.", questions: [
    { key: "capabilities", prompt: "What are you genuinely strong at? List the capabilities you would want to be found for.", kind: "chips", required: true, placeholder: "Programme director, SAP, Cyber GRC…" },
    { key: "sectors", prompt: "Which industries do you know from the inside?", kind: "chips", placeholder: "Banking, Government, Energy…" },
    { key: "seniority", prompt: "What level do you operate at?", kind: "select", options: SENIORITY },
    { key: "avoid", prompt: "What do you not want to be put forward for?", help: "Greenfield builds, hands-on delivery, politically sensitive roles…", kind: "chips" },
  ] },
  { key: "availability", title: "Availability", minutes: 3, intent: "Where they are on the spectrum, and for what kind of work.", questions: [
    { key: "status", prompt: "Where are you right now?", help: "Status is a spectrum, not a yes or no.", kind: "select", options: STATUSES, required: true },
    { key: "routes", prompt: "What kinds of engagement would you consider?", kind: "multi", options: ROUTES },
    { key: "noticePeriod", prompt: "How quickly could you start, or what is your notice period?", kind: "text", placeholder: "e.g. 4 weeks, or from January" },
  ] },
  { key: "location", title: "Location and work rights", minutes: 3, intent: "Where they are, where they would go, and what visas they hold.", questions: [
    { key: "location", prompt: "Where are you based?", kind: "text", required: true, placeholder: "City, country" },
    { key: "targetLocations", prompt: "Where else would you work or relocate to?", kind: "chips", placeholder: "Dubai, Riyadh, Remote…" },
    { key: "workRights", prompt: "What rights to work do you hold?", help: "Visas and rights to work only. Never nationality.", kind: "chips", placeholder: "Right to work in UK, UAE residence visa…" },
    { key: "relocation", prompt: "Would a move be with family, and would you want help with schools or housing?", kind: "text" },
  ] },
  { key: "commercials", title: "Commercials and constraints", minutes: 3, intent: "Numbers and boundaries, so nobody wastes time.", questions: [
    { key: "rate", prompt: "What day rate, or salary, are you looking for?", kind: "text", placeholder: "e.g. £1,200/day or £150k" },
    { key: "constraints", prompt: "Any constraints we should respect? Travel, days on site, confidentiality, a current employer not to approach…", kind: "chips" },
  ] },
  // Working style is read out of stories, not out of self-ratings: nobody describes their own
  // assertiveness usefully. src/lib/interview.ts scores the attributes from these answers, and a
  // vouch from someone who worked with them carries more weight than either.
  { key: "fit", title: "How you work", minutes: 6, intent: "Four stories that show how they operate. The attributes are read from these, never asked for as a score.", questions: [
    { key: "pushback", prompt: "Tell me about a time you had to push back on a senior stakeholder. What did you do, and how did it land?", help: "Assertiveness, conflict and influence all come out of this one.", kind: "long" },
    { key: "politics", prompt: "On your last piece of work, how did you work out who really decided — and what they needed to hear?", help: "Political awareness, in their own words.", kind: "long" },
    { key: "commercialCall", prompt: "What commercial trade-off have you had to make? Cost against scope, margin against goodwill, that sort of thing.", help: "Commercial awareness, and whether they think past delivery.", kind: "long" },
    { key: "ambiguity", prompt: "Tell me about starting something where nobody could tell you what good looked like. What did you do first?", help: "Comfort with ambiguity, and pace.", kind: "long" },
    { key: "workingStyle", prompt: "What kind of team, client or culture brings out your best, and what wears you down?", kind: "long" },
  ] },
  { key: "network", title: "Your network", minutes: 4, intent: "Who they know and would vouch for. This is what makes the network compound.", questions: [
    { key: "knows", prompt: "Who do you know that you would genuinely put your name behind? Anyone already in our network, or someone we should meet.", help: "Name, what you have seen them do, and how you know them. We only contact them with your say-so.", kind: "people" },
    { key: "referralConsent", prompt: "Are you happy for people in the network to refer you for opportunities, anonymously until you say yes?", kind: "select", options: [["yes", "Yes, refer me"], ["ask", "Ask me each time"], ["no", "Not for now"]], required: true },
    { key: "contactPreference", prompt: "How do you prefer to be contacted, and when should we check in next?", kind: "text", placeholder: "e.g. WhatsApp, check in after Q1" },
  ] },
];

export const SCREENING_MINUTES = SCREENING_SCRIPT.reduce((a, s) => a + s.minutes, 0);

export type ReferredPerson = { name: string; context: string; email?: string };
export type ScreeningAnswers = Record<string, string | string[] | ReferredPerson[] | undefined>;

export type ScreeningResult = {
  summary: ExtractedSummary;
  profile: {
    headline: string | null; capabilities: string[]; sectors: string[]; seniority: Seniority | null; engagementPreferences: EngagementRoute[]; availabilityStatus: AvailabilityStatus | null; noticePeriod: string | null;
    primaryCity: string | null; primaryCountry: string | null; targetLocations: string[]; workRights: string[]; rateExpectation: string | null; salaryExpectation: string | null; constraints: string | null; workingStyle: string | null; relocationInterest: boolean; referralConsent: "yes" | "ask" | "no" | null;
  };
  referrals: ReferredPerson[];
  attributes: FitScores; // self-assessed, 1–5
  attitudeStory: string | null; // the push-back story, tested with vouchers
  evidenceCandidate: string | null;
  completeness: number; // 0–100, share of required and important questions answered
  missing: string[];
};

const list = (v: unknown): string[] => (Array.isArray(v) ? (v as unknown[]).map(String).map((s) => s.trim()).filter(Boolean) : typeof v === "string" ? v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Turn screening answers into a reviewable summary and profile suggestions. Deterministic. */
export function screeningToResult(a: ScreeningAnswers, now = new Date()): ScreeningResult {
  const loc = str(a.location);
  const [city, country] = loc ? loc.split(",").map((s) => s.trim()) : [null, null];
  const rate = str(a.rate);
  const isSalary = !!rate && !/day|\/d\b|hour|\/h\b/i.test(rate) && /k\b|\d{2,3},\d{3}|annum|year/i.test(rate);
  const referrals = (Array.isArray(a.knows) ? (a.knows as ReferredPerson[]) : []).filter((r) => r && r.name?.trim());
  const routes = list(a.routes).filter((r): r is EngagementRoute => ["PERMANENT", "CONTRACT", "INTERIM", "FRACTIONAL", "ADVISORY", "SOW"].includes(r));
  const status = (str(a.status) as AvailabilityStatus | null) ?? null;
  const consent = (str(a.referralConsent) as "yes" | "ask" | "no" | null) ?? null;
  const profile: ScreeningResult["profile"] = {
    headline: str(a.headline), capabilities: list(a.capabilities), sectors: list(a.sectors), seniority: (str(a.seniority) as Seniority | null) ?? null, engagementPreferences: routes, availabilityStatus: status, noticePeriod: str(a.noticePeriod),
    primaryCity: city ?? null, primaryCountry: country ?? null, targetLocations: list(a.targetLocations), workRights: list(a.workRights), rateExpectation: rate && !isSalary ? rate : null, salaryExpectation: rate && isSalary ? rate : null,
    constraints: list(a.constraints).join("; ") || null, workingStyle: str(a.workingStyle), relocationInterest: list(a.targetLocations).length > 0 || /yes|family|would/i.test(str(a.relocation) ?? ""), referralConsent: consent,
  };
  const attributes: FitScores = {};
  for (const at of ATTRIBUTES) { const v = Number(str(a[`attr:${at.key}`])); if (v >= 1 && v <= 5) attributes[at.key] = v; }
  const required = ["headline", "capabilities", "status", "location", "referralConsent"]; const important = ["currentRole", "proudest", "sectors", "routes", "workRights", "rate", "knows", "contactPreference", "pushback", "politics", "commercialCall"];
  const answered = (k: string) => { const v = a[k]; return Array.isArray(v) ? v.length > 0 : !!str(v); };
  const missing = [...required.filter((k) => !answered(k)), ...important.filter((k) => !answered(k))];
  const completeness = Math.round(((required.filter(answered).length * 2 + important.filter(answered).length) / (required.length * 2 + important.length)) * 100);
  const summary: ExtractedSummary = {
    headline: profile.headline ?? "", capabilities: profile.capabilities.map((c) => c.toLowerCase()), sectors: profile.sectors.map((c) => c.toLowerCase()), engagementPreferences: routes, locationPreferences: [loc, ...profile.targetLocations].filter((x): x is string => !!x).map((x) => x.toLowerCase()),
    currentStatus: [str(a.currentRole), status ? STATUSES.find(([k]) => k === status)?.[1] : null, str(a.noticePeriod) ? `notice: ${str(a.noticePeriod)}` : null].filter(Boolean).join(" · "), suggestedAvailabilityStatus: status ?? undefined, ratesOrSalary: rate ?? "",
    workingCharacteristics: [profile.workingStyle, ...ATTRIBUTES.filter((at) => (attributes[at.key] ?? 0) >= 4).map((at) => `${at.label}: ${at.high.toLowerCase()} (${attributes[at.key]}/5, read from the conversation)`)].filter((x): x is string => !!x), constraints: list(a.constraints), strengths: profile.capabilities.slice(0, 5), avoid: list(a.avoid),
    followUpDate: str(a.contactPreference) ?? undefined, unresolvedQuestions: missing.map((k) => `Screening did not cover: ${labelFor(k)}`), summary: buildSummary(a, profile, referrals.length),
  };
  return { summary, profile, referrals, attributes, attitudeStory: str(a.pushback), evidenceCandidate: str(a.proudest), completeness, missing: missing.map(labelFor) };
}

function labelFor(key: string): string {
  for (const s of SCREENING_SCRIPT) for (const q of s.questions) if (q.key === key) return q.prompt.split("?")[0].trim();
  return key;
}

function buildSummary(a: ScreeningAnswers, p: ScreeningResult["profile"], referrals: number): string {
  const parts = [p.headline, str(a.currentRole) ? `Currently ${str(a.currentRole)}.` : null, p.capabilities.length ? `Strong on ${p.capabilities.slice(0, 4).join(", ")}.` : null, p.availabilityStatus ? `${STATUSES.find(([k]) => k === p.availabilityStatus)?.[1]}${p.engagementPreferences.length ? ` for ${p.engagementPreferences.map((r) => r.toLowerCase()).join(" / ")} work` : ""}.` : null, p.primaryCity ? `Based in ${[p.primaryCity, p.primaryCountry].filter(Boolean).join(", ")}${p.targetLocations.length ? `, open to ${p.targetLocations.join(", ")}` : ""}.` : null, p.workRights.length ? `Work rights: ${p.workRights.join(", ")}.` : null, p.rateExpectation ?? p.salaryExpectation ? `Expects ${p.rateExpectation ?? p.salaryExpectation}.` : null, referrals ? `Named ${referrals} ${referrals === 1 ? "person" : "people"} they would vouch for.` : null];
  return parts.filter(Boolean).join(" ");
}
