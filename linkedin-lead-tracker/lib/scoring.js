// Ideal-customer-profile (ICP) model: sector detection and lead scoring. Runs in Node and in the browser.

export const RELATIONSHIPS = [
  { key: "follows_page", label: "Follows my page", weight: 15 },
  { key: "follows_me", label: "Follows me", weight: 12 },
  { key: "engaged", label: "Engaged with my content", weight: 15 },
  { key: "viewer", label: "Viewed my profile", weight: 8 },
  { key: "connection", label: "1st-degree connection", weight: 8 },
  { key: "prospect", label: "Prospect (not connected yet)", weight: 0 },
];

// Appointment-setting pipeline, in order.
export const STAGES = [
  { key: "new", label: "New lead" },
  { key: "warming", label: "Warming up", hint: "Engaging with their posts before reaching out" },
  { key: "requested", label: "Connection requested" },
  { key: "connected", label: "Connected" },
  { key: "messaged", label: "Messaged" },
  { key: "conversation", label: "In conversation" },
  { key: "booked", label: "Appointment booked" },
  { key: "held", label: "Appointment held" },
  { key: "proposal", label: "Proposal sent" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "not_fit", label: "Not a fit" },
];
export const CLOSED_STAGES = ["won", "lost", "not_fit"];

export const ACTIVITY_TYPES = [
  { key: "note", label: "Note" },
  { key: "engaged_post", label: "I engaged with their post" },
  { key: "they_engaged", label: "They engaged with my post", inbound: true },
  { key: "connection_sent", label: "Connection request sent" },
  { key: "connection_accepted", label: "Connection accepted", inbound: true },
  { key: "message_sent", label: "Message sent" },
  { key: "replied", label: "They replied", inbound: true },
  { key: "call_booked", label: "Appointment booked" },
  { key: "call_held", label: "Appointment held" },
  { key: "no_show", label: "No-show" },
];

export const DEFAULT_SECTORS = [
  { name: "Financial Services", priority: 0, keywords: ["bank", "banking", "fintech", "insurance", "asset management", "wealth", "investment", "capital", "payments", "lending", "credit"] },
  { name: "Technology & SaaS", priority: 0, keywords: ["software", "saas", "tech", "technology", "cloud", "ai", "data", "cyber", "cybersecurity", "it services", "platform", "digital"] },
  { name: "Healthcare & Life Sciences", priority: 0, keywords: ["health", "healthcare", "hospital", "clinic", "pharma", "pharmaceutical", "biotech", "medical", "life sciences", "nhs"] },
  { name: "Real Estate & Construction", priority: 0, keywords: ["real estate", "property", "construction", "developer", "architecture", "facilities", "proptech", "building"] },
  { name: "Professional Services", priority: 0, keywords: ["consulting", "consultancy", "advisory", "accounting", "audit", "law", "legal", "solicitor", "recruitment", "staffing"] },
  { name: "Energy & Utilities", priority: 0, keywords: ["energy", "oil", "gas", "renewable", "solar", "utilities", "power", "petroleum"] },
  { name: "Government & Public Sector", priority: 0, keywords: ["government", "public sector", "ministry", "council", "authority", "municipality", "defence", "defense"] },
  { name: "Retail & E-commerce", priority: 0, keywords: ["retail", "ecommerce", "e-commerce", "consumer", "fmcg", "cpg", "brand", "fashion"] },
  { name: "Manufacturing & Logistics", priority: 0, keywords: ["manufacturing", "industrial", "logistics", "supply chain", "automotive", "aerospace", "shipping", "freight"] },
  { name: "Education", priority: 0, keywords: ["education", "university", "school", "edtech", "academy", "college", "training"] },
  { name: "Hospitality & Travel", priority: 0, keywords: ["hospitality", "hotel", "travel", "tourism", "restaurant", "airline", "aviation"] },
  { name: "Media & Marketing", priority: 0, keywords: ["media", "marketing", "advertising", "agency", "pr", "communications", "publishing"] },
];

// Generic decision-maker signals, used when the title doesn't match one of your own target titles.
export const SENIORITY_KEYWORDS = ["founder", "co-founder", "owner", "ceo", "coo", "cfo", "cto", "cio", "cmo", "chief", "president", "vp", "vice president", "director", "head of", "partner", "managing", "principal", "gm", "general manager"];

export const DEFAULT_TEMPLATES = [
  { id: "t-connect", name: "Connection request", body: "Hi {firstName}, I noticed you're working in {sector} at {company}. I share practical ideas on this every week and would be glad to connect." },
  { id: "t-follower", name: "Thank a follower", body: "Hi {firstName}, thanks for following along. Out of curiosity, what's the biggest challenge on your plate at {company} right now?" },
  { id: "t-engaged", name: "After they engaged", body: "Thanks for the comment on my post, {firstName}. It's a topic I work on with {sector} teams a lot. Happy to share what we've seen work if it's useful." },
  { id: "t-book", name: "Ask for a call", body: "{firstName}, it sounds like there could be a fit. Would a 20-minute call next week be useful? Happy to work around your diary." },
  { id: "t-followup", name: "Gentle follow-up", body: "Hi {firstName}, just bumping this in case it got buried. No pressure either way." },
];

