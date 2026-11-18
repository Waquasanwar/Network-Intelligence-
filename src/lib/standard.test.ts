import { describe, it, expect } from "vitest";
import { standard, proofsForOutside, gaps, PROOFS, isProofKey, type StandardInput } from "./standard";
import { standardInput, standardFor } from "./standard-for";

const none: StandardInput = { knownVia: null, screened: false, conversations: 0, vouches: 0, worked: 0, wouldWorkAgain: false, evidence: 0, freshness: "unknown" };
const full: StandardInput = { knownVia: { how: "introduced", by: "Grace Mensah" }, screened: true, conversations: 2, vouches: 2, worked: 1, workedBy: ["Waqas Anwar"], wouldWorkAgain: true, evidence: 3, freshness: "fresh", confirmedDaysAgo: 12 };

describe("the standard", () => {
  it("is six proofs, always in the same order", () => {
    expect(PROOFS).toHaveLength(6);
    expect(standard(none).proofs.map((p) => p.key)).toEqual(PROOFS.map((p) => p.key));
    expect(standard(full).proofs.map((p) => p.key)).toEqual(PROOFS.map((p) => p.key));
  });

  it("holds nothing for someone who arrived cold, and says what would earn each proof", () => {
    const s = standard(none);
    expect(s.held).toBe(0);
    expect(s.line).toBe("0 of 6 proofs");
    expect(s.proofs.every((p) => !p.held && p.next)).toBe(true);
  });

  it("holds all six for someone fully known, with no next step left", () => {
    const s = standard(full);
    expect(s.held).toBe(6);
    expect(s.proofs.every((p) => p.held && p.next === null)).toBe(true);
  });

  it("names the people involved for the team", () => {
    const facts = standard(full).proofs.map((p) => p.fact).join(" | ");
    expect(facts).toContain("Introduced by Grace Mensah");
    expect(facts).toContain("Waqas Anwar has delivered with them, and would again");
    expect(facts).toContain("Availability confirmed 12 days ago");
  });

  it("speaks to the person themselves in the second person", () => {
    const s = standard(full, "self");
    expect(s.proofs.find((p) => p.key === "known")!.fact).toBe("Grace Mensah introduced you");
    expect(s.proofs.find((p) => p.key === "vouched")!.fact).toBe("2 people here have put their name behind you");
    // Who delivered with them is the team's record; the person is told that it happened.
    expect(s.proofs.find((p) => p.key === "worked")!.fact).not.toContain("Waqas");
    expect(standard(none, "self").proofs.find((p) => p.key === "screened")!.next).toMatch(/screening/i);
  });

  it("tells an outsider the fact and never a name or a next step", () => {
    const s = standard(full, "outside");
    const text = JSON.stringify(s);
    expect(text).not.toContain("Grace");
    expect(text).not.toContain("Waqas");
    expect(s.proofs.every((p) => p.next === null)).toBe(true);
    expect(standard(none, "outside").proofs.every((p) => p.next === null)).toBe(true);
    expect(proofsForOutside(full)).toEqual(["Came through someone we know", "Screened in conversation", "Vouched for by 2", "Worked with first hand, and would again", "Delivery on record, seen first hand", "Availability confirmed recently"]);
    expect(proofsForOutside(none)).toEqual([]);
  });

  it("counts a reviewed conversation as screened, and says when a screening was accepted without being read", () => {
    expect(standard({ ...none, conversations: 1 }).proofs.find((p) => p.key === "screened")).toMatchObject({ held: true, fact: "1 conversation on record" });
    expect(standard({ ...none, screened: true }).proofs.find((p) => p.key === "screened")!.fact).toBe("Screening complete, read by a person");
    expect(standard({ ...none, screened: true, screeningRead: false }).proofs.find((p) => p.key === "screened")!.fact).toBe("Screening complete, accepted automatically");
    // The person and an outsider are told it is done, not how it was checked.
    expect(standard({ ...none, screened: true, screeningRead: false }, "self").proofs.find((p) => p.key === "screened")!.fact).toBe("Your screening is complete");
    expect(standard({ ...none, screened: true, screeningRead: false }, "outside").proofs.find((p) => p.key === "screened")!.fact).toBe("Screened in conversation");
  });

  it("keeps a vouch from inside the network apart from an outside reference", () => {
    expect(standard({ ...none, references: 2 }).proofs.find((p) => p.key === "vouched")).toMatchObject({ held: true, fact: "2 named references from outside" });
    expect(standard({ ...none, vouches: 1, references: 1 }).proofs.find((p) => p.key === "vouched")!.fact).toBe("1 person here has put their name behind them, plus 1 named reference from outside");
    expect(standard({ ...none, vouches: 1, references: 1 }, "outside").proofs.find((p) => p.key === "vouched")!.fact).toBe("Vouched for by 2");
  });

  it("lets the last proof lapse", () => {
    expect(standard({ ...full, freshness: "aging" }).proofs.find((p) => p.key === "current")).toMatchObject({ held: true, fact: "Availability confirmed 12 days ago, due a check soon" });
    expect(standard({ ...full, freshness: "stale" }).proofs.find((p) => p.key === "current")!.held).toBe(false);
    expect(standard({ ...full, freshness: "stale" }).held).toBe(5);
  });

  it("adds up where a network is thin", () => {
    expect(gaps([none, full, { ...full, vouches: 0 }])).toEqual({ known: 1, screened: 1, vouched: 2, worked: 1, delivered: 1, current: 1 });
  });

  it("recognises its own keys and nothing else", () => {
    expect(isProofKey("vouched")).toBe(true);
    expect(isProofKey("trusted")).toBe(false);
    expect(isProofKey(undefined)).toBe(false);
  });
});

