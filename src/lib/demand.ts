/**
 * Demand side: client and agency requirements, the co-pilot brief parser, requirement
 * matching with hard-requirement checks, and the commercial (fee) model.
 *
 * Pure TypeScript shared by the Next.js app and the browser prototype. No I/O.
 *
 * Principles (spec §10, §12):
 *  - The co-pilot structures a brief; it never decides. Every inference is listed as an
 *    assumption the human can correct, and every gap becomes a question.
 *  - Matching retrieves and explains for *this* requirement. Hard requirements (must be in
 *    location, work rights) are checked and labelled, never used to silently drop people.
 *  - Fees are configurable. Nothing is hard-coded to a route; the rate card is data.
 */
import type { EngagementRoute, Seniority } from "@prisma/client";
import { retrieveMatches, type MatchPerson, type MatchResult } from "./matching";

// ---------- Brief ----------

export type BudgetKind = "SALARY" | "DAY_RATE" | "HOURLY" | "PROJECT";
export type Budget = { kind: BudgetKind; amount: number; currency: string; max?: number | null };

export type Brief = {
  rawText: string;
  title: string;
  engagementRoute: EngagementRoute | null;
  headcount: number;
  roles: string[]; // human-readable role families, e.g. "Business analyst"
  capabilities: string[]; // matching terms, e.g. "Business analysis"
  sectors: string[];
  seniority: Seniority | null;
  locations: string[];
  mustBeLocal: boolean; // "already in Dubai" / "based in" / onsite
  workRights: string | null; // e.g. "Existing UAE residence visa"
  budget: Budget | null;
  durationMonths: number | null;
  startBy: string | null;
  assumptions: string[]; // what the co-pilot inferred
  questions: string[]; // what it could not infer
};

type RoleDef = { match: RegExp; role: string; capabilities: string[]; seniority?: Seniority };