export function defaultSettings() {
  return {
    services: "",
    sectors: DEFAULT_SECTORS.map((s) => ({ ...s, keywords: [...s.keywords] })),
    targetTitles: [],
    targetLocations: [],
    excludeKeywords: [],
    templates: DEFAULT_TEMPLATES.map((t) => ({ ...t })),
    weeklyGoals: { connections: 50, conversations: 10, appointments: 3, followers: 100 },
  };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word / whole-phrase match, case-insensitive. "ai" matches "AI lead" but not "retail". */
export function hasKeyword(haystack, keyword) {
  const k = String(keyword).trim().toLowerCase();
  if (!k) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRe(k)}($|[^a-z0-9])`, "i").test(haystack);
}

export function leadText(lead) {
  return [lead.position, lead.headline, lead.company, lead.notes, (lead.tags ?? []).join(" ")].filter(Boolean).join(" • ").toLowerCase();
}

/**
 * Detect the lead's sector from their title, headline and company. A sector named in an
 * imported "Industry" column wins if it matches one of yours. Returns the sector name or "".
 */
export function detectSector(lead, sectors) {
  if (lead.sector) {
    const named = sectors.find((s) => s.name.toLowerCase() === String(lead.sector).toLowerCase());
    if (named) return named.name;
  }
  const text = leadText(lead) + " " + String(lead.sector ?? "").toLowerCase();
  let best = "";
  let bestHits = 0;
  for (const s of sectors) {
    const hits = s.keywords.filter((k) => hasKeyword(text, k)).length;
    // Ties go to the higher-priority sector, so a target sector is never shadowed by a non-target one.
    if (hits > bestHits || (hits > 0 && hits === bestHits && s.priority > (sectors.find((x) => x.name === best)?.priority ?? 0))) {
      best = s.name;
      bestHits = hits;
    }
  }
  return best || (lead.sector ? String(lead.sector) : "");
}

/**
 * Score a lead 0-100 against your ICP and explain why. Every point is traceable to a reason,
 * so you can see what to fix in your settings when a score looks wrong.
 */
export function scoreLead(lead, settings) {
  const reasons = [];
  const text = leadText(lead);
  const exclusion = (settings.excludeKeywords ?? []).find((k) => hasKeyword(text, k));
  if (exclusion) return { score: 0, tier: "excluded", reasons: [`Excluded: matches "${exclusion}"`] };

  let score = 0;
  const sector = (settings.sectors ?? []).find((s) => s.name === lead.sector);
  const sectorPts = { 3: 35, 2: 25, 1: 15 }[sector?.priority ?? 0] ?? 0;
  if (sectorPts) { score += sectorPts; reasons.push(`+${sectorPts} target sector: ${sector.name}`); }
  else if (lead.sector) reasons.push(`+0 sector not targeted: ${lead.sector}`);
  else reasons.push("+0 sector unknown");

  const titleText = [lead.position, lead.headline].filter(Boolean).join(" ").toLowerCase();
  const targetTitle = (settings.targetTitles ?? []).find((t) => hasKeyword(titleText, t));
  if (targetTitle) { score += 25; reasons.push(`+25 target title: ${targetTitle}`); }
  else {
    const senior = SENIORITY_KEYWORDS.find((k) => hasKeyword(titleText, k));
    if (senior) { score += 15; reasons.push(`+15 decision-maker: ${senior}`); }
  }

  const rels = RELATIONSHIPS.filter((r) => (lead.relationship ?? []).includes(r.key));
  if (rels.length) {
    const top = Math.max(...rels.map((r) => r.weight));
    const warmth = Math.min(20, top + 3 * (rels.filter((r) => r.weight > 0).length - 1));
    if (warmth) { score += warmth; reasons.push(`+${warmth} warmth: ${rels.map((r) => r.label.toLowerCase()).join(", ")}`); }
  }

  const loc = (settings.targetLocations ?? []).find((l) => hasKeyword(String(lead.location ?? "").toLowerCase(), l));
  if (loc) { score += 10; reasons.push(`+10 target location: ${loc}`); }

  const inbound = new Set(ACTIVITY_TYPES.filter((a) => a.inbound).map((a) => a.key));
  const since = Date.now() - 30 * 86400000;
  if ((lead.activities ?? []).some((a) => inbound.has(a.type) && new Date(a.at).getTime() >= since)) {
    score += 10;
    reasons.push("+10 engaged with you in the last 30 days");
  }

  score = Math.min(100, score);
  return { score, tier: score >= 70 ? "hot" : score >= 45 ? "warm" : "cool", reasons };
}

/** Re-derive sector (unless set by hand) and score. Pure: returns a new lead. */
export function enrichLead(lead, settings) {
  const sector = lead.sectorManual ? lead.sector : detectSector(lead, settings.sectors ?? []);
  const withSector = { ...lead, sector };
  const { score, tier, reasons } = scoreLead(withSector, settings);
  return { ...withSector, score, tier, scoreReasons: reasons };
}

export function fillTemplate(body, lead) {
  const vals = {
    firstName: lead.firstName || "there",
    lastName: lead.lastName || "",
    company: lead.company || "your company",
    position: lead.position || "your role",
    sector: lead.sector || "your sector",
  };
  return String(body).replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m));
}