describe("the standard from a stored person", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const base = { availabilityStatus: "AVAILABLE_NOW", availabilityConfirmedAt: new Date("2026-11-10T12:00:00Z"), nextCheckDate: new Date("2026-12-20T12:00:00Z"), screeningStatus: "NONE", screenedAt: null };

  it("treats an inbound arrival as cold until a person is on record", () => {
    const p = { ...base, relationships: [{ sourceType: "INBOUND", workedTogether: false, networkOwner: { name: "Waqas Anwar" } }], vouches: [], evidence: [], conversations: [] };
    expect(standardInput(p, now).knownVia).toBeNull();
    expect(standardFor(p, "internal", now).proofs.find((x) => x.key === "known")!.fact).toBe("Came to us directly");
  });

  it("reads an introduction, a working relationship, vouches, evidence and freshness", () => {
    const p = {
      ...base, screeningStatus: "APPROVED",
      relationships: [{ sourceType: "INTRODUCTION", introducedById: "p1", introducedBy: { firstName: "Grace", lastName: "Mensah" }, workedTogether: true, wouldWorkTogetherAgain: true, networkOwner: { name: "Waqas Anwar" } }],
      vouches: [{ wouldRecommend: true, voucherKind: "PERSON" }, { wouldRecommend: true, voucherKind: "EXTERNAL" }, { wouldRecommend: false, voucherKind: "USER" }],
      evidence: [{ evidenceType: "DELIVERY_OBSERVED", context: "Programme recovery" }, { evidenceType: "REFERENCE", context: "Screening: proudest piece of work (self-reported)" }, { evidenceType: "CAUTION", context: "x" }],
      conversations: [{ approvalStatus: "APPROVED", type: "CATCH_UP", approvedById: "u1" }, { approvalStatus: "DRAFT" }],
    };
    const i = standardInput(p, now);
    expect(i).toMatchObject({ knownVia: { how: "introduced", by: "Grace Mensah" }, screened: true, screeningRead: true, conversations: 1, vouches: 1, references: 1, worked: 1, workedBy: ["Waqas Anwar"], wouldWorkAgain: true, evidence: 1, freshness: "fresh", confirmedDaysAgo: 8 });
    expect(standardFor(p, "internal", now).held).toBe(6);
  });

  it("does not count what someone said about their own work as a witness, and spots an automatic acceptance", () => {
    const p = { ...base, screeningStatus: "APPROVED", relationships: [], vouches: [], evidence: [{ evidenceType: "REFERENCE", context: "Screening: proudest piece of work (self-reported)" }], conversations: [{ approvalStatus: "APPROVED", type: "SCREENING", approvedById: null }] };
    const i = standardInput(p, now);
    expect(i.evidence).toBe(0);
    expect(i.screeningRead).toBe(false);
  });

  it("never lets a caution change what any audience sees", () => {
    const clean = { ...base, relationships: [], vouches: [], evidence: [{ evidenceType: "DELIVERY_OBSERVED" }], conversations: [] };
    const cautioned = { ...clean, evidence: [{ evidenceType: "DELIVERY_OBSERVED" }, { evidenceType: "CAUTION" }] };
    for (const a of ["internal", "self", "outside"] as const) expect(standardFor(cautioned, a, now)).toEqual(standardFor(clean, a, now));
  });
});
