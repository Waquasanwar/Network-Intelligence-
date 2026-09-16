import { describe, it, expect } from "vitest";
import { redactForPartner, containsForbiddenPartnerFields, opaqueRef, canAccessPath, canViewRelationshipNotes, assertSameTenant, AuthorizationError, canApprove, canRevealIdentity, type Actor, type PersonFull } from "./authz";

const person: PersonFull = {
  id: "ckx123",
  tenantId: "tenant-founder",
  firstName: "Sarah",
  lastName: "Okonkwo",
  email: "sarah@example.com",
  phone: "+44 7700 900000",
  linkedinUrl: "https://linkedin.com/in/sarah",
  headline: "Programme director",
  currentCompany: "Independent",
  currentRole: "Programme Director",
  primaryCity: "London",
  primaryCountry: "UK",
  capabilities: ["Programme director", "Turnaround"],
  sectors: ["Banking"],
  seniority: "DIRECTOR",
  engagementPreferences: ["SOW"],
  availabilityStatus: "FINISHING_ENGAGEMENT_SOON",
  relationships: [{ relationshipNotes: "SECRET: do not position on greenfield", workedTogether: true }],
  evidence: [
    { description: "Took a red programme to amber", visibility: "PARTNER_SAFE", evidenceType: "DELIVERY_OBSERVED", context: "Recovery" },
    { description: "Clashed with PMO", visibility: "PRIVATE", evidenceType: "CAUTION", context: "Stakeholders" },
  ],
  conversations: [{ rawNotes: "private" }],
};

const owner: Actor = { id: "u1", tenantId: "tenant-founder", role: "OWNER", tenantType: "PLATFORM_OWNER" };
const contributor: Actor = { id: "u2", tenantId: "tenant-founder", role: "CONTRIBUTOR", tenantType: "PLATFORM_OWNER" };
const partner: Actor = { id: "u3", tenantId: "tenant-partner", role: "PARTNER", tenantType: "RECRUITMENT_PARTNER" };
const client: Actor = { id: "u4", tenantId: "tenant-client", role: "CLIENT", tenantType: "DIRECT_CLIENT" };

describe("partner data boundary (spec §17.10, §17.13)", () => {
  it("redacts identity, contact, employer, notes, evidence text and cautions", () => {
    const safe = redactForPartner(person);
    const json = JSON.stringify(safe);
    expect(json).not.toContain("Sarah");
    expect(json).not.toContain("Okonkwo");
    expect(json).not.toContain("sarah@example.com");
    expect(json).not.toContain("7700");
    expect(json).not.toContain("linkedin");
    expect(json).not.toContain("Independent");
    expect(json).not.toContain("London");
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("red programme");
    expect(json).not.toContain("Clashed");
    expect(json).not.toContain("ckx123");
    expect(json).not.toContain("tenant-founder");
  });
  it("keeps only capability-level signal", () => {
    const safe = redactForPartner(person);
    expect(safe.capabilities).toEqual(["Programme director", "Turnaround"]);
    expect(safe.region).toBe("UK");
    expect(safe.availabilityBand).toBe("near-term");
    expect(safe.evidenceSummary).toMatch(/1 piece of observed delivery evidence \(1 shareable on request\)/);
    expect(safe.ref).toMatch(/^NI-[0-9A-F]{6}$/);
  });
  it("opaque refs are stable and not reversible to the id", () => {
    expect(opaqueRef("ckx123")).toBe(opaqueRef("ckx123"));
    expect(opaqueRef("ckx123")).not.toContain("ckx");
    expect(opaqueRef("ckx123")).not.toBe(opaqueRef("ckx124"));
  });
  it("containsForbiddenPartnerFields catches leaks in nested payloads", () => {
    expect(containsForbiddenPartnerFields(redactForPartner(person))).toEqual([]);
    expect(containsForbiddenPartnerFields({ results: [{ ref: "x", email: "a@b.c" }] })).toEqual(["email"]);
    expect(containsForbiddenPartnerFields({ a: { b: { relationshipNotes: "x" } } })).toEqual(["relationshipNotes"]);
  });
});

describe("role-based navigation", () => {
  it("partners cannot reach internal pages", () => {
    for (const p of ["/overview", "/network", "/network/abc", "/conversations", "/opportunities", "/amana", "/partners", "/relocation", "/settings/integrations"]) {
      expect(canAccessPath(partner, p)).toBe(false);
    }
    expect(canAccessPath(partner, "/partner-portal")).toBe(true);
  });
  it("clients only see the client workspace", () => {
    expect(canAccessPath(client, "/client-workspace")).toBe(true);
    expect(canAccessPath(client, "/network")).toBe(false);
    expect(canAccessPath(client, "/partner-portal")).toBe(false);
  });
  it("internal users reach all internal pages", () => {
    expect(canAccessPath(contributor, "/amana")).toBe(true);
    expect(canAccessPath(owner, "/settings/security")).toBe(true);
  });
});

describe("object-level checks", () => {
  it("cross-tenant access throws", () => {
    expect(() => assertSameTenant(partner, "tenant-founder")).toThrow(AuthorizationError);
    expect(() => assertSameTenant(owner, "tenant-founder")).not.toThrow();
  });
  it("relationship notes are visible only inside the owning tenant to internal roles", () => {
    expect(canViewRelationshipNotes(owner, "tenant-founder")).toBe(true);
    expect(canViewRelationshipNotes(contributor, "tenant-founder")).toBe(true);
    expect(canViewRelationshipNotes(partner, "tenant-founder")).toBe(false);
    expect(canViewRelationshipNotes(owner, "tenant-other")).toBe(false);
  });
  it("only internal humans approve; only owner/admin reveal identity", () => {
    expect(canApprove(owner)).toBe(true);
    expect(canApprove(contributor)).toBe(true);
    expect(canApprove(partner)).toBe(false);
    expect(canApprove(client)).toBe(false);
    expect(canRevealIdentity(contributor)).toBe(false);
    expect(canRevealIdentity(owner)).toBe(true);
  });
});
