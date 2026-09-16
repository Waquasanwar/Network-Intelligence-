import type { AvailabilityStatus, EngagementRoute, EvidenceType, RelationshipType, Seniority } from "@prisma/client";
import { assessFreshness } from "./availability";

/**
 * Intelligent matching (spec §10).
 *
 * The engine retrieves and explains. It scores fit *for one opportunity* across named
 * dimensions and lists uncertainty. It never produces a global ranking of people, never
 * labels a person good/bad, never auto-rejects, and never infers protected characteristics.
 * The human decision (Recommend / Possible / Need more evidence / Not for this requirement)
 * is stored separately and is the only thing that authorises an introduction.
 */

export type MatchPerson = {
  id: string;
  capabilities: string[];
  sectors: string[];
  seniority: Seniority | null;
  engagementPreferences: EngagementRoute[];
  primaryCity: string | null;
  primaryCountry: string | null;
  targetLocations: string[];
  availabilityStatus: AvailabilityStatus;
  availabilityConfirmedAt: Date | null;
  nextCheckDate?: Date | null;
  rateExpectation?: string | null;
  salaryExpectation?: string | null;
  relationships: { relationshipType: RelationshipType; workedTogether: boolean; wouldWorkTogetherAgain: boolean | null; yearsKnown: number | null }[];
  evidence: { evidenceType: EvidenceType; confidence: number; context: string }[];
  approvedConversations: number;
};

export type MatchOpportunity = {
  requiredCapabilities: string[];
  preferredCapabilities: string[];
  sectors: string[];
  seniority: Seniority | null;
  engagementRoute: EngagementRoute;
  location: string | null;
  budget?: number | null;
};

export type MatchResult = {
  personId: string;
  fitScore: number;
  fitExplanation: string;
  evidenceStrength: number;
  relationshipStrength: number;
  availabilityFit: number;
  commercialFit: number;
  uncertainty: string[];
  dimensions: { name: string; score: number; note: string }[];
};

const SENIORITY_ORDER: Seniority[] = ["ASSOCIATE", "MANAGER", "SENIOR_MANAGER", "DIRECTOR", "EXECUTIVE", "C_LEVEL"];

const norm = (s: string) => s.trim().toLowerCase();

function tokenOverlap(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(/[\s/&-]+/).filter((t) => t.length > 2));
  const tb = nb.split(/[\s/&-]+/).filter((t) => t.length > 2);
  const hits = tb.filter((t) => ta.has(t)).length;
  return hits > 0 && hits >= Math.min(ta.size, tb.length) * 0.6;
}

export function capabilityCoverage(required: string[], have: string[]): { covered: string[]; missing: string[] } {
  const covered: string[] = [];
  const missing: string[] = [];
  for (const req of required) {
    if (have.some((h) => tokenOverlap(h, req))) covered.push(req);
    else missing.push(req);
  }
  return { covered, missing };
}

function locationFit(opp: MatchOpportunity, p: MatchPerson): { score: number; note: string } {
  if (!opp.location) return { score: 70, note: "Location not specified on the opportunity." };
  const loc = norm(opp.location);
  const remote = /remote|anywhere|hybrid/.test(loc);
  if (remote) return { score: 90, note: "Remote-friendly opportunity." };
  const here = [p.primaryCity, p.primaryCountry].filter(Boolean).map((s) => norm(s as string));
  if (here.some((h) => loc.includes(h) || h.includes(loc))) return { score: 100, note: `Based in ${p.primaryCity ?? p.primaryCountry}.` };
  if (p.targetLocations.some((t) => tokenOverlap(t, opp.location as string)))
    return { score: 75, note: `Has expressed interest in ${opp.location}; mobility to be confirmed.` };
  return { score: 25, note: `Based in ${p.primaryCity ?? p.primaryCountry ?? "an unknown location"}; ${opp.location} not listed as a target.` };
}

