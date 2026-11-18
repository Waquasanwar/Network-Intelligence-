import { describe, it, expect } from "vitest";
import { framework, AREAS, CHECKS, MANUAL_KEYS, type FrameworkInput } from "./framework";
import { frameworkInput, frameworkFor, trustFromFramework } from "./framework-for";

const empty: FrameworkInput = { manual: {}, calls: 0, workRights: 0, knownVia: null, personalContact: false, yearsKnown: null, introducerTrusted: null, vouches: 0, references: 0, worked: 0, workedBy: [], wouldWorkAgain: false, evidence: 0, screened: false, conversations: 0, capabilities: 0, freshness: "unknown", confirmedDaysAgo: null, cautions: 0, referralConsent: null, privacyReviewedDaysAgo: null };
const signed = { by: "Waqas Anwar", at: "2026-11-01T10:00:00.000Z", note: "ACCA member 1234567" };
const full: FrameworkInput = { ...empty, manual: { email: signed, linkedin: signed, met: signed, personal: signed, qualifications: signed }, workRights: 2, knownVia: { how: "introduced", by: "Grace Mensah" }, personalContact: true, yearsKnown: 6, introducerTrusted: true, vouches: 2, references: 1, worked: 1, workedBy: ["Waqas Anwar"], wouldWorkAgain: true, evidence: 2, screened: true, screeningRead: true, capabilities: 4, freshness: "fresh", confirmedDaysAgo: 3, referralConsent: "yes", privacyReviewedDaysAgo: 10 };

describe("the framework", () => {
  it("is 22 checks in five areas, weighted to 100", () => {
    expect(AREAS).toHaveLength(5);
    expect(CHECKS).toHaveLength(22);
    expect(CHECKS.reduce((s, c) => s + c.weight, 0)).toBe(100);
    expect(new Set(CHECKS.map((c) => c.key)).size).toBe(22);
  });

  it("only five checks need a person on the team, and every other one is read from the record", () => {
    expect(MANUAL_KEYS).toEqual(["email", "linkedin", "met", "personal", "qualifications"]);
    expect(CHECKS.filter((c) => c.how === "you").map((c) => c.key).sort()).toEqual(["email", "linkedin", "qualifications"]);
  });

  it("scores nothing for someone nobody knows, and holds only the clean-record check", () => {
    const f = framework(empty);
    expect(f.held).toBe(1);
    expect(f.score).toBe(3);
    expect(f.areas.find((a) => a.key === "reliability")!.checks.find((c) => c.key === "noCaution")!.held).toBe(true);
  });

  it("scores 100 when every check is held", () => {
    const f = framework(full);
    expect(f.score).toBe(100);
    expect(f.held).toBe(22);
    expect(f.band).toBe("highly trusted");
  });

  it("says who confirmed a manual check, when, and what they looked at", () => {
    const q = framework(full).areas.flatMap((a) => a.checks).find((c) => c.key === "qualifications")!;
    expect(q.fact).toBe("Checked by Waqas Anwar · 1 Nov 2026 · ACCA member 1234567");
    expect(q.signed).toEqual(signed);
    expect(q.canSign).toBe(true);
  });

  it("counts a real call or meeting as met, without anyone ticking it", () => {
    const met = framework({ ...empty, calls: 2 }).areas[0].checks.find((c) => c.key === "met")!;
    expect(met).toMatchObject({ held: true, fact: "2 calls or meetings on record" });
  });

  it("trusts an introducer only once they are screened and vouched for, and the team always", () => {
    const intro = (i: Partial<FrameworkInput>) => framework({ ...empty, ...i }).areas[1].checks.find((c) => c.key === "introducer")!.held;
    expect(intro({ knownVia: { how: "introduced", by: "Ana" }, introducerTrusted: false })).toBe(false);
    expect(intro({ knownVia: { how: "introduced", by: "Ana" }, introducerTrusted: true })).toBe(true);
    expect(intro({ knownVia: { how: "contact", by: "Waqas Anwar" }, introducerTrusted: null })).toBe(true);
    expect(intro({ knownVia: null, introducerTrusted: null })).toBe(false);
  });

  it("marks a screening nobody read", () => {
    const c = framework({ ...empty, screened: true, screeningRead: false }).areas[3].checks;
    expect(c.find((x) => x.key === "screened")!.held).toBe(true);
    expect(c.find((x) => x.key === "screeningRead")).toMatchObject({ held: false, fact: "Accepted automatically, not read" });
  });

  it("needs a witness before expertise counts", () => {
    const e = (i: Partial<FrameworkInput>) => framework({ ...empty, ...i }).areas[3].checks.find((c) => c.key === "expertise")!.held;
    expect(e({ capabilities: 3 })).toBe(false);
    expect(e({ capabilities: 3, references: 1 })).toBe(true);
  });

  it("never lets a person see that a caution exists", () => {
    const withCaution = { ...full, cautions: 1 };
    expect(framework(withCaution).score).toBe(97);
    expect(framework(withCaution, "self").score).toBe(100);
    expect(framework(withCaution, "self")).toEqual(framework(full, "self"));
  });
});

describe("the framework from a stored person", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const base = { availabilityStatus: "AVAILABLE_NOW", availabilityConfirmedAt: new Date("2026-11-10T12:00:00Z"), nextCheckDate: new Date("2026-12-20T12:00:00Z"), screeningStatus: "APPROVED", screenedAt: new Date("2026-11-01T12:00:00Z") };

  it("reads manual checks, ignoring anything malformed or unknown", () => {
    const i = frameworkInput({ ...base, checks: { linkedin: { by: "Waqas Anwar", at: "2026-11-02T09:00:00Z" }, made_up: { by: "x", at: "y" }, email: "yes" } }, now);
    expect(Object.keys(i.manual)).toEqual(["linkedin"]);
  });

  it("knows a personal contact, years known and a trusted introducer", () => {
    const i = frameworkInput({
      ...base, capabilities: ["Programme director"], workRights: ["UK"], referralConsent: "yes", privacy: { reviewedAt: "2026-11-08T12:00:00Z" },
      relationships: [{ sourceType: "PERSONAL_NETWORK", yearsKnown: 5, workedTogether: false, networkOwner: { name: "Waqas Anwar" } }, { sourceType: "INTRODUCTION", introducedById: "p1", introducedBy: { firstName: "Grace", lastName: "Mensah", screeningStatus: "APPROVED", vouches: [{ wouldRecommend: true }] } }],
      conversations: [{ approvalStatus: "APPROVED", type: "INTRO_CALL" }, { approvalStatus: "APPROVED", type: "SCREENING", approvedById: "u1" }],
    }, now);
    expect(i).toMatchObject({ personalContact: true, yearsKnown: 5, introducerTrusted: true, calls: 1, workRights: 1, capabilities: 1, referralConsent: "yes", privacyReviewedDaysAgo: 10 });
  });

  it("gives every screen the same shape it read before", () => {
    const t = trustFromFramework(frameworkFor({ ...base }, "internal", now));
    expect(t.breakdown.map((b) => b.label)).toEqual(["Identity", "Relationship", "Track record", "Competence", "Reliability"]);
    expect(t.breakdown.reduce((s, b) => s + b.points, 0)).toBe(t.score);
  });
});