const ROLES: RoleDef[] = [
  { match: /\b(business analysts?|bas?\b(?!sed)|ba's)/i, role: "Business analyst", capabilities: ["Business analysis"] },
  { match: /\b(project managers?|pms?\b|project management)/i, role: "Project manager", capabilities: ["Project management"] },
  { match: /\b(programme managers?|program managers?|programme directors?|programme leads?)/i, role: "Programme manager", capabilities: ["Programme management"] },
  { match: /\bpmo\b/i, role: "PMO", capabilities: ["PMO"] },
  { match: /\b(scrum masters?|agile coach(es)?|delivery managers?)/i, role: "Agile delivery lead", capabilities: ["Agile delivery"] },
  { match: /\b(product owners?|product managers?)/i, role: "Product manager", capabilities: ["Product management"] },
  { match: /\b(change (managers?|directors?|leads?)|change management)/i, role: "Change lead", capabilities: ["Change management"] },
  { match: /\b(enterprise|solution|cloud) architects?\b|\barchitects?\b/i, role: "Architect", capabilities: ["Enterprise architecture", "Solution architecture"] },
  { match: /\bcisos?\b|security (leads?|directors?|heads?)/i, role: "CISO", capabilities: ["CISO", "Cyber security"], seniority: "EXECUTIVE" },
  { match: /\b(cyber|security|grc)\b/i, role: "Cyber / GRC", capabilities: ["Cyber security"] },
  { match: /\bcfos?\b|finance directors?/i, role: "CFO", capabilities: ["CFO", "Finance transformation"], seniority: "EXECUTIVE" },
  { match: /\bcoos?\b|operations directors?/i, role: "COO", capabilities: ["COO", "Operations"], seniority: "C_LEVEL" },
  { match: /\bctos?\b/i, role: "CTO", capabilities: ["CTO", "Platform engineering"], seniority: "C_LEVEL" },
  { match: /\b(data (engineers?|leads?|platform)|head of data)/i, role: "Data lead", capabilities: ["Data platform", "Data engineering"] },
  { match: /\b(ai|genai|machine learning|ml)\b/i, role: "AI lead", capabilities: ["AI", "Machine learning"] },
  { match: /\bsap\b|s\/4/i, role: "SAP lead", capabilities: ["SAP", "ERP"] },
  { match: /\bservicenow\b/i, role: "ServiceNow lead", capabilities: ["ServiceNow"] },
  { match: /\b(devops|platform engineer(ing)?|sre)\b/i, role: "Platform engineer", capabilities: ["DevOps", "Platform engineering"] },
  { match: /\b(procurement|supply chain)\b/i, role: "Procurement lead", capabilities: ["Procurement", "Supply chain"] },
  { match: /\b(bid|proposal) (directors?|managers?|leads?)\b/i, role: "Bid director", capabilities: ["Bid management", "Proposal"] },
  { match: /\b(target operating model|tom\b|operating model)/i, role: "Operating model lead", capabilities: ["Target operating model"] },
  { match: /\b(transformation|turnaround|recovery)\b/i, role: "Transformation lead", capabilities: ["Transformation"] },
  { match: /\b(regulatory|compliance)\b/i, role: "Regulatory change", capabilities: ["Regulatory", "Compliance"] },
];

const LOCATIONS: [RegExp, string][] = [
  [/\babu dhabi\b/i, "Abu Dhabi"], [/\bdubai\b/i, "Dubai"], [/\briyadh\b/i, "Riyadh"], [/\bjeddah\b/i, "Jeddah"], [/\bdoha\b/i, "Doha"], [/\bmanama\b|\bbahrain\b/i, "Bahrain"],
  [/\bqatar\b/i, "Qatar"], [/\buae\b|\bemirates\b/i, "UAE"], [/\bksa\b|\bsaudi\b/i, "Saudi Arabia"], [/\bgcc\b|\bgulf\b|\bmiddle east\b/i, "Gulf"],
  [/\blondon\b/i, "London"], [/\bmanchester\b/i, "Manchester"], [/\bbirmingham\b/i, "Birmingham"], [/\bedinburgh\b/i, "Edinburgh"], [/\bleeds\b/i, "Leeds"], [/\bbristol\b/i, "Bristol"], [/\bglasgow\b/i, "Glasgow"],
  [/\buk\b|\bunited kingdom\b|\bbritain\b/i, "UK"], [/\bremote\b|\banywhere\b/i, "Remote"], [/\beurope\b/i, "Europe"], [/\bsingapore\b/i, "Singapore"],
];

const SECTORS: [RegExp, string][] = [
  [/\bbank(ing|s)?\b/i, "Banking"], [/\binsur(ance|er)\b/i, "Insurance"], [/\bfinancial services\b|\bfs\b|\bfintech\b/i, "Financial services"], [/\bsovereign\b|\bwealth fund\b/i, "Sovereign wealth"],
  [/\bgovernment\b|\bpublic sector\b|\bministry\b/i, "Government"], [/\benergy\b|\boil\b|\bgas\b|\butilit(y|ies)\b/i, "Energy"], [/\btelco\b|\btelecoms?\b/i, "Telecoms"],
  [/\bhealth(care)?\b|\bnhs\b|\bhospital\b/i, "Healthcare"], [/\bretail\b|\bconsumer\b/i, "Retail"], [/\btech(nology)?\b|\bsaas\b|\bscale-?up\b/i, "Technology"],
  [/\bdefen[cs]e\b/i, "Defence"], [/\bmanufactur(ing|er)\b/i, "Manufacturing"], [/\blogistics\b/i, "Logistics"], [/\bpe\b|\bprivate equity\b|\bportfolio\b/i, "Private equity"],
];

const NUM_WORDS: Record<string, number> = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

function detectRoute(t: string): { route: EngagementRoute | null; why: string | null } {
  if (/\b(perm(anent)?|fte|full[- ]time|salaried|headcount role)\b/i.test(t)) return { route: "PERMANENT", why: "Permanent hire (\"perm\")." };
  if (/\b(expert call|expert consultation|consultation|advisory|adviser|advisor|assurance|review|sounding board|expert network)\b/i.test(t)) return { route: "ADVISORY", why: "Advisory / expert engagement." };
  if (/\b(fractional|part[- ]time|\d\s*days? (a|per) week)\b/i.test(t)) return { route: "FRACTIONAL", why: "Fractional (days per week)." };
  if (/\binterim\b/i.test(t)) return { route: "INTERIM", why: "Interim cover." };
  if (/\b(sow|statement of work|proposal|bid|project team|deliverable)\b/i.test(t)) return { route: "SOW", why: "Delivered as a SOW / project." };
  if (/\b(contract(or|ors|ing)?|day rate|daily rate|outside ir35|inside ir35|\d+\s*(months?|mths?) )\b/i.test(t)) return { route: "CONTRACT", why: "Contract (day rate / fixed term)." };
  return { route: null, why: null };
}

function detectSeniority(t: string): Seniority | null {
  if (/\b(c-?level|chief|cxo)\b/i.test(t)) return "C_LEVEL";
  if (/\b(executive|vp|vice president|group head)\b/i.test(t)) return "EXECUTIVE";
  if (/\b(director|head of)\b/i.test(t)) return "DIRECTOR";
  if (/\b(senior|lead|principal)\b/i.test(t)) return "SENIOR_MANAGER";
  if (/\b(junior|associate|graduate|entry)\b/i.test(t)) return "ASSOCIATE";
  if (/\b(mid[- ]level|manager)\b/i.test(t)) return "MANAGER";
  return null;
}

function detectBudget(t: string): Budget | null {
  const m = /(£|\$|€|aed|sar|usd|gbp|qar)\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m)?(?:\s?(?:-|–|to)\s?(£|\$|€|aed|sar|usd|gbp|qar)?\s?(\d[\d,]*(?:\.\d+)?)\s?(k)?)?\s*(\/|per|a|an)?\s*(day|hour|hr|h|annum|year|yr|pa|month|mth)?/i.exec(t);
  if (!m) return null;
  const cur = { "£": "GBP", $: "USD", "€": "EUR" }[m[1]] ?? m[1].toUpperCase();
  const mult = (s?: string) => (s?.toLowerCase() === "k" ? 1000 : s?.toLowerCase() === "m" ? 1_000_000 : 1);
  const amount = Number(m[2].replace(/,/g, "")) * mult(m[3]);
  const max = m[5] ? Number(m[5].replace(/,/g, "")) * mult(m[6] ?? m[3]) : null;
  const unit = (m[8] ?? "").toLowerCase();
  const kind: BudgetKind = /^(day)$/.test(unit) || /\bday rate\b/i.test(t) ? "DAY_RATE" : /^(hour|hr|h)$/.test(unit) ? "HOURLY" : /^(month|mth)$/.test(unit) ? "PROJECT" : amount < 3000 && !/annum|year|yr|pa/.test(unit) ? "DAY_RATE" : "SALARY";
  return { kind, amount, currency: cur, max };
}

/** Structure a natural-language brief. Deterministic; an AI provider can refine it later. */
export function parseBrief(text: string): Brief {
  const t = text.replace(/\s+/g, " ").trim();
  const assumptions: string[] = [];
  const questions: string[] = [];

  const roles: string[] = []; const capabilities: string[] = []; let roleSeniority: Seniority | null = null;
  for (const r of ROLES) if (r.match.test(t)) { if (!roles.includes(r.role)) roles.push(r.role); for (const c of r.capabilities) if (!capabilities.includes(c)) capabilities.push(c); roleSeniority ??= r.seniority ?? null; }
  if (!roles.length) questions.push("Which role or capability is needed? (e.g. BA, PM, CISO, SAP lead)");

  // headcount: "2 BAs", "two PMs", "2 x BA", "x2"
  let headcount = 1;
  const hc = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:x\s*)?(?:(?:perm|permanent|contract|interim|fractional|senior|junior|experienced|good|strong|more|extra|additional|new)\s+){0,2}(?=(business analysts?|bas?\b|pms?\b|project|programme|architects?|engineers?|managers?|leads?|consultants?|people|heads?|roles?|resources?|experts?|cisos?|cfos?|coos?|ctos?|developers?|analysts?))/i.exec(t) ?? /\bx\s?(\d{1,2})\b/i.exec(t);
  if (hc) { headcount = Number(hc[1]) || NUM_WORDS[hc[1].toLowerCase()] || 1; if (headcount > 1) assumptions.push(`${headcount} people needed.`); }

  const { route, why } = detectRoute(t);
  if (why) assumptions.push(why); else questions.push("Permanent, contract, fractional, advisory or SOW?");

  const locations = LOCATIONS.filter(([re]) => re.test(t)).map(([, name]) => name);
  const mustBeLocal = /\b(already (in|based)|based in|located in|on[- ]?site|in[- ]country|locally|living in|resident in|currently in)\b/i.test(t) && locations.length > 0;
  if (mustBeLocal) assumptions.push(`Must already be in ${locations[0]} (no relocation).`);
  else if (locations.length) assumptions.push(`Location ${locations.join(" / ")}; people willing to relocate are included and labelled.`);
  else questions.push("Where is the work, and is remote acceptable?");

  let workRights: string | null = null;
  if (/\b(visa|residen(ce|cy)|work permit|right to work|emirates id|iqama|no sponsorship|golden visa|sponsorship)\b/i.test(t)) {
    const place = locations.find((l) => ["Dubai", "Abu Dhabi", "UAE"].includes(l)) ? "UAE" : locations.find((l) => ["Riyadh", "Jeddah", "Saudi Arabia"].includes(l)) ? "Saudi Arabia" : locations.find((l) => ["Doha", "Qatar"].includes(l)) ? "Qatar" : locations.find((l) => ["London", "Manchester", "Birmingham", "Edinburgh", "Leeds", "Bristol", "Glasgow", "UK"].includes(l)) ? "UK" : locations[0] ?? "the country";
    workRights = /\bno sponsorship\b|\bwithout sponsorship\b|\balready\b/i.test(t) ? `Existing right to work in ${place} (no sponsorship)` : `Right to work in ${place}`;
    assumptions.push(`${workRights}. People whose work rights are not recorded are shown as "to confirm", not excluded.`);
  }

  const sectors = SECTORS.filter(([re]) => re.test(t)).map(([, name]) => name);
  const seniority = detectSeniority(t) ?? roleSeniority;

  const budget = detectBudget(t);
  if (budget) assumptions.push(`Budget read as ${budget.currency} ${budget.amount.toLocaleString("en-GB")}${budget.max ? `–${budget.max.toLocaleString("en-GB")}` : ""} ${budget.kind === "DAY_RATE" ? "per day" : budget.kind === "HOURLY" ? "per hour" : budget.kind === "PROJECT" ? "for the project" : "per year"}.`);
  else questions.push(route === "PERMANENT" ? "Salary range?" : route === "ADVISORY" ? "Hourly rate and how many hours?" : "Day rate or budget?");

  const dur = /(\d{1,2})\s*(months?|mths?|weeks?|wks?)\b/i.exec(t);
  const durationMonths = dur ? (/w/i.test(dur[2]) ? Math.max(1, Math.round(Number(dur[1]) / 4)) : Number(dur[1])) : null;

  let startBy: string | null = null;
  if (/\b(asap|immediately|urgent(ly)?|now|straight away)\b/i.test(t)) startBy = "ASAP";
  else { const q = /\bq([1-4])\b/i.exec(t); const mo = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.exec(t); const wk = /\bin (\d{1,2}) weeks?\b/i.exec(t); startBy = q ? `Q${q[1]}` : mo ? mo[1][0].toUpperCase() + mo[1].slice(1).toLowerCase() : wk ? `In ${wk[1]} weeks` : null; }
  if (!startBy) questions.push("When does this need to start?");

  const title = [headcount > 1 ? `${headcount} × ` : "", roles[0] ?? "Requirement", route ? ` (${route.toLowerCase()})` : "", locations.length ? ` · ${locations[0]}` : ""].join("").trim();
  return { rawText: t, title, engagementRoute: route, headcount, roles, capabilities, sectors, seniority, locations, mustBeLocal, workRights, budget, durationMonths, startBy, assumptions, questions };
}