function availabilityFit(opp: MatchOpportunity, p: MatchPerson, now: Date): { score: number; note: string; uncertain?: string } {
  const freshness = assessFreshness(
    { availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate ?? null },
    now,
  );
  const routeOk =
    p.engagementPreferences.length === 0 || p.engagementPreferences.includes(opp.engagementRoute);
  let base: number;
  switch (p.availabilityStatus) {
    case "AVAILABLE_NOW":
      base = 100; break;
    case "FINISHING_ENGAGEMENT_SOON":
    case "OPEN_TO_CONVERSATIONS":
      base = 85; break;
    case "QUIETLY_EXPLORING":
    case "FRACTIONAL_AVAILABILITY":
      base = 75; break;
    case "RIGHT_OPPORTUNITY_ONLY":
      base = 60; break;
    case "SOW_ONLY":
      base = opp.engagementRoute === "SOW" ? 90 : 30; break;
    case "PERMANENT_ONLY":
      base = opp.engagementRoute === "PERMANENT" ? 90 : 25; break;
    case "CONTRACT_ONLY":
      base = ["CONTRACT", "INTERIM"].includes(opp.engagementRoute) ? 90 : 25; break;
    case "HAPPY_WHERE_I_AM":
    case "NOT_LOOKING_KEEP_IN_TOUCH":
      base = 20; break;
    case "UNAVAILABLE_UNTIL":
    case "TAKING_A_BREAK":
      base = 15; break;
    default:
      base = 40;
  }
  if (!routeOk) base = Math.round(base * 0.55);
  let uncertain: string | undefined;
  if (freshness === "stale" || freshness === "unknown") {
    base = Math.round(base * 0.7);
    uncertain = "Availability has not been confirmed recently — re-check before recommending.";
  }
  const note = `${routeOk ? "Engagement route is consistent with stated preferences" : "Stated preferences do not include this route"}; status ${freshness}.`;
  return { score: base, note, uncertain };
}

function evidenceStrength(opp: MatchOpportunity, p: MatchPerson): { score: number; note: string; uncertain?: string } {
  const positives = p.evidence.filter((e) => e.evidenceType !== "CAUTION");
  const cautions = p.evidence.filter((e) => e.evidenceType === "CAUTION");
  if (positives.length === 0) {
    return { score: 10, note: "No observed delivery evidence recorded yet.", uncertain: "No one in the trusted network has recorded seeing them deliver." };
  }
  const relevant = positives.filter((e) =>
    [...opp.requiredCapabilities, ...opp.preferredCapabilities, ...opp.sectors].some((c) => tokenOverlap(e.context, c)),
  );
  const avgConf = positives.reduce((a, e) => a + e.confidence, 0) / positives.length;
  let score = Math.min(100, 30 + positives.length * 12 + relevant.length * 15) * (avgConf / 100) + 10;
  score = Math.round(Math.min(100, score));
  let note = `${positives.length} piece${positives.length === 1 ? "" : "s"} of evidence, ${relevant.length} directly relevant to this requirement.`;
  let uncertain: string | undefined;
  if (cautions.length) {
    score = Math.round(score * 0.8);
    note += ` ${cautions.length} caution noted.`;
    uncertain = "A caution has been recorded — read it before positioning.";
  } else if (relevant.length === 0) {
    uncertain = "Evidence exists but none is specific to this requirement.";
  }
  return { score, note, uncertain };
}

