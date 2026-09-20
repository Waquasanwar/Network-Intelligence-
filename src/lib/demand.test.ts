import { describe, expect, it } from "vitest";
import { parseBrief, matchBrief, hardChecks, estimateFee, defaultFeeModel, defaultTerms, DEFAULT_RATE_CARD, rateBand, type BriefPerson } from "./demand";

const person = (over: Partial<BriefPerson> & { id: string }): BriefPerson => ({
  capabilities: [], sectors: [], seniority: null, engagementPreferences: [], primaryCity: null, primaryCountry: null, targetLocations: [], availabilityStatus: "AVAILABLE_NOW",
  availabilityConfirmedAt: new Date(), nextCheckDate: null, rateExpectation: null, salaryExpectation: null, relationships: [{ relationshipType: "WORKED_WITH", workedTogether: true, wouldWorkTogetherAgain: true, yearsKnown: 3 }],
  evidence: [], approvedConversations: 1, workRights: [], relocationInterest: false, ...over,
});

describe("parseBrief (co-pilot)", () => {
  it("reads an agency brief: 2 BAs already in Dubai with a visa, perm, banking", () => {
    const b = parseBrief("Agency looking for 2 BAs already in Dubai with visa, perm, banking, AED 30k per month");
    expect(b.roles).toContain("Business analyst");
    expect(b.headcount).toBe(2);
    expect(b.engagementRoute).toBe("PERMANENT");
    expect(b.locations[0]).toBe("Dubai");
    expect(b.mustBeLocal).toBe(true);
    expect(b.workRights).toMatch(/UAE/);
    expect(b.sectors).toContain("Banking");
    expect(b.budget?.currency).toBe("AED");
    expect(b.assumptions.length).toBeGreaterThan(2);
  });

  it("reads a client brief: perm PM in London with a salary", () => {
    const b = parseBrief("Client A wants a perm project manager in London, £95k, start in January");
    expect(b.roles[0]).toBe("Project manager");
    expect(b.engagementRoute).toBe("PERMANENT");
    expect(b.budget).toEqual({ kind: "SALARY", amount: 95000, currency: "GBP", max: null });
    expect(b.mustBeLocal).toBe(false);
    expect(b.startBy).toBe("January");
    expect(b.headcount).toBe(1);
  });

  it("reads 'BA or PM' as two role families and asks what it cannot infer", () => {
    const b = parseBrief("BA or PM");
    expect(b.roles).toEqual(["Business analyst", "Project manager"]);
    expect(b.engagementRoute).toBeNull();
    expect(b.questions.some((q) => /permanent, contract/i.test(q))).toBe(true);
    expect(b.questions.some((q) => /where/i.test(q))).toBe(true);
  });

  it("reads an Amana expert call with an hourly rate", () => {
    const b = parseBrief("Expert call: 2 hours on SAP S/4 go-live assurance for a utility, £600/hour, asap");
    expect(b.engagementRoute).toBe("ADVISORY");
    expect(b.capabilities).toContain("SAP");
    expect(b.budget?.kind).toBe("HOURLY");
    expect(b.budget?.amount).toBe(600);
    expect(b.startBy).toBe("ASAP");
    expect(b.sectors).toContain("Energy");
  });

  it("reads a fractional CISO with a day-rate range and duration", () => {
    const b = parseBrief("Fractional CISO 2 days a week for a UAE insurer, £1,200-1,500 per day, 6 months, no sponsorship");
    expect(b.engagementRoute).toBe("FRACTIONAL");
    expect(b.seniority).toBe("EXECUTIVE");
    expect(b.budget).toEqual({ kind: "DAY_RATE", amount: 1200, currency: "GBP", max: 1500 });
    expect(b.durationMonths).toBe(6);
    expect(b.workRights).toMatch(/no sponsorship/);
  });
});

