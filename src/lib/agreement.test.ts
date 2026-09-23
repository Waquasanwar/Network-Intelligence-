import { describe, it, expect } from "vitest";
import { buildAgreement, departures, recurringValue, agreementReference, membershipIncludes } from "./agreement";
import { DEFAULT_RATE_CARD } from "./demand";

const client = { id: "ac-clienta", name: "Client A", kind: "CLIENT" as const, currency: "AED", createdAt: "2026-02-01T00:00:00.000Z" };
const agency = { id: "ac-gulf", name: "Gulf Talent Partners", kind: "AGENCY" as const, currency: "AED", createdAt: "2026-02-01T00:00:00.000Z" };

describe("one agreement, three parts", () => {
  it("bundles membership, fees and the contract into a single document", () => {
    const a = buildAgreement(client, DEFAULT_RATE_CARD);
    expect(a.membership.monthly).toBe(4500);
    expect(a.membership.annual).toBe(54_000);
    expect(a.fees.length).toBeGreaterThan(2);
    expect(a.contract.length).toBeGreaterThan(6);
    expect(a.meta.reference).toMatch(/^AMANA-2026-/);
  });

  it("charges an agency more for membership than a client", () => {
    expect(buildAgreement(agency, DEFAULT_RATE_CARD).membership.monthly).toBe(6000);
  });

  it("says the whole thing in one sentence somebody could read out", () => {
    expect(buildAgreement(client, DEFAULT_RATE_CARD).summary).toMatch(/AED 4,500 a month.*18%.*when somebody starts/);
  });
});

describe("what each side is actually shown", () => {
  it("never shows a client the lines about an agency's own margin", () => {
    const keys = buildAgreement(client, DEFAULT_RATE_CARD).fees.map((f) => f.key);
    expect(keys).toContain("permPct");
    expect(keys).not.toContain("agencyContractSharePct");
  });

  it("gives an agency the clause saying who actually places the person", () => {
    expect(buildAgreement(agency, DEFAULT_RATE_CARD).contract.map((c) => c.key)).toContain("licence");
    expect(buildAgreement(client, DEFAULT_RATE_CARD).contract.map((c) => c.key)).not.toContain("licence");
  });

  it("opens an agency's membership with the two things only they get", () => {
    expect(membershipIncludes("AGENCY").join(" ")).toMatch(/your own client requirements/);
    expect(membershipIncludes("CLIENT").join(" ")).not.toMatch(/your own client requirements/);
  });
});

describe("a commission adjusted ad hoc stays visible", () => {
  it("marks an overridden rate and keeps the standard one beside it", () => {
    const a = buildAgreement(agency, DEFAULT_RATE_CARD, { rates: { agencyReferralSharePct: 25 } });
    const line = a.fees.find((f) => f.key === "agencyReferralSharePct")!;
    expect(line.value).toBe("25%");
    expect(line.cardValue).toBe("35%");
    expect(line.overridden).toBe(true);
  });

  it("does not flag an override that happens to equal the standard rate", () => {
    const a = buildAgreement(client, DEFAULT_RATE_CARD, { rates: { permPct: DEFAULT_RATE_CARD.permPct } });
    expect(a.fees.find((f) => f.key === "permPct")!.overridden).toBe(false);
  });

  it("lists every departure from the standard terms in one place", () => {
    const a = buildAgreement(client, DEFAULT_RATE_CARD, { monthlyFee: 3000, rates: { permPct: 15 }, specialTerms: "Invoices go to accounts payable, not the hiring manager." });
    const d = departures(a);
    expect(d).toHaveLength(3);
    expect(d[0]).toMatch(/AED 3,000 rather than the standard AED 4,500/);
    expect(d[1]).toMatch(/15% rather than the standard 18%/);
    expect(d[2]).toMatch(/accounts payable/);
  });

  it("has no departures when nothing was changed", () => {
    expect(departures(buildAgreement(client, DEFAULT_RATE_CARD))).toHaveLength(0);
  });
});

describe("the contract says the things that matter", () => {
  const a = buildAgreement(client, DEFAULT_RATE_CARD);
  const text = (k: string) => a.contract.find((c) => c.key === k)!.body;

  it("is explicit that nothing is due until somebody starts", () => {
    expect(text("when")).toMatch(/first day, and not before/);
    expect(text("when")).toMatch(/Nothing is payable for a shortlist/);
  });

  it("carries the consent position into the contract, not just the interface", () => {
    expect(text("consent")).toMatch(/withdraw consent/);
    expect(text("consent")).toMatch(/already on your shortlist/);
  });

  it("names both regimes and a jurisdiction", () => {
    expect(text("data")).toMatch(/UK GDPR/);
    expect(text("data")).toMatch(/No\. 45 of 2021/);
    expect(text("law")).toMatch(/DIFC/);
  });

  it("takes the custom periods rather than hard-coding them", () => {
    const b = buildAgreement(client, DEFAULT_RATE_CARD, { paymentDays: 30, rebateDays: 60, noticeDays: 90 });
    expect(b.contract.find((c) => c.key === "payment")!.body).toMatch(/30 days/);
    expect(b.contract.find((c) => c.key === "rebate")!.body).toMatch(/60 days/);
    expect(b.contract.find((c) => c.key === "membership")!.body).toMatch(/90 days/);
  });
});

describe("what an account is worth before anybody is placed", () => {
  it("is the membership alone", () => {
    expect(recurringValue(buildAgreement(agency, DEFAULT_RATE_CARD))).toEqual({ monthly: 6000, annual: 72_000, currency: "AED" });
  });

  it("gives a stable reference from the account and its start date", () => {
    expect(agreementReference("ac-gulf", "2026-02-01")).toBe(agreementReference("ac-gulf", "2026-02-01"));
    expect(agreementReference("ac-gulf", "2026-02-01")).toMatch(/^AMANA-2026-[A-Z0-9]{4}$/);
  });
});
