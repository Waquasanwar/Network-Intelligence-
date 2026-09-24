import { describe, it, expect } from "vitest";
import { DEFAULT_SECURITY, SECURITY_CONTROLS, SECURITY_PROPERTIES, posture, securityOf } from "./security";

describe("secure by default", () => {
  it("ships every control on, because the default has to be the safe setting", () => {
    expect(SECURITY_CONTROLS.every((c) => c.defaultOn)).toBe(true);
    expect(Object.values(DEFAULT_SECURITY).every(Boolean)).toBe(true);
  });

  it("leads with the enforcement gap rather than a flattering count", () => {
    const p = posture(null);
    expect(p.band).toBe("secure by default");
    expect(p.weakened).toHaveLength(0);
    // Eight switches are on, but only the ones with code behind them are a protection.
    expect(p.on).toBe(SECURITY_CONTROLS.length);
    expect(p.enforced).toBeLessThan(p.on);
    expect(p.line).toMatch(/switched on but nothing implements them yet/i);
    expect(p.line).toMatch(/an intention, not a protection/i);
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

  it("leads with the consequence, not the setting name, once everything is enforced", () => {
    // With no enforcement gap left, the line is about what was switched off.
    const enforcedOnly = Object.fromEntries(SECURITY_CONTROLS.map((c) => [c.key, !!c.enforcedBy]));
    // Only the enforced controls are on, so nothing is "switched on but unimplemented"; the line
    // then leads with the worst thing that is actually off.
    const p = posture(enforcedOnly as never);
    expect(p.notYetEnforced).toHaveLength(0);
    expect(p.line).toMatch(/switched off below the default/i);
    expect(p.weakened.length).toBeGreaterThan(0);
  });

  it("stays out of the weakened band when only a convenience is off", () => {
    expect(posture({ sessionTimeout: false }).band).toBe("relaxed");
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

describe("a switch nobody implemented is not a protection", () => {
  it("counts only the controls something actually enforces", () => {
    const p = posture(null);
    expect(p.enforced).toBe(SECURITY_CONTROLS.filter((c) => c.enforcedBy).length);
    expect(p.notYetEnforced.map((n) => n.key).sort()).toEqual(
      SECURITY_CONTROLS.filter((c) => !c.enforcedBy).map((c) => c.key).sort(),
    );
  });

  it("names the mechanism wherever it claims one, so the claim is checkable", () => {
    for (const c of SECURITY_CONTROLS) {
      if (c.enforcedBy !== null) expect(c.enforcedBy.length, `${c.key} claims enforcement without naming it`).toBeGreaterThan(10);
    }
  });

  it("drops a control out of the unenforced list once it is switched off", () => {
    expect(posture({ mfaRequired: false }).notYetEnforced.map((n) => n.key)).not.toContain("mfaRequired");
  });
});
