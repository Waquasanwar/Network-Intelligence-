import { describe, it, expect } from "vitest";
import { amanaIntel, type IntelPerson } from "./amana-intel";

const now = new Date("2026-01-15T12:00:00Z");
const p = (over: Partial<IntelPerson>): IntelPerson => ({
  id: over.firstName ?? "x", firstName: "X", lastName: "Y", capabilities: [], availabilityStatus: "AVAILABLE_NOW", availabilityDate: null,
  availabilityConfirmedAt: new Date("2026-01-10"), workPattern: [], primaryCity: "London", primaryCountry: "UK", timeZone: null, amanaBench: false, usedByAmana: false, ...over,
});

describe("amanaIntel", () => {
  const people = [
    p({ firstName: "Sara", amanaBench: true, capabilities: ["Programme leadership"], workPattern: ["per_project"], primaryCity: "Dubai" }),
    p({ firstName: "Tom", amanaBench: true, capabilities: ["Finance transformation"], availabilityStatus: "FINISHING_ENGAGEMENT_SOON", availabilityConfirmedAt: null }),
    p({ firstName: "Ana", amanaBench: true, availabilityStatus: "HAPPY_WHERE_I_AM" }),
    p({ firstName: "Raj", capabilities: ["Cyber GRC"], primaryCity: "Mumbai" }),
  ];
  const demand = [
    { id: "d1", title: "Core banking recovery", capabilities: ["Programme leadership", "Cyber GRC"], location: "Dubai", href: "/r/1" },
  ];
  const r = amanaIntel(people, demand, now);

  it("counts who on the bench can start", () => {
    expect(r.count).toMatchObject({ now: 1, soon: 1, no: 1 });
    expect(r.insights[0].text).toBe("1 of your 3 core experts can start now, and 1 soon.");
  });
  it("finds work the bench cannot cover, and who in the wider network can", () => {
    const cyber = r.supply.find((s) => s.capability === "Cyber GRC")!;
    expect(cyber.bench).toHaveLength(0); expect(cyber.network.map((x) => x.firstName)).toEqual(["Raj"]);
    expect(r.insights.some((i) => /Nobody on the bench is free for Cyber GRC, but 1 in the wider network is: Raj/.test(i.text))).toBe(true);
  });
  it("lines the time zones up with where the work is", () => {
    expect(r.workPlaces.map((w) => w.label)).toEqual(["Dubai"]);
    expect(r.insights.some((i) => /of 3 free people keep hours that work with Dubai/.test(i.text))).toBe(true);
  });
  it("names who has gone quiet, and offers to ask them", () => {
    const ask = r.insights.find((i) => i.action === "ask-bench")!;
    expect(ask.text).toMatch(/1 core expert has not confirmed availability in two months: Tom/);
  });
});