// ---------- Matching against a brief ----------

export type BriefPerson = MatchPerson & { workRights: string[]; relocationInterest: boolean };

export type HardCheck = { label: string; state: "met" | "unmet" | "unknown"; note: string };

export type BriefMatch = {
  match: MatchResult;
  checks: HardCheck[];
  /** "meets" = every hard check met; "conversation" = a hard check is unknown; "stretch" = a hard check is unmet (still shown, never hidden). */
  tier: "meets" | "conversation" | "stretch";
};

const norm = (s: string) => s.trim().toLowerCase();
const COUNTRY_OF: Record<string, string> = { dubai: "uae", "abu dhabi": "uae", sharjah: "uae", riyadh: "saudi arabia", jeddah: "saudi arabia", doha: "qatar", london: "uk", manchester: "uk", birmingham: "uk", edinburgh: "uk", leeds: "uk", bristol: "uk", glasgow: "uk" };
/** "here" = same city/country as the brief; "country" = same country as a city-level brief (nearby, to confirm); "no" otherwise. */
const placeFit = (person: BriefPerson, place: string): "here" | "country" | "no" => {
  const p = norm(place); const city = norm(person.primaryCity ?? ""); const country = norm(person.primaryCountry ?? "");
  const gulf = ["uae", "saudi arabia", "qatar", "bahrain", "kuwait", "oman"];
  if (p === "gulf") return gulf.includes(country) || gulf.includes(COUNTRY_OF[city] ?? "") ? "here" : "no";
  if (p === "remote") return "here";
  if (COUNTRY_OF[p]) { // brief names a city
    if (city === p) return "here";
    return country === COUNTRY_OF[p] || COUNTRY_OF[city] === COUNTRY_OF[p] ? "country" : "no";
  }
  // brief names a country / region
  return country === p || COUNTRY_OF[city] === p || country.includes(p) || p.includes(country) ? "here" : "no";
};

