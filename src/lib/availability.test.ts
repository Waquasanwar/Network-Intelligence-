import { describe, it, expect } from "vitest";
import { assessFreshness, suggestNextCheck, DEFAULT_STALE_DAYS } from "./availability";

const now = new Date("2026-09-16T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("assessFreshness", () => {
  it("is unknown when never confirmed", () => {
    expect(assessFreshness({ availabilityStatus: "AVAILABLE_NOW", availabilityConfirmedAt: null }, now)).toBe("unknown");
  });
  it("is fresh when recently confirmed", () => {
    expect(assessFreshness({ availabilityStatus: "OPEN_TO_CONVERSATIONS", availabilityConfirmedAt: daysAgo(3) }, now, DEFAULT_STALE_DAYS)).toBe("fresh");
  });
  it("ages then goes stale past the threshold", () => {
    expect(assessFreshness({ availabilityStatus: "OPEN_TO_CONVERSATIONS", availabilityConfirmedAt: daysAgo(35) }, now, 45)).toBe("aging");
    expect(assessFreshness({ availabilityStatus: "OPEN_TO_CONVERSATIONS", availabilityConfirmedAt: daysAgo(50) }, now, 45)).toBe("stale");
  });
  it("is stale once the next check date has passed even if recently confirmed", () => {
    expect(assessFreshness({ availabilityStatus: "AVAILABLE_NOW", availabilityConfirmedAt: daysAgo(2), nextCheckDate: daysAgo(1) }, now)).toBe("stale");
  });
  it("NEEDS_REFRESH is always stale", () => {
    expect(assessFreshness({ availabilityStatus: "NEEDS_REFRESH", availabilityConfirmedAt: daysAgo(0) }, now)).toBe("stale");
  });
});

describe("suggestNextCheck", () => {
  it("re-checks active statuses sooner than settled ones", () => {
    const a = suggestNextCheck("AVAILABLE_NOW", now).getTime();
    const b = suggestNextCheck("HAPPY_WHERE_I_AM", now).getTime();
    expect(a).toBeLessThan(b);
  });
});
