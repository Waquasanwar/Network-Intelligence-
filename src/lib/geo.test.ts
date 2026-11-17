import { describe, it, expect } from "vitest";
import { locatePlace } from "./geo";

describe("locatePlace", () => {
  it("finds a city, whatever the case or spacing", () => {
    expect(locatePlace("  DUBAI ", "UAE")?.label).toBe("Dubai");
    expect(locatePlace("São Paulo", null)?.key).toBe("sao paulo");
  });
  it("reads a city written with its country", () => {
    expect(locatePlace("London, UK", null)?.label).toBe("London");
  });
  it("falls back to the country when the city is not one it knows", () => {
    const p = locatePlace("Al Khobar", "KSA");
    expect(p?.label).toBe("Saudi Arabia");
  });
  it("understands the usual short names for countries", () => {
    expect(locatePlace(null, "U.K.")?.label).toBe("UK");
    expect(locatePlace(null, "United States of America")?.label).toBe("USA");
  });
  it("leaves out a place it cannot find instead of guessing", () => {
    expect(locatePlace("Atlantis", "Nowhere")).toBeNull();
    expect(locatePlace(null, null)).toBeNull();
    expect(locatePlace("", "")).toBeNull();
  });
  it("keeps every coordinate on the globe", () => {
    for (const c of ["Dubai", "London", "Accra", "Sydney", "New York", "Tokyo"]) {
      const p = locatePlace(c)!; expect(Math.abs(p.lat)).toBeLessThanOrEqual(90); expect(Math.abs(p.lng)).toBeLessThanOrEqual(180);
    }
  });
});
