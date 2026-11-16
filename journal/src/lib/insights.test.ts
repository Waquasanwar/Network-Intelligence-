import { describe, expect, it } from "vitest";
import { computeInsights, filterPeriod, weekStart, weekday } from "./insights";
import type { Entry } from "./schema";

const base = (over: Partial<Entry>): Entry => ({
  id: Math.random().toString(36),
  url: "#",
  title: "x",
  tags: [],
  projectIds: [],
  peopleIds: [],
  reviewed: false,
  chaseCount: 0,
  captured: "2026-11-16T10:00:00",
  lastEdited: "2026-11-16T10:00:00",
  ...over,
});

describe("date helpers", () => {
  it("finds the Monday of a week and weekday names", () => {
    expect(weekStart("2026-11-19T15:00:00")).toBe("2026-11-16");
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekday("2026-11-20")).toBe("Fri");
  });

  it("filters to a period and honours backdates", () => {
    const now = new Date("2026-11-16T12:00:00");
    const entries = [base({ captured: "2026-11-15T09:00:00" }), base({ captured: "2026-11-15T09:00:00", backdate: "2026-09-01" })];
    expect(filterPeriod(entries, 30, now)).toHaveLength(1);
    expect(filterPeriod(entries, null, now)).toHaveLength(2);
  });
});

describe("computeInsights", () => {
  const now = new Date("2026-11-16T18:00:00");
  const people = [{ id: "p1", name: "Sarah" }];
  const entries = [
    base({ type: "Request", status: "Done", peopleIds: ["p1"], captured: "2026-11-10T09:00:00", lastEdited: "2026-11-12T09:00:00" }),
    base({ type: "Request", status: "Open", peopleIds: ["p1"], due: "2026-11-13", captured: "2026-11-11T09:00:00" }),
    base({ type: "Decision", captured: "2026-09-01T10:00:00" }),
    base({ type: "Win", tags: ["client"], energy: "Low", captured: "2026-11-16T16:00:00" }),
    base({ type: "Note", tags: ["client"], sentiment: "Negative", category: "Finance", captured: "2026-11-13T10:00:00" }),
  ];
  const ins = computeInsights(entries, people, [], now);

  it("measures requests, overdue items and decisions to revisit", () => {
    expect(ins.turnaround).toBeCloseTo(2);
    expect(ins.openRequests).toBe(1);
    expect(ins.overdue).toBe(1);
    expect(ins.toRevisit).toHaveLength(1);
    expect(ins.requestsByPerson[0]).toEqual({ name: "Sarah", count: 2 });
  });

  it("ranks tags and counts the weekday streak", () => {
    expect(ins.topTags[0]).toEqual({ name: "client", count: 2 });
    // Mon 16 and Fri 13 have entries, Thu 12 does not: streak of 2 working days.
    expect(ins.streak).toBe(2);
    expect(ins.observations.join(" ")).toContain("Finance");
  });
});
