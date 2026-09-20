import { describe, expect, it } from "vitest";
import { trustScore, trustBand } from "./trust";
import { screeningToResult, SCREENING_SCRIPT, SCREENING_MINUTES } from "./screening";
import { fitProfile, parseFitTraits, fitChecks, fitHighlights } from "./fit";

describe("trustScore", () => {
  it("is zero and unknown for someone nobody has vouched for or worked with", () => {
    const t = trustScore({ vouches: [], workedWith: 0, wouldWorkAgain: 0, evidence: 0, cautions: 0, approvedConversations: 0, screened: false, freshness: "unknown" });
    expect(t.score).toBe(0);
    expect(t.band).toBe("unknown");
    expect(t.vouchedBy).toBe(0);
  });

  it("rises with each person who vouches, capped, and counts only positive vouches", () => {
    const base = { workedWith: 0, wouldWorkAgain: 0, evidence: 0, cautions: 0, approvedConversations: 0, screened: false, freshness: "unknown" as const };
    expect(trustScore({ ...base, vouches: [{ wouldRecommend: true }] }).score).toBe(9);
    expect(trustScore({ ...base, vouches: [{ wouldRecommend: true }, { wouldRecommend: false }] }).vouchedBy).toBe(1);
    expect(trustScore({ ...base, vouches: Array(10).fill({ wouldRecommend: true }) }).score).toBe(35);
  });

  it("reaches highly trusted with vouches, direct work, evidence, screening and a fresh status", () => {
    const t = trustScore({ vouches: Array(4).fill({ wouldRecommend: true }), workedWith: 2, wouldWorkAgain: 1, evidence: 3, cautions: 0, approvedConversations: 2, screened: true, freshness: "fresh" });
    expect(t.score).toBe(100);
    expect(t.band).toBe("highly trusted");
    expect(t.breakdown.find((b) => b.label === "Vouched for")?.note).toMatch(/4 people/);
  });

  it("lowers the score for a caution and says why", () => {
    const t = trustScore({ vouches: [{ wouldRecommend: true }, { wouldRecommend: true }], workedWith: 1, wouldWorkAgain: 0, evidence: 1, cautions: 1, approvedConversations: 1, screened: false, freshness: "aging" });
    expect(t.score).toBe(18 + 10 + 7 + 5 + 2 - 8);
    expect(t.breakdown.find((b) => b.label === "Cautions")?.note).toMatch(/Read before positioning/);
  });

  it("counts external recommendations at a lower weight", () => {
    const base = { workedWith: 0, wouldWorkAgain: 0, evidence: 0, cautions: 0, approvedConversations: 0, screened: false, freshness: "unknown" as const };
    const t = trustScore({ ...base, vouches: [{ wouldRecommend: true }, { wouldRecommend: true, external: true }, { wouldRecommend: true, external: true }] });
    expect(t.score).toBe(9 + 8);
    expect(t.vouchedBy).toBe(3);
    expect(t.breakdown[0].note).toMatch(/plus 2 external recommendations/);
  });

  it("bands consistently", () => {
    expect(trustBand(5)).toBe("unknown"); expect(trustBand(20)).toBe("emerging"); expect(trustBand(50)).toBe("known"); expect(trustBand(70)).toBe("trusted"); expect(trustBand(85)).toBe("highly trusted");
  });
});