export function hardChecks(brief: Brief, person: BriefPerson): HardCheck[] {
  const checks: HardCheck[] = [];
  if (brief.locations.length) {
    const fits = brief.locations.map((l) => placeFit(person, l));
    const local = fits.includes("here"); const near = fits.includes("country");
    const wants = brief.locations.some((l) => person.targetLocations.some((t) => norm(t) === norm(l) || COUNTRY_OF[norm(t)] === norm(l))) || person.relocationInterest;
    if (local) checks.push({ label: `In ${brief.locations[0]}`, state: "met", note: `Based in ${person.primaryCity ?? person.primaryCountry}.` });
    else if (near) checks.push({ label: `In ${brief.locations[0]}`, state: "unknown", note: `Based in ${person.primaryCity}, same country. Confirm they would work in ${brief.locations[0]}.` });
    else if (brief.mustBeLocal) checks.push({ label: `In ${brief.locations[0]}`, state: "unmet", note: `Based in ${person.primaryCity ?? person.primaryCountry ?? "an unknown location"}${wants ? ", would relocate" : ""}; the brief needs someone already there.` });
    else checks.push({ label: `In ${brief.locations[0]}`, state: wants ? "unknown" : "unmet", note: wants ? `Based in ${person.primaryCity ?? person.primaryCountry}; has expressed interest in ${brief.locations[0]}. Mobility to confirm.` : `Based in ${person.primaryCity ?? person.primaryCountry ?? "an unknown location"}; ${brief.locations[0]} not a stated target.` });
  }
  if (brief.workRights) {
    const need = norm(brief.workRights);
    const region = ["uae", "saudi arabia", "qatar", "uk", "eu", "us"].find((r) => need.includes(r)) ?? null;
    const rights = person.workRights.map(norm);
    if (!rights.length) checks.push({ label: "Work rights", state: "unknown", note: "Work rights not recorded. Ask before proposing." });
    else if (region && rights.some((r) => r.includes(region) || (region === "uae" && /(emirates|golden visa|uae)/.test(r)) || (region === "uk" && /(british|uk|settled|ilr)/.test(r)))) checks.push({ label: "Work rights", state: "met", note: `Recorded: ${person.workRights.join(", ")}.` });
    else checks.push({ label: "Work rights", state: "unmet", note: `Recorded rights (${person.workRights.join(", ")}) do not cover this; sponsorship would be needed.` });
  }
  if (brief.engagementRoute && person.engagementPreferences.length) {
    const ok = person.engagementPreferences.includes(brief.engagementRoute) || (brief.engagementRoute === "INTERIM" && person.engagementPreferences.includes("CONTRACT")) || (brief.engagementRoute === "ADVISORY" && person.engagementPreferences.includes("FRACTIONAL"));
    checks.push({ label: brief.engagementRoute === "PERMANENT" ? "Open to permanent" : `Open to ${brief.engagementRoute.toLowerCase()}`, state: ok ? "met" : "unknown", note: ok ? "Stated preference includes this route." : `Stated preferences: ${person.engagementPreferences.map((r) => r.toLowerCase()).join(", ")}. Worth asking.` });
  }
  return checks;
}

