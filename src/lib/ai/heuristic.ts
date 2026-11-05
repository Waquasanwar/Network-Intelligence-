import type { AIProvider, ExtractedSummary, ProfileDraft, SearchIntent } from "./types";
import { ExtractedSummarySchema, ProfileDraftSchema } from "./types";

/**
 * Local, deterministic provider. Runs with no network access and no external model.
 * It is intentionally conservative: it surfaces candidates for review rather than asserting facts.
 */

const CAPABILITY_LEXICON = [
  "programme management", "programme director", "project management", "pmo", "transformation",
  "change management", "cyber security", "cyber", "security architecture", "ciso", "identity and access",
  "data engineering", "data platform", "data strategy", "analytics", "ai", "machine learning", "genai",
  "cloud", "azure", "aws", "erp", "sap", "oracle", "dynamics", "salesforce", "servicenow",
  "architecture", "enterprise architecture", "solution architecture", "product management",
  "agile delivery", "scrum", "devops", "platform engineering", "finance transformation", "cfo",
  "procurement", "supply chain", "operations", "target operating model", "m&a integration", "pmi",
  "regulatory", "compliance", "risk", "governance", "stakeholder management", "vendor management",
  "systems integrator", "si challenge", "turnaround", "recovery", "stabilisation", "commercial",
  "bid management", "proposal", "sow", "delivery lead", "engineering lead", "cto", "cio", "coo",
];

const SECTOR_LEXICON = [
  "banking", "financial services", "insurance", "public sector", "government", "healthcare", "nhs",
  "energy", "utilities", "telecoms", "retail", "consumer", "manufacturing", "aviation", "defence",
  "real estate", "construction", "logistics", "pharma", "life sciences", "education", "technology",
  "oil and gas", "sovereign wealth", "hospitality", "media",
];

const LOCATION_LEXICON = ["london", "uk", "manchester", "birmingham", "edinburgh", "dubai", "abu dhabi", "uae", "riyadh", "saudi", "ksa", "doha", "qatar", "remote", "europe", "singapore", "new york"];

const ROUTE_HINTS: Record<string, "PERMANENT" | "CONTRACT" | "INTERIM" | "FRACTIONAL" | "ADVISORY" | "SOW"> = {
  permanent: "PERMANENT", "perm ": "PERMANENT", "full-time": "PERMANENT", contract: "CONTRACT", contracting: "CONTRACT",
  "day rate": "CONTRACT", interim: "INTERIM", fractional: "FRACTIONAL", "part-time": "FRACTIONAL", advisory: "ADVISORY",
  "non-exec": "ADVISORY", "sow": "SOW", "statement of work": "SOW", "project team": "SOW",
};

const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 3);

/** token → {city?, country} so a detected place becomes structured fields. */
const LOCATION_MAP: Record<string, { city?: string; country: string }> = {
  london: { city: "London", country: "UK" }, manchester: { city: "Manchester", country: "UK" }, birmingham: { city: "Birmingham", country: "UK" }, edinburgh: { city: "Edinburgh", country: "UK" }, uk: { country: "UK" },
  dubai: { city: "Dubai", country: "UAE" }, "abu dhabi": { city: "Abu Dhabi", country: "UAE" }, uae: { country: "UAE" },
  riyadh: { city: "Riyadh", country: "KSA" }, saudi: { country: "KSA" }, ksa: { country: "KSA" },
  doha: { city: "Doha", country: "Qatar" }, qatar: { country: "Qatar" },
  singapore: { city: "Singapore", country: "Singapore" }, "new york": { city: "New York", country: "USA" }, europe: { country: "Europe" },
};

const titleCase = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bAnd\b/g, "and").replace(/\bOf\b/g, "of");

function splitName(raw: string): { firstName: string; lastName: string } {
  const parts = raw.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** A name is the run of capitalised words at the very start of a bio ("Priya Natarajan is…"). */
function nameFromText(text: string): string {
  const m = /^\s*((?:[A-Z][a-z'’.-]+)(?:\s+(?:[A-Z][a-z'’.-]+|Al|bin|van|de|von)){0,2})\b/.exec(text.trim());
  return m?.[1]?.trim() ?? "";
}