describe("screening", () => {
  it("is a 25 to 30 minute script", () => {
    expect(SCREENING_MINUTES).toBeGreaterThanOrEqual(25);
    expect(SCREENING_MINUTES).toBeLessThanOrEqual(30);
    expect(SCREENING_SCRIPT.flatMap((s) => s.questions).some((q) => q.key === "workRights")).toBe(true);
  });

  it("turns answers into a profile, a summary and referrals", () => {
    const r = screeningToResult({
      headline: "Programme director who stabilises troubled transformations", currentRole: "Programme Director at a UK bank, London", proudest: "Took a red core banking programme to amber in a quarter.",
      capabilities: ["Programme director", "Turnaround"], sectors: "Banking; Insurance", seniority: "DIRECTOR", avoid: ["Greenfield builds"],
      status: "FINISHING_ENGAGEMENT_SOON", routes: ["CONTRACT", "SOW"], noticePeriod: "End of next month",
      location: "London, UK", targetLocations: ["Dubai"], workRights: ["Right to work in UK"], relocation: "Yes, family would follow",
      rate: "£1,350/day", constraints: ["No greenfield"], workingStyle: "Direct. Best in recovery situations.",
      knows: [{ name: "Ben Hughes", context: "Ran recovery for me on the insurance programme" }], referralConsent: "yes", contactPreference: "Call, check in after the programme ends",
      "attr:assertiveness": "5", "attr:political": "4", "attr:commercial": "3", pushback: "Told the CIO the SI plan was fiction; re-baselined in front of the board.",
    });
    expect(r.attributes).toEqual({ assertiveness: 5, political: 4, commercial: 3 });
    expect(r.attitudeStory).toMatch(/CIO/);
    expect(r.summary.workingCharacteristics.some((w) => /Assertiveness: holds the line/.test(w))).toBe(true);
    expect(r.profile.primaryCity).toBe("London");
    expect(r.profile.primaryCountry).toBe("UK");
    expect(r.profile.rateExpectation).toBe("£1,350/day");
    expect(r.profile.salaryExpectation).toBeNull();
    expect(r.profile.engagementPreferences).toEqual(["CONTRACT", "SOW"]);
    expect(r.profile.availabilityStatus).toBe("FINISHING_ENGAGEMENT_SOON");
    expect(r.profile.relocationInterest).toBe(true);
    expect(r.profile.referralConsent).toBe("yes");
    expect(r.referrals).toHaveLength(1);
    expect(r.evidenceCandidate).toMatch(/red core banking/);
    expect(r.completeness).toBe(100);
    expect(r.summary.summary).toMatch(/Based in London, UK, open to Dubai/);
    expect(r.summary.suggestedAvailabilityStatus).toBe("FINISHING_ENGAGEMENT_SOON");
  });

  it("reads a salary and lists what was not covered", () => {
    const r = screeningToResult({ headline: "Head of AI", capabilities: ["AI"], status: "QUIETLY_EXPLORING", location: "Dubai, UAE", referralConsent: "ask", rate: "AED 480k" });
    expect(r.profile.salaryExpectation).toBe("AED 480k");
    expect(r.profile.rateExpectation).toBeNull();
    expect(r.completeness).toBeLessThan(100);
    expect(r.missing).toContain("Who do you know that you would genuinely put your name behind");
    expect(r.summary.unresolvedQuestions.length).toBeGreaterThan(0);
  });
});

describe("fit profile", () => {
  it("combines self-assessment with what vouchers observed, peers weighted higher", () => {
    const rows = fitProfile({ political: 3, assertiveness: 5 }, [{ political: 5 }, { political: 4 }]);
    const pol = rows.find((r) => r.key === "political")!;
    expect(pol.self).toBe(3); expect(pol.peers).toBe(4.5); expect(pol.peerCount).toBe(2); expect(pol.combined).toBe(4.1);
    expect(rows.find((r) => r.key === "assertiveness")!.combined).toBe(5);
    expect(rows.find((r) => r.key === "pace")!.combined).toBeNull();
  });

  it("reads the traits a brief asks for and labels the fit without excluding", () => {
    const traits = parseFitTraits("Needs someone politically astute and commercially aware who can push back on the SI");
    expect(traits).toEqual(["assertiveness", "political", "commercial"]);
    const checks = fitChecks(traits, fitProfile({ political: 3, assertiveness: 5 }, [{ political: 5 }, { political: 4 }]));
    expect(checks.map((c) => c.state)).toEqual(["strong", "strong", "unknown"]);
    expect(fitHighlights(fitProfile({ political: 3, assertiveness: 5 }, [{ political: 5 }, { political: 4 }]))).toEqual(["assertiveness", "political awareness"]);
  });
});