export function matchBrief(brief: Brief, people: BriefPerson[], limit = 12, now = new Date()): BriefMatch[] {
  const opp = { requiredCapabilities: brief.capabilities, preferredCapabilities: [], sectors: brief.sectors, seniority: brief.seniority, engagementRoute: brief.engagementRoute ?? "CONTRACT", location: brief.locations[0] ?? null, budget: brief.budget?.amount ?? null };
  const byId = new Map(people.map((p) => [p.id, p]));
  const results = retrieveMatches(opp, people, Math.max(limit, 30), now);
  const out: BriefMatch[] = results.map((match) => {
    const checks = hardChecks(brief, byId.get(match.personId)!);
    const tier: BriefMatch["tier"] = checks.some((c) => c.state === "unmet") ? "stretch" : checks.some((c) => c.state === "unknown") ? "conversation" : "meets";
    return { match, checks, tier };
  });
  const order = { meets: 0, conversation: 1, stretch: 2 };
  return out.sort((a, b) => order[a.tier] - order[b.tier] || b.match.fitScore - a.match.fitScore).slice(0, limit);
}

// ---------- Commercials ----------

export type AccountKind = "CLIENT" | "AGENCY" | "EXPERT_NETWORK";

/** Tenant rate card. Every number is configurable in Settings → Commercials. */
export type RateCard = {
  currency: string;
  permPct: number; // % of first-year base salary, direct client
  agencyPermPct: number; // agency's own fee % of salary (what the agency charges its client)
  agencyReferralSharePct: number; // our share of the agency's fee
  contractMarginPct: number; // % of billed day rate, direct client
  agencyContractSharePct: number; // our share of the agency's contract margin
  agencyContractMarginPct: number; // agency's margin on day rate
  expertHourlyTakePct: number; // platform take on an expert call
  sowSharePct: number; // % of SOW value (Amana / consultancy)
  introductionFee: number; // flat fee where a % is not appropriate
  workingDaysPerYear: number;
  defaultExpertHours: number;
};