/** Pull a probable name out of a LinkedIn vanity URL (…/in/jane-doe-1a2b → "Jane Doe"). */
function nameFromLinkedin(url: string): string {
  const slug = /\/in\/([^/?#]+)/i.exec(url)?.[1];
  if (!slug) return "";
  const tokens = decodeURIComponent(slug).split("-").filter((t) => /^[a-z']+$/i.test(t) && t.length > 1).slice(0, 3);
  return tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
}

function findAll(text: string, lexicon: string[]): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  for (const term of lexicon) if (t.includes(term)) out.push(term);
  return [...new Set(out)];
}

function detectStatus(text: string): ExtractedSummary["suggestedAvailabilityStatus"] {
  const t = text.toLowerCase();
  if (/available (now|immediately)|between (roles|engagements)|just finished|finished my/.test(t)) return "AVAILABLE_NOW";
  if (/finishing|wrapping up|ends? in|rolls? off|coming to an end/.test(t)) return "FINISHING_ENGAGEMENT_SOON";
  if (/happy where|not looking|no plans to move|very settled/.test(t)) return "HAPPY_WHERE_I_AM";
  if (/keep in touch|not right now|maybe next year/.test(t)) return "NOT_LOOKING_KEEP_IN_TOUCH";
  if (/only (for )?the right|right opportunity|would have to be special/.test(t)) return "RIGHT_OPPORTUNITY_ONLY";
  if (/quietly|discreet|not actively|low key/.test(t)) return "QUIETLY_EXPLORING";
  if (/fractional|couple of days a week|two days a week/.test(t)) return "FRACTIONAL_AVAILABILITY";
  if (/taking a break|sabbatical|time off/.test(t)) return "TAKING_A_BREAK";
  if (/open to (a )?conversation|open to hearing|happy to talk/.test(t)) return "OPEN_TO_CONVERSATIONS";
  return undefined;
}

export class HeuristicAIProvider implements AIProvider {
  readonly name = "heuristic";

  async structureConversation(input: { personName: string; notes?: string | null; transcript?: string | null }): Promise<ExtractedSummary> {
    const text = [input.notes, input.transcript].filter(Boolean).join("\n\n");
    const lower = text.toLowerCase();
    const ss = sentences(text);

    const pick = (re: RegExp, limit = 6) => ss.filter((s) => re.test(s.toLowerCase())).map((s) => s.slice(0, 160)).slice(0, limit);

    const strengths = pick(/good at|strong(est)? (at|in|on)|known for|people bring me in|my sweet spot|i('| a)m best/);
    const avoid = pick(/(?:do|does)n'?t want|(?:do|does) not want|don'?t want|no longer|not interested in|tired of|avoid|never again|won'?t do/);
    const constraints = pick(/can'?t|cannot|need(s)? to|must|only if|family|school|notice period|visa|unless/);
    const characteristics = pick(/i (like|prefer|work best|thrive)|environment|culture|team|hands-on|direct|pace/);
    const unresolved = pick(/\?$/ , 8);

    const rates = ss.find((s) => /£|\$|\baed\b|\bsar\b|per day|day rate|salary|package|\d+k\b/.test(s.toLowerCase())) ?? "";

    const routes = new Set<ExtractedSummary["engagementPreferences"][number]>();
    for (const [hint, route] of Object.entries(ROUTE_HINTS)) if (lower.includes(hint)) routes.add(route);

    const followUp = /follow(?:-| )up (?:in|on|next) ([^.,\n]+)/i.exec(text)?.[1]?.trim();

    const summaryParts = [
      strengths[0] ? `Strengths: ${strengths[0]}` : null,
      routes.size ? `Open to: ${[...routes].map((r) => r.toLowerCase()).join(", ")}` : null,
      constraints[0] ? `Constraint: ${constraints[0]}` : null,
    ].filter(Boolean);

    const draft = {
      headline: strengths[0]?.slice(0, 120) ?? "",
      capabilities: findAll(text, CAPABILITY_LEXICON),
      sectors: findAll(text, SECTOR_LEXICON),
      engagementPreferences: [...routes],
      locationPreferences: findAll(text, LOCATION_LEXICON),
      currentStatus: ss.find((s) => /currently|at the moment|right now|these days/.test(s.toLowerCase()))?.slice(0, 200) ?? "",
      suggestedAvailabilityStatus: detectStatus(text),
      ratesOrSalary: rates.slice(0, 200),
      workingCharacteristics: characteristics,
      constraints,
      strengths,
      avoid,
      followUpDate: followUp,
      unresolvedQuestions: [
        ...unresolved,
        ...(rates ? [] : ["Rates / salary expectations not discussed."]),
        ...(routes.size ? [] : ["Preferred engagement route not confirmed."]),
        ...(findAll(text, LOCATION_LEXICON).length ? [] : ["Location and mobility not confirmed."]),
      ].slice(0, 12),
      summary: summaryParts.length ? summaryParts.join(". ") + "." : `Notes captured for ${input.personName}; review and complete the structured fields.`,
    };
    return ExtractedSummarySchema.parse(draft);
  }

  async explainFit(input: { personName: string; opportunityTitle: string; dimensions: { name: string; score: number; note: string }[]; uncertainty: string[] }) {
    const strong = input.dimensions.filter((d) => d.score >= 70).map((d) => `${d.name.toLowerCase()} (${d.note})`);
    const weak = input.dimensions.filter((d) => d.score < 45).map((d) => `${d.name.toLowerCase()} (${d.note})`);
    return [
      `${input.personName} may fit "${input.opportunityTitle}" because of ${strong.length ? strong.join("; ") : "partial overlap only"}.`,
      weak.length ? `Gaps to weigh: ${weak.join("; ")}.` : "",
      input.uncertainty.length ? `Before recommending: ${input.uncertainty.join(" ")}` : "",
      "This is a suggestion for human review, not a decision.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  async enrichProfile(input: { name?: string; linkedinUrl?: string; text?: string }): Promise<ProfileDraft> {
    const text = [input.name, input.text].filter(Boolean).join("\n");
    const lower = text.toLowerCase();

    let { firstName, lastName } = splitName(input.name ?? "");
    if (!firstName && input.linkedinUrl) ({ firstName, lastName } = splitName(nameFromLinkedin(input.linkedinUrl)));
    if (!firstName && input.text) ({ firstName, lastName } = splitName(nameFromText(input.text)));

    const capabilities = findAll(text, CAPABILITY_LEXICON).map(titleCase);
    const sectors = findAll(text, SECTOR_LEXICON).map(titleCase);
    const locTokens = findAll(text, LOCATION_LEXICON);
    let primaryCity = "";
    let primaryCountry = "";
    for (const tok of locTokens) {
      const m = LOCATION_MAP[tok];
      if (!m) continue;
      if (m.city && !primaryCity) { primaryCity = m.city; primaryCountry = m.country; }
      else if (!primaryCountry && m.country) primaryCountry = m.country;
    }

    const routes = [...new Set(Object.entries(ROUTE_HINTS).filter(([h]) => lower.includes(h)).map(([, r]) => r))];
    const atMatch = /\b([A-Z][\w &/-]{2,60}?)\s+(?:at|@)\s+([A-Z][\w &/.-]{1,60})/.exec(text);
    const currentRole = atMatch?.[1]?.trim().slice(0, 120) ?? "";
    const currentCompany = atMatch?.[2]?.trim().replace(/[.,;]$/, "").slice(0, 120) ?? "";
    const firstSentence = sentences(text).find((s) => s.length > 10) ?? "";
    const headline = (atMatch ? `${currentRole} at ${currentCompany}` : firstSentence).slice(0, 160);

    const hasRights = /right to work|citizen|permanent resident|visa|green card|iqama/.test(lower);
    const workRights = hasRights ? [...new Set(locTokens.map((t) => LOCATION_MAP[t]?.country).filter((c): c is string => !!c && c !== "Europe"))] : [];

    const signalCount = capabilities.length + sectors.length + locTokens.length + (input.linkedinUrl ? 1 : 0);
    const confidence: ProfileDraft["confidence"] = (input.linkedinUrl && input.text && capabilities.length >= 2) || capabilities.length >= 3 ? "high" : signalCount >= 1 || !!input.text ? "medium" : "low";

    const unresolved: string[] = [];
    if (!firstName || !lastName) unresolved.push("Confirm the person's full name.");
    if (!capabilities.length) unresolved.push("No expertise detected — add a few areas they are known for.");
    if (!primaryCountry) unresolved.push("Location not confirmed.");
    if (!routes.length) unresolved.push("Preferred engagement route (permanent, contract, advisory…) not stated.");

    return ProfileDraftSchema.parse({
      firstName, lastName, headline, currentCompany, currentRole, primaryCity, primaryCountry,
      capabilities, sectors, workRights, engagementPreferences: routes,
      suggestedAvailabilityStatus: detectStatus(text),
      summary: firstSentence.slice(0, 400),
      confidence, unresolved: unresolved.slice(0, 8),
    });
  }

  async parseSearch(query: string): Promise<SearchIntent> {
    const q = query.toLowerCase();
    const routes = [...new Set(Object.entries(ROUTE_HINTS).filter(([h]) => q.includes(h)).map(([, r]) => r))];
    return {
      text: query,
      capabilities: findAll(q, CAPABILITY_LEXICON),
      locations: findAll(q, LOCATION_LEXICON),
      routes,
      availableSoon: /available|free|soon|now|next month|finishing/.test(q),
      workedWithOnly: /worked with|we know|trusted|seen deliver|proven/.test(q),
      sectors: findAll(q, SECTOR_LEXICON),
    };
  }
}