function relationshipStrength(p: MatchPerson): { score: number; note: string; uncertain?: string } {
  if (p.relationships.length === 0) return { score: 5, note: "No relationship provenance recorded.", uncertain: "We do not have a recorded relationship path to this person." };
  let score = 30;
  const worked = p.relationships.some((r) => r.workedTogether || r.relationshipType === "WORKED_WITH" || r.relationshipType === "MANAGED");
  const again = p.relationships.some((r) => r.wouldWorkTogetherAgain === true);
  const wouldNot = p.relationships.some((r) => r.wouldWorkTogetherAgain === false);
  const years = Math.max(0, ...p.relationships.map((r) => r.yearsKnown ?? 0));
  if (worked) score += 30;
  if (again) score += 25;
  if (wouldNot) score -= 30;
  score += Math.min(15, years * 3);
  score += Math.min(10, p.approvedConversations * 5);
  const parts: string[] = [];
  if (worked) parts.push("someone in the network has worked with them directly");
  if (again) parts.push("would work with them again");
  if (years) parts.push(`known for ${years} year${years === 1 ? "" : "s"}`);
  if (p.approvedConversations) parts.push(`${p.approvedConversations} approved conversation${p.approvedConversations === 1 ? "" : "s"}`);
  return {
    score: Math.max(0, Math.min(100, score)),
    note: parts.length ? parts.join("; ") + "." : "Known, but not through direct work.",
    uncertain: wouldNot ? "A contact has said they would not work with this person again." : undefined,
  };
}

function seniorityFit(opp: MatchOpportunity, p: MatchPerson): { score: number; note: string } {
  if (!opp.seniority || !p.seniority) return { score: 70, note: "Seniority not compared." };
  const diff = SENIORITY_ORDER.indexOf(p.seniority) - SENIORITY_ORDER.indexOf(opp.seniority);
  if (diff === 0) return { score: 100, note: "Seniority aligns." };
  if (diff === 1) return { score: 80, note: "Slightly more senior than required." };
  if (diff === -1) return { score: 65, note: "Slightly less senior than required." };
  return { score: 35, note: diff > 0 ? "Considerably more senior than required." : "Considerably less senior than required." };
}

function commercialFit(opp: MatchOpportunity, p: MatchPerson): { score: number; note: string; uncertain?: string } {
  const stated = opp.engagementRoute === "PERMANENT" ? p.salaryExpectation : p.rateExpectation;
  if (!stated) return { score: 60, note: "No rate or salary expectation recorded.", uncertain: "Commercial expectations have not been discussed." };
  if (!opp.budget) return { score: 70, note: `Expectation recorded (${stated}); opportunity budget not set.` };
  const n = Number(String(stated).replace(/[^0-9.]/g, ""));
  if (!n) return { score: 65, note: `Expectation recorded (${stated}).` };
  const ratio = n / opp.budget;
  if (ratio <= 1) return { score: 100, note: "Stated expectation within budget." };
  if (ratio <= 1.15) return { score: 75, note: "Stated expectation slightly above budget." };
  return { score: 40, note: "Stated expectation materially above budget.", uncertain: "Commercial gap to close." };
}