export const DEFAULT_RATE_CARD: RateCard = {
  currency: "GBP", permPct: 18, agencyPermPct: 20, agencyReferralSharePct: 35, contractMarginPct: 12, agencyContractSharePct: 40, agencyContractMarginPct: 15, expertHourlyTakePct: 30, sowSharePct: 10, introductionFee: 2500, workingDaysPerYear: 220, defaultExpertHours: 2,
};

export type FeeModel = "PERM_PCT" | "AGENCY_REFERRAL" | "CONTRACT_MARGIN" | "AGENCY_CONTRACT_SHARE" | "EXPERT_HOURLY" | "SOW_SHARE" | "INTRODUCTION_FEE";

export const FEE_MODEL_LABELS: Record<FeeModel, string> = {
  PERM_PCT: "Success fee (% of first-year salary)",
  AGENCY_REFERRAL: "Referral share of the agency's fee",
  CONTRACT_MARGIN: "Margin on the day rate",
  AGENCY_CONTRACT_SHARE: "Share of the agency's contract margin",
  EXPERT_HOURLY: "Take on expert hours",
  SOW_SHARE: "Share of SOW value",
  INTRODUCTION_FEE: "Flat introduction fee",
};

/** Pick the fee model that fits the route and who is paying. Overridable per requirement. */
export function defaultFeeModel(route: EngagementRoute | null, kind: AccountKind): FeeModel {
  if (kind === "EXPERT_NETWORK") return route === "ADVISORY" ? "EXPERT_HOURLY" : "SOW_SHARE";
  if (route === "PERMANENT") return kind === "AGENCY" ? "AGENCY_REFERRAL" : "PERM_PCT";
  if (route === "ADVISORY") return "EXPERT_HOURLY";
  if (route === "SOW") return "SOW_SHARE";
  if (route === "CONTRACT" || route === "INTERIM" || route === "FRACTIONAL") return kind === "AGENCY" ? "AGENCY_CONTRACT_SHARE" : "CONTRACT_MARGIN";
  return "INTRODUCTION_FEE";
}

