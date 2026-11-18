import { describe, it, expect } from "vitest";
import { matchesSearch } from "./search-match";

const aisha = { capabilities: ["Finance Transformation", "CFO"], sectors: ["Energy"], primaryCountry: "UAE", primaryCity: "Abu Dhabi", targetLocations: ["Dubai"] };
const intent = (o: Partial<{ capabilities: string[]; sectors: string[]; locations: string[] }> = {}) => ({ text: "", capabilities: [], sectors: [], locations: [], routes: [], availableSoon: false, workedWithOnly: false, ...o });

describe("client search matching", () => {
  it("finds a skill from part of it, in any case", () => {
    expect(matchesSearch(aisha, "finance", null)).toBe(true);
    expect(matchesSearch(aisha, "TRANSFORMATION lead", null)).toBe(true);
    expect(matchesSearch(aisha, "energy", null)).toBe(true);
  });

  it("does not match a skill nobody has", () => {
    expect(matchesSearch(aisha, "cyber security", null)).toBe(false);
  });

  it("answers a place on its own, and narrows a skill by place", () => {
    expect(matchesSearch(aisha, "Dubai", intent({ locations: ["dubai"] }))).toBe(true);
    expect(matchesSearch(aisha, "finance in Riyadh", intent({ locations: ["riyadh"] }))).toBe(false);
  });

  it("never matches on who someone is", () => {
    // Names, employers and headlines are not even passed in, so they cannot be probed.
    expect(matchesSearch(aisha, "Aisha Karimi", null)).toBe(false);
    expect(Object.keys(aisha).sort()).toEqual(["capabilities", "primaryCity", "primaryCountry", "sectors", "targetLocations"]);
  });
});
