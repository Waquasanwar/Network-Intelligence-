import { describe, it, expect } from "vitest";
import { money, moneyCompact, moneyMixed, rate, symbolOf } from "./money";

describe("the official mark, not the disambiguated code", () => {
  it("gives $ and £ rather than US$ and GB£", () => {
    expect(money(95_000, "USD")).toBe("$95,000");
    expect(money(1350, "GBP")).toBe("£1,350");
    expect(symbolOf("USD")).toBe("$");
    expect(symbolOf("GBP")).toBe("£");
  });

  it("writes the dirham as AED, which is how it is written in English", () => {
    expect(money(4500, "AED")).toBe("AED 4,500");
    expect(symbolOf("AED")).toBe("AED");
  });

  it("uses a normal space, so the string can be searched and pasted", () => {
    expect(money(4500, "AED")).not.toMatch(/ /);
  });
});

describe("what it does with nothing", () => {
  it("shows a dash rather than a zero it was never given", () => {
    expect(money(null)).toBe("—");
    expect(money(undefined)).toBe("—");
    expect(money(NaN)).toBe("—");
    expect(moneyCompact(null)).toBe("—");
  });

  it("still formats a real zero", () => {
    expect(money(0, "GBP")).toBe("£0");
  });
});

describe("figures and rates", () => {
  it("compacts a big number without losing its currency", () => {
    expect(moneyCompact(75_600, "AED")).toBe("AED 75.6K");
    expect(moneyCompact(1_400_000, "GBP")).toBe("£1.4M");
  });

  it("puts the unit on a rate", () => {
    expect(rate(1350, "GBP", "day")).toBe("£1,350/day");
    expect(rate(600, "AED", "hour")).toBe("AED 600/hour");
    expect(rate(null, "AED", "day")).toBe("—");
  });
});

describe("currencies are never added together", () => {
  it("shows them side by side, the tenant's own first", () => {
    expect(moneyMixed({ GBP: 51_840, AED: 75_600 }, "AED")).toBe("AED 75,600 · £51,840");
  });

  it("drops the empty ones", () => {
    expect(moneyMixed({ AED: 1000, GBP: 0 }, "AED")).toBe("AED 1,000");
  });

  it("falls back to a zero in the primary currency when there is nothing at all", () => {
    expect(moneyMixed({}, "GBP")).toBe("£0");
  });
});