describe("matchBrief", () => {
  const brief = parseBrief("2 BAs already in Dubai with visa, perm, banking");
  const inDubai = person({ id: "a", capabilities: ["Business analysis", "Banking change"], sectors: ["Banking"], primaryCity: "Dubai", primaryCountry: "UAE", engagementPreferences: ["PERMANENT"], workRights: ["UAE residence visa"] });
  const inLondonWouldMove = person({ id: "b", capabilities: ["Business analysis"], sectors: ["Banking"], primaryCity: "London", primaryCountry: "UK", targetLocations: ["Dubai"], engagementPreferences: ["PERMANENT"], workRights: ["UK citizen"] });
  const inDubaiNoRights = person({ id: "c", capabilities: ["Business analysis"], sectors: ["Insurance"], primaryCity: "Dubai", primaryCountry: "UAE", engagementPreferences: ["CONTRACT"] });

  it("tiers people by hard requirements without dropping anyone", () => {
    const out = matchBrief(brief, [inLondonWouldMove, inDubaiNoRights, inDubai]);
    expect(out.map((m) => m.match.personId)).toEqual(["a", "c", "b"]);
    expect(out[0].tier).toBe("meets");
    expect(out[1].tier).toBe("conversation");
    expect(out[2].tier).toBe("stretch");
  });

  it("explains each hard check", () => {
    const checks = hardChecks(brief, inDubaiNoRights);
    expect(checks.find((c) => c.label === "In Dubai")?.state).toBe("met");
    expect(checks.find((c) => c.label === "Work rights")?.state).toBe("unknown");
    expect(checks.find((c) => c.label === "Open to permanent")?.state).toBe("unknown");
  });
});

describe("commercials", () => {
  it("chooses the fee model from the route and who pays", () => {
    expect(defaultFeeModel("PERMANENT", "CLIENT")).toBe("PERM_PCT");
    expect(defaultFeeModel("PERMANENT", "AGENCY")).toBe("AGENCY_REFERRAL");
    expect(defaultFeeModel("CONTRACT", "AGENCY")).toBe("AGENCY_CONTRACT_SHARE");
    expect(defaultFeeModel("ADVISORY", "EXPERT_NETWORK")).toBe("EXPERT_HOURLY");
    expect(defaultFeeModel("SOW", "EXPERT_NETWORK")).toBe("SOW_SHARE");
  });

  it("estimates a direct perm fee as a % of salary, per head", () => {
    const brief = parseBrief("2 perm BAs in London, £80k");
    const fee = estimateFee(brief, defaultTerms(DEFAULT_RATE_CARD, "PERM_PCT"), DEFAULT_RATE_CARD);
    expect(fee.perHead).toBe(14400);
    expect(fee.ourTake).toBe(28800);
    expect(fee.basis).toMatch(/18% of £80,000 salary × 2 people/);
  });

  it("estimates a referral share of an agency's perm fee", () => {
    const brief = parseBrief("Agency needs a perm PM in Dubai, AED 360k");
    const fee = estimateFee(brief, defaultTerms(DEFAULT_RATE_CARD, "AGENCY_REFERRAL"), DEFAULT_RATE_CARD);
    // agency fee 20% of 360k = 72k; our share 35% = 25.2k
    expect(fee.gross).toBe(72000);
    expect(fee.ourTake).toBe(25200);
    expect(fee.currency).toBe("AED");
  });

  it("estimates a contract margin over the engagement and an expert call take", () => {
    const c = estimateFee(parseBrief("Contract SAP lead, £900/day, 6 months"), defaultTerms(DEFAULT_RATE_CARD, "CONTRACT_MARGIN"), DEFAULT_RATE_CARD);
    expect(c.gross).toBe(900 * 110);
    expect(c.ourTake).toBe(Math.round(900 * 110 * 0.12));
    const e = estimateFee(parseBrief("Expert call on SAP assurance, £600/hour"), defaultTerms(DEFAULT_RATE_CARD, "EXPERT_HOURLY"), DEFAULT_RATE_CARD, 3);
    expect(e.gross).toBe(1800);
    expect(e.ourTake).toBe(540);
  });

  it("says when it cannot estimate", () => {
    const fee = estimateFee(parseBrief("Perm BA in London"), defaultTerms(DEFAULT_RATE_CARD, "PERM_PCT"), DEFAULT_RATE_CARD);
    expect(fee.confident).toBe(false);
    expect(fee.ourTake).toBe(0);
  });

  it("bands rates for the portal", () => {
    expect(rateBand("£1,350/day")).toBe("£1,250–£1,500/day");
    expect(rateBand("£160k")).toBe("£150,000–£175,000");
    expect(rateBand("AED 4,200/day")).toBe("AED 4,000–AED 5,000/day");
    expect(rateBand(null)).toBeNull();
  });
});
