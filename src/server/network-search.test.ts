import { describe, it, expect } from "vitest";
import { textSearchClauses } from "./network-search";
import type { SearchIntent } from "@/lib/ai/types";

const intent = (over: Partial<SearchIntent> = {}): SearchIntent => ({ text: "", capabilities: [], locations: [], routes: [], availableSoon: false, workedWithOnly: false, sectors: [], ...over });

describe("textSearchClauses", () => {
  it("adds nothing for an empty question", () => {
    expect(textSearchClauses("   ", intent())).toEqual([]);
  });

  it("always matches the words as typed, even when nothing was understood", () => {
    const [first, ...rest] = textSearchClauses("Okonkwo", null);
    expect(rest).toEqual([]);
    expect(JSON.stringify(first)).toContain('"lastName":{"contains":"Okonkwo"');
  });

  it("widens with understood capabilities and places, and narrows with route, availability and worked-with", () => {
    const clauses = textSearchClauses("cyber lead in Dubai", intent({ capabilities: ["Cyber Security"], locations: ["Dubai"], routes: ["CONTRACT"], availableSoon: true, workedWithOnly: true }));
    const text = JSON.stringify(clauses);
    expect(clauses).toHaveLength(4); // the OR, then one AND per narrowing condition
    expect(text).toContain('"capabilities":{"hasSome":["Cyber Security"]}');
    expect(text).toContain('"primaryCity":{"contains":"Dubai"');
    expect(text).toContain('"engagementPreferences":{"hasSome":["CONTRACT"]}');
    expect(text).toContain('"workedTogether":true');
    expect(text).toContain('"availabilityStatus":{"in":');
  });
});