export type Terms = { model: FeeModel; pct: number | null; flat: number | null; currency: string };

export function defaultTerms(card: RateCard, model: FeeModel): Terms {
  const pct = { PERM_PCT: card.permPct, AGENCY_REFERRAL: card.agencyReferralSharePct, CONTRACT_MARGIN: card.contractMarginPct, AGENCY_CONTRACT_SHARE: card.agencyContractSharePct, EXPERT_HOURLY: card.expertHourlyTakePct, SOW_SHARE: card.sowSharePct, INTRODUCTION_FEE: null }[model];
  return { model, pct, flat: model === "INTRODUCTION_FEE" ? card.introductionFee : null, currency: card.currency };
}

export type FeeEstimate = { gross: number; ourTake: number; perHead: number; currency: string; basis: string; confident: boolean };

/**
 * Estimate the fee for a brief under given terms. `gross` is what the paying party spends
 * on the placement/engagement (salary, billed days, SOW value); `ourTake` is our revenue.
 */
export function estimateFee(brief: Pick<Brief, "engagementRoute" | "headcount" | "budget" | "durationMonths">, terms: Terms, card: RateCard, hours?: number | null): FeeEstimate {
  const cur = brief.budget?.currency ?? terms.currency;
  const heads = Math.max(1, brief.headcount || 1);
  const pct = (terms.pct ?? 0) / 100;
  const b = brief.budget;
  const months = brief.durationMonths ?? 6;
  const days = Math.round((card.workingDaysPerYear / 12) * months);
  const mid = b ? (b.max ? (b.amount + b.max) / 2 : b.amount) : 0;
  let perGross = 0, perTake = 0, basis = "", confident = !!b;
  switch (terms.model) {
    case "PERM_PCT": { const salary = b?.kind === "SALARY" ? mid : b?.kind === "DAY_RATE" ? mid * card.workingDaysPerYear : 0; perGross = salary; perTake = salary * pct; basis = salary ? `${terms.pct}% of ${fmt(salary, cur)} salary` : "Needs a salary to estimate"; break; }
    case "AGENCY_REFERRAL": { const salary = b?.kind === "SALARY" ? mid : 0; const agencyFee = salary * (card.agencyPermPct / 100); perGross = agencyFee; perTake = agencyFee * pct; basis = salary ? `${terms.pct}% of the agency's ${card.agencyPermPct}% fee on ${fmt(salary, cur)}` : "Needs a salary to estimate"; break; }
    case "CONTRACT_MARGIN": { const rate = b?.kind === "DAY_RATE" ? mid : 0; perGross = rate * days; perTake = perGross * pct; basis = rate ? `${terms.pct}% of ${fmt(rate, cur)}/day × ${days} days (${months} mo)` : "Needs a day rate to estimate"; break; }
    case "AGENCY_CONTRACT_SHARE": { const rate = b?.kind === "DAY_RATE" ? mid : 0; const margin = rate * days * (card.agencyContractMarginPct / 100); perGross = margin; perTake = margin * pct; basis = rate ? `${terms.pct}% of the agency's ${card.agencyContractMarginPct}% margin on ${fmt(rate, cur)}/day × ${days} days` : "Needs a day rate to estimate"; break; }
    case "EXPERT_HOURLY": { const h = hours ?? card.defaultExpertHours; const rate = b?.kind === "HOURLY" ? mid : b?.kind === "DAY_RATE" ? mid / 8 : 0; perGross = rate * h; perTake = perGross * pct; basis = rate ? `${terms.pct}% of ${fmt(rate, cur)}/hour × ${h} hours` : "Needs an hourly rate to estimate"; break; }
    case "SOW_SHARE": { const value = b?.kind === "PROJECT" ? mid : b?.kind === "DAY_RATE" ? mid * days : 0; perGross = value; perTake = value * pct; basis = value ? `${terms.pct}% of ${fmt(value, cur)} SOW value` : "Needs a SOW value or day rate to estimate"; break; }
    case "INTRODUCTION_FEE": { perGross = terms.flat ?? 0; perTake = terms.flat ?? 0; basis = `Flat ${fmt(perTake, cur)} per introduction`; confident = true; break; }
  }
  if (terms.model !== "INTRODUCTION_FEE" && perGross <= 0) confident = false;
  return { gross: Math.round(perGross * heads), ourTake: Math.round(perTake * heads), perHead: Math.round(perTake), currency: cur, basis: heads > 1 ? `${basis} × ${heads} people` : basis, confident };
}

