import { describe, it, expect } from "vitest";
import { FEATURES, featuresOf, storedFeaturesOf, DEFAULT_FEATURES } from "./features";

describe("release switches", () => {
  it("start with everything off: nothing reaches members, clients, agencies or the public", () => {
    expect(Object.values(DEFAULT_FEATURES).every((v) => v === false)).toBe(true);
    expect(Object.values(featuresOf(null)).every((v) => v === false)).toBe(true);
    expect(Object.values(featuresOf({})).every((v) => v === false)).toBe(true);
  });
  it("only an explicit true releases something; anything else stays closed", () => {
    expect(featuresOf({ clientPortal: true }).clientPortal).toBe(true);
    expect(featuresOf({ clientPortal: "yes", agencyPortal: 1 }).clientPortal).toBe(false);
    expect(featuresOf({ clientPortal: "yes", agencyPortal: 1 }).agencyPortal).toBe(false);
  });
  it("a member feature is live only while the member area is released", () => {
    const set = { communityBoard: true, memberConnections: true, memberScreening: true, readAloud: true };
    expect(featuresOf(set).communityBoard).toBe(false);
    expect(featuresOf({ ...set, memberArea: true }).communityBoard).toBe(true);
    expect(featuresOf({ ...set, memberArea: true }).readAloud).toBe(true);
    expect(featuresOf({ memberArea: true, readAloud: true }).readAloud).toBe(false); // needs screening too
  });
  it("keeps what the owner chose, so switching the member area back on restores the rest", () => {
    expect(storedFeaturesOf({ communityBoard: true }).communityBoard).toBe(true);
  });
  it("every dependency names a real switch", () => {
    for (const f of FEATURES) if ("requires" in f) expect(FEATURES.some((x) => x.key === f.requires)).toBe(true);
  });
});