export function scoreMatch(opp: MatchOpportunity, p: MatchPerson, now = new Date()): MatchResult {
  const dims: MatchResult["dimensions"] = [];
  const uncertainty: string[] = [];

  // Required capability
  const req = capabilityCoverage(opp.requiredCapabilities, p.capabilities);
  const reqScore = opp.requiredCapabilities.length ? Math.round((req.covered.length / opp.requiredCapabilities.length) * 100) : 70;
  dims.push({
    name: "Required capability",
    score: reqScore,
    note: opp.requiredCapabilities.length
      ? `Covers ${req.covered.length} of ${opp.requiredCapabilities.length}${req.missing.length ? `; missing: ${req.missing.join(", ")}` : ""}.`
      : "No required capabilities stated.",
  });
  if (req.missing.length) uncertainty.push(`Not yet evidenced for: ${req.missing.join(", ")}.`);

  const pref = capabilityCoverage(opp.preferredCapabilities, p.capabilities);
  const prefScore = opp.preferredCapabilities.length ? Math.round((pref.covered.length / opp.preferredCapabilities.length) * 100) : 60;
  dims.push({ name: "Preferred capability", score: prefScore, note: opp.preferredCapabilities.length ? `Covers ${pref.covered.length} of ${opp.preferredCapabilities.length}.` : "None stated." });

  const ev = evidenceStrength(opp, p);
  dims.push({ name: "Observed delivery evidence", score: ev.score, note: ev.note });
  if (ev.uncertain) uncertainty.push(ev.uncertain);

  const rel = relationshipStrength(p);
  dims.push({ name: "Relationship provenance", score: rel.score, note: rel.note });
  if (rel.uncertain) uncertainty.push(rel.uncertain);

  const convScore = Math.min(100, p.approvedConversations * 40 + 10);
  dims.push({ name: "Conversation completeness", score: convScore, note: p.approvedConversations ? `${p.approvedConversations} approved conversation summar${p.approvedConversations === 1 ? "y" : "ies"}.` : "No approved conversation yet." });
  if (!p.approvedConversations) uncertainty.push("We have not had an approved conversation with them yet.");

  const sectorHits = opp.sectors.filter((s) => p.sectors.some((ps) => tokenOverlap(ps, s)));
  const sectorScore = opp.sectors.length ? Math.round((sectorHits.length / opp.sectors.length) * 100) : 70;
  dims.push({ name: "Industry relevance", score: sectorScore, note: opp.sectors.length ? `${sectorHits.length} of ${opp.sectors.length} sectors.` : "No sector stated." });

  const loc = locationFit(opp, p);
  dims.push({ name: "Location / mobility", score: loc.score, note: loc.note });

  const av = availabilityFit(opp, p, now);
  dims.push({ name: "Availability & engagement preference", score: av.score, note: av.note });
  if (av.uncertain) uncertainty.push(av.uncertain);

  const sen = seniorityFit(opp, p);
  dims.push({ name: "Seniority", score: sen.score, note: sen.note });

  const com = commercialFit(opp, p);
  dims.push({ name: "Commercial fit", score: com.score, note: com.note });
  if (com.uncertain) uncertainty.push(com.uncertain);

  // Weighted fit — capability and evidence dominate; relationship and availability matter; the rest refine.
  const weights: Record<string, number> = {
    "Required capability": 0.25,
    "Preferred capability": 0.05,
    "Observed delivery evidence": 0.18,
    "Relationship provenance": 0.14,
    "Conversation completeness": 0.06,
    "Industry relevance": 0.07,
    "Location / mobility": 0.08,
    "Availability & engagement preference": 0.1,
    Seniority: 0.04,
    "Commercial fit": 0.03,
  };
  const fitScore = Math.round(dims.reduce((acc, d) => acc + d.score * (weights[d.name] ?? 0), 0));

  const strongest = [...dims].sort((a, b) => b.score - a.score).slice(0, 2);
  const weakest = [...dims].sort((a, b) => a.score - b.score)[0];
  const fitExplanation =
    `Strongest on ${strongest.map((d) => d.name.toLowerCase()).join(" and ")}. ` +
    `${req.covered.length ? `Covers ${req.covered.join(", ")}. ` : ""}` +
    `${rel.note} ${ev.note} ` +
    `Weakest dimension: ${weakest.name.toLowerCase()} — ${weakest.note}`;

  return {
    personId: p.id,
    fitScore,
    fitExplanation: fitExplanation.trim(),
    evidenceStrength: ev.score,
    relationshipStrength: rel.score,
    availabilityFit: av.score,
    commercialFit: com.score,
    uncertainty,
    dimensions: dims,
  };
}

/**
 * Retrieve candidates worth a human look for one opportunity. Returns results ordered by
 * fit *for this opportunity only* and capped — this is retrieval, not a ranking of people.
 */
export function retrieveMatches(opp: MatchOpportunity, people: MatchPerson[], limit = 12, now = new Date()): MatchResult[] {
  return people
    .map((p) => scoreMatch(opp, p, now))
    .filter((m) => m.fitScore >= 25)
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, limit);
}
