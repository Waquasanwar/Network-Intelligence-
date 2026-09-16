import { describe, it, expect } from "vitest";
import { scoreMatch, retrieveMatches, capabilityCoverage, type MatchPerson, type MatchOpportunity } from "./matching";

const now = new Date("2026-09-16T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

const base: MatchPerson = {
  id: "p1",
  capabilities: ["Programme director", "Transformation", "Systems integrator challenge"],
  sectors: ["Banking"],
  seniority: "DIRECTOR",
  engagementPreferences: ["SOW", "INTERIM"],
  primaryCity: "London",
  primaryCountry: "UK",
  targetLocations: ["Dubai"],
  availabilityStatus: "FINISHING_ENGAGEMENT_SOON",
  availabilityConfirmedAt: daysAgo(5),
  rateExpectation: "£1,350/day",
  relationships: [{ relationshipType: "WORKED_WITH", workedTogether: true, wouldWorkTogetherAgain: true, yearsKnown: 6 }],
  evidence: [{ evidenceType: "DELIVERY_OBSERVED", confidence: 95, context: "Transformation programme recovery, banking" }],
  approvedConversations: 2,
};

const opp: MatchOpportunity = {
  requiredCapabilities: ["Programme director", "Systems integrator challenge"],
  preferredCapabilities: ["PMO"],
  sectors: ["Banking"],
  seniority: "DIRECTOR",
  engagementRoute: "SOW",
  location: "London (hybrid)",
  budget: 1400,
};

describe("capabilityCoverage", () => {
  it("matches case-insensitively and by token overlap", () => {
    const r = capabilityCoverage(["programme director", "Cyber Security"], ["Programme Director", "cyber"]);
    expect(r.covered).toEqual(["programme director", "Cyber Security"]);
    expect(r.missing).toEqual([]);
  });
  it("reports missing capabilities", () => {
    expect(capabilityCoverage(["SAP"], ["Salesforce"]).missing).toEqual(["SAP"]);
  });
});

describe("scoreMatch", () => {
  it("scores a strong, evidenced, known person highly and explains why", () => {
    const m = scoreMatch(opp, base, now);
    expect(m.fitScore).toBeGreaterThan(75);
    expect(m.evidenceStrength).toBeGreaterThan(50);
    expect(m.relationshipStrength).toBeGreaterThan(70);
    expect(m.fitExplanation).toContain("worked with them directly");
    expect(m.dimensions.map((d) => d.name)).toContain("Relationship provenance");
  });

  it("flags uncertainty instead of rejecting when evidence is missing", () => {
    const m = scoreMatch(opp, { ...base, evidence: [], approvedConversations: 0 }, now);
    expect(m.uncertainty.join(" ")).toMatch(/No one in the trusted network has recorded seeing them deliver/);
    expect(m.uncertainty.join(" ")).toMatch(/not had an approved conversation/);
    expect(m.fitScore).toBeGreaterThan(0); // never a hard reject
  });

  it("discounts stale availability and says so", () => {
    const fresh = scoreMatch(opp, base, now);
    const stale = scoreMatch(opp, { ...base, availabilityConfirmedAt: daysAgo(120) }, now);
    expect(stale.availabilityFit).toBeLessThan(fresh.availabilityFit);
    expect(stale.uncertainty.join(" ")).toMatch(/not been confirmed recently/);
  });

  it("surfaces a recorded caution and a 'would not work again' signal", () => {
    const m = scoreMatch(opp, {
      ...base,
      evidence: [...base.evidence, { evidenceType: "CAUTION", confidence: 85, context: "Stakeholder handling" }],
      relationships: [{ relationshipType: "WORKED_WITH", workedTogether: true, wouldWorkTogetherAgain: false, yearsKnown: 3 }],
    }, now);
    expect(m.uncertainty.join(" ")).toMatch(/caution/i);
    expect(m.uncertainty.join(" ")).toMatch(/would not work with this person again/);
    expect(m.relationshipStrength).toBeLessThan(scoreMatch(opp, base, now).relationshipStrength);
  });

  it("penalises route mismatch (permanent-only person for an SOW)", () => {
    const m = scoreMatch(opp, { ...base, availabilityStatus: "PERMANENT_ONLY", engagementPreferences: ["PERMANENT"] }, now);
    expect(m.availabilityFit).toBeLessThan(30);
  });

  it("treats target locations as partial location fit", () => {
    const dubai = scoreMatch({ ...opp, location: "Dubai" }, base, now);
    const loc = dubai.dimensions.find((d) => d.name === "Location / mobility")!;
    expect(loc.score).toBe(75);
    expect(loc.note).toMatch(/mobility to be confirmed/);
  });

  it("does not use protected characteristics: only declared dimensions are scored", () => {
    const m = scoreMatch(opp, base, now);
    const names = m.dimensions.map((d) => d.name.toLowerCase()).join(" ");
    expect(names).not.toMatch(/\b(age|gender|ethnic|ethnicity|religion|nationality|health|family)\b/);
  });
});

describe("retrieveMatches", () => {
  it("returns per-opportunity retrieval, capped and filtered, without global ranking side effects", () => {
    const people: MatchPerson[] = [
      base,
      { ...base, id: "p2", capabilities: ["Data engineering"], sectors: ["Retail"], evidence: [], relationships: [], approvedConversations: 0, availabilityStatus: "HAPPY_WHERE_I_AM" },
      { ...base, id: "p3", capabilities: ["Programme director"], evidence: [] },
    ];
    const r = retrieveMatches(opp, people, 2, now);
    expect(r.length).toBeLessThanOrEqual(2);
    expect(r[0].personId).toBe("p1");
    expect(r.every((m) => m.fitScore >= 25)).toBe(true);
  });
});
