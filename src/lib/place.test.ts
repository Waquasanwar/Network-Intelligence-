import { describe, it, expect } from "vitest";
import { zoneFor, offsetHours, utcLabel, apart, apartLabel, readiness } from "./place";

const winter = new Date("2026-01-15T12:00:00Z");
const summer = new Date("2026-07-15T12:00:00Z");

describe("place", () => {
  it("finds a zone from the city, then the country, and prefers one they set", () => {
    expect(zoneFor({ primaryCity: "Dubai" })).toBe("Asia/Dubai");
    expect(zoneFor({ primaryCity: "Somewhere small", primaryCountry: "UK" })).toBe("Europe/London");
    expect(zoneFor({ primaryCity: "Dubai", timeZone: "Europe/London" })).toBe("Europe/London");
    expect(zoneFor({ primaryCity: null, primaryCountry: null })).toBeNull();
  });
  it("reads offsets with daylight saving", () => {
    expect(offsetHours("Asia/Dubai", winter)).toBe(4);
    expect(offsetHours("Europe/London", winter)).toBe(0);
    expect(offsetHours("Europe/London", summer)).toBe(1);
    expect(offsetHours("Asia/Kolkata", winter)).toBe(5.5);
    expect(utcLabel(5.5)).toBe("UTC+5:30");
    expect(utcLabel(-5)).toBe("UTC−5");
  });
  it("works out hours apart and the working day they share", () => {
    const ld = apart("Europe/London", "Asia/Dubai", winter); // London is 4h behind Dubai in winter
    expect(ld.diff).toBe(-4); expect(ld.overlap).toBe(5);
    expect(apartLabel(ld.diff)).toBe("4h behind");
    expect(apart("Asia/Dubai", "Asia/Riyadh", winter)).toEqual({ diff: 1, overlap: 8 });
    expect(apart("America/New_York", "Asia/Dubai", winter).overlap).toBe(0);
    expect(apartLabel(1.5)).toBe("1h 30m ahead");
    expect(apartLabel(0)).toBe("Same time");
  });
  it("says whether someone can start", () => {
    const now = new Date("2026-11-21T00:00:00Z");
    expect(readiness({ availabilityStatus: "AVAILABLE_NOW" }, now)).toBe("now");
    expect(readiness({ availabilityStatus: "FINISHING_ENGAGEMENT_SOON" }, now)).toBe("soon");
    expect(readiness({ availabilityStatus: "UNAVAILABLE_UNTIL", availabilityDate: new Date("2026-12-10") }, now)).toBe("soon");
    expect(readiness({ availabilityStatus: "UNAVAILABLE_UNTIL", availabilityDate: new Date("2027-06-01") }, now)).toBe("later");
    expect(readiness({ availabilityStatus: "HAPPY_WHERE_I_AM" }, now)).toBe("no");
  });
});