export function fmt(v: number, cur = "GBP"): string {
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v).replace(/\u00a0/g, " "); } catch { return `${cur} ${Math.round(v).toLocaleString("en-GB")}`; }
}

// ---------- Portal-safe view of a shortlist entry ----------

export type ShortlistDecision = "CANDIDATE" | "SHORTLISTED" | "PROPOSED" | "CLIENT_INTERESTED" | "CLIENT_PASSED" | "INTRODUCED" | "PLACED" | "NOT_FOR_THIS";

export const SHORTLIST_LABELS: Record<ShortlistDecision, string> = {
  CANDIDATE: "Candidate", SHORTLISTED: "Shortlisted", PROPOSED: "Proposed to client", CLIENT_INTERESTED: "Client interested", CLIENT_PASSED: "Client passed", INTRODUCED: "Introduced", PLACED: "Placed / engaged", NOT_FOR_THIS: "Not for this requirement",
};

/** Decisions that make an entry visible in the client / agency portal (anonymised). */
export const PORTAL_VISIBLE: ShortlistDecision[] = ["PROPOSED", "CLIENT_INTERESTED", "CLIENT_PASSED", "INTRODUCED", "PLACED"];

export type BriefStatus = "NEW" | "QUALIFYING" | "SEARCHING" | "SHORTLISTED" | "INTRODUCING" | "FILLED" | "CLOSED";
export const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = { NEW: "New", QUALIFYING: "Qualifying", SEARCHING: "Searching", SHORTLISTED: "Shortlist shared", INTRODUCING: "Introducing", FILLED: "Filled", CLOSED: "Closed" };

export type FeeStatus = "FORECAST" | "AGREED" | "INVOICED" | "PAID" | "WRITTEN_OFF";
export const FEE_STATUS_LABELS: Record<FeeStatus, string> = { FORECAST: "Forecast", AGREED: "Agreed", INVOICED: "Invoiced", PAID: "Paid", WRITTEN_OFF: "Written off" };

/** Band a rate/salary for the portal so the client sees a range, never the person's exact number. */
export function rateBand(stated: string | null | undefined): string | null {
  if (!stated) return null;
  const cur = /aed/i.test(stated) ? "AED" : /sar/i.test(stated) ? "SAR" : /\$|usd/i.test(stated) ? "USD" : "GBP";
  const n = Number(String(stated).replace(/[^0-9.]/g, "")) * (/k\b/i.test(stated) ? 1000 : 1);
  if (!n) return null;
  const perDay = /day|\/d\b/i.test(stated) || n < 10000;
  const step = perDay ? (cur === "GBP" ? 250 : 1000) : 25000;
  const lo = Math.floor(n / step) * step;
  return `${fmt(lo, cur)}–${fmt(lo + step, cur)}${perDay ? "/day" : ""}`;
}
