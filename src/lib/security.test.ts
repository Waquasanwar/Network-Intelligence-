import { describe, it, expect } from "vitest";
import { DEFAULT_SECURITY, SECURITY_CONTROLS, SECURITY_PROPERTIES, posture, securityOf } from "./security";

describe("secure by default", () => {
  it("ships every control on, because the default has to be the safe setting", () => {
    expect(SECURITY_CONTROLS.every((c) => c.defaultOn)).toBe(true);
    expect(Object.values(DEFAULT_SECURITY).every(Boolean)).toBe(true);
  });

  it("says plainly that a tenant which has changed nothing needs no attention", () => {
    const p = posture(null);
    expect(p.band).toBe("secure by default");
    expect(p.weakened).toHaveLength(0);
    expect(p.line).toMatch(/nothing here needs your attention/i);
  });

  it("fills in a control the stored settings have never heard of", () => {
    expect(securityOf({ mfaRequired: false }).restrictExport).toBe(true);
  });
});

describe("what happens when somebody turns a protection off", () => {
  it("separates a weakened protection from a relaxed convenience", () => {
    const p = posture({ restrictExport: false, sessionTimeout: false });
    expect(p.weakened.map((w) => w.key)).toEqual(["restrictExport"]);
    expect(p.relaxed.map((r) => r.key)).toEqual(["sessionTimeout"]);
    expect(p.band).toBe("hardened below default");
  });

  it("leads with the consequence, not the setting name", () => {
    expect(posture({ mfaRequired: false }).line).toMatch(/leaked password/i);
  });

  it("stays out of the weakened band when only a convenience is off", () => {
    expect(posture({ sessionTimeout: false }).band).toBe("relaxed");
    expect(posture({ sessionTimeout: false }).line).toMatch(/every protection that matters is on/i);
  });

  it("counts what is on rather than inventing a score to climb", () => {
    const p = posture({ mfaRequired: false });
    expect(p.on).toBe(SECURITY_CONTROLS.length - 1);
    expect(p.total).toBe(SECURITY_CONTROLS.length);
  });
});

describe("the claims a reviewer would check", () => {
  it("names a mechanism for every property, so nothing is an unbacked assertion", () => {
    for (const p of SECURITY_PROPERTIES) {
      expect(p.where.length, `${p.key} has no mechanism named`).toBeGreaterThan(8);
      expect(p.article).toMatch(/Arts?\./);
    }
  });

  it("covers both regimes rather than only the UK one", () => {
    expect(SECURITY_PROPERTIES.filter((p) => p.article.includes("PDPL")).length).toBeGreaterThanOrEqual(5);
  });

  it("states a cost for switching off every single control", () => {
    for (const c of SECURITY_CONTROLS) expect(c.ifOff.length, `${c.key} does not say what it costs`).toBeGreaterThan(20);
  });
});
