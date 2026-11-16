import { describe, expect, it } from "vitest";
import { bottlenecks, chaseDue, isStuck, monthGrid, priorities, procurement, projectStats, weekDays, weeklyBrief, workdaysBetween } from "./planning";
import type { Entry, Project } from "./schema";

const TODAY = "2026-11-16"; // Monday
let n = 0;
const e = (over: Partial<Entry>): Entry => ({
  id: `e${++n}`,
  url: "#",
  title: `item ${n}`,
  tags: [],
  projectIds: [],
  peopleIds: [],
  reviewed: true,
  chaseCount: 0,
  captured: "2026-11-02T10:00:00",
  lastEdited: "2026-11-02T10:00:00",
  ...over,
});

describe("working days", () => {
  it("skips weekends", () => {
    expect(workdaysBetween("2026-11-13", "2026-11-16")).toBe(1); // Fri -> Mon
    expect(workdaysBetween("2026-11-09", "2026-11-16")).toBe(5);
  });
  it("builds week and month grids starting Monday", () => {
    expect(weekDays("2026-11-19")[0]).toBe("2026-11-16");
    const grid = monthGrid("2026-11-16");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-10-26");
  });
});

describe("chasing and stuck", () => {
  it("flags a waiting request after three quiet working days", () => {
    const fresh = e({ type: "Request", status: "Waiting on others", waitingOn: "Finance", captured: "2026-11-13T09:00:00", lastEdited: "2026-11-13T09:00:00" });
    const quiet = e({ type: "Request", status: "Waiting on others", waitingOn: "Finance", captured: "2026-11-09T09:00:00", lastEdited: "2026-11-10T09:00:00" });
    expect(chaseDue(fresh, TODAY)).toBe(false);
    expect(chaseDue(quiet, TODAY)).toBe(true);
    // A recent chase resets the clock.
    expect(chaseDue({ ...quiet, lastChased: "2026-11-13" }, TODAY)).toBe(false);
  });

  it("treats closed and received items as done", () => {
    const pr = e({ type: "Purchase Request", stage: "Received", waitingOn: "Procurement", captured: "2026-10-01T09:00:00", lastEdited: "2026-10-01T09:00:00" });
    expect(isStuck(pr, TODAY)).toBe(false);
    expect(isStuck({ ...pr, stage: "Awaiting approval" }, TODAY)).toBe(true);
  });
});

describe("bottlenecks and procurement", () => {
  const entries = [
    e({ type: "Purchase Request", stage: "Awaiting approval", waitingOn: "Procurement", amount: 14400, chaseCount: 3, captured: "2026-10-20T09:00:00", lastEdited: "2026-10-30T09:00:00" }),
    e({ type: "Purchase Request", stage: "PO raised", waitingOn: "Procurement", amount: 62000, captured: "2026-10-26T09:00:00", lastEdited: "2026-11-12T09:00:00" }),
    e({ type: "Request", status: "Waiting on others", waitingOn: "Management", captured: "2026-11-12T09:00:00", lastEdited: "2026-11-12T09:00:00" }),
    e({ type: "Purchase Request", stage: "Received", amount: 3200, status: "Done", captured: "2026-10-01T09:00:00", lastEdited: "2026-10-11T09:00:00" }),
  ];

  it("ranks who is holding things up", () => {
    const b = bottlenecks(entries, TODAY);
    expect(b[0].who).toBe("Procurement");
    expect(b[0].count).toBe(2);
    expect(b[0].amount).toBe(76400);
    expect(b[0].chases).toBe(3);
  });

  it("summarises the procurement pipeline", () => {
    const p = procurement(entries, TODAY);
    expect(p.open).toHaveLength(2);
    expect(p.pendingAmount).toBe(76400);
    expect(p.stuck.map((x) => x.amount)).toEqual([14400]);
    expect(p.byStage.find((s) => s.stage === "PO raised")?.count).toBe(1);
    expect(p.avgCycleDays).toBe(10);
  });
});

describe("priorities, projects and the weekly brief", () => {
  const project: Project = { id: "p1", url: "#", name: "Migration", health: "At risk", priority: "P1 Urgent", nextMilestone: "Contract" };
  const entries = [
    e({ title: "Overdue deck", type: "Request", priority: "P2 High", due: "2026-11-12", projectIds: ["p1"] }),
    e({ title: "Due Thursday", type: "Request", due: "2026-11-19" }),
    e({ title: "Old decision", type: "Decision", captured: "2026-09-01T10:00:00" }),
    e({ title: "Just a note", type: "Note" }),
    e({ title: "Finished", type: "Request", status: "Done", due: "2026-11-10" }),
  ];

  it("ranks overdue, at-risk work first and explains why", () => {
    const p = priorities(entries, [project], TODAY);
    expect(p[0].entry.title).toBe("Overdue deck");
    expect(p[0].reasons).toEqual(expect.arrayContaining(["Overdue 4d", "Migration at risk"]));
    expect(p.map((x) => x.entry.title)).toContain("Old decision");
    expect(p.map((x) => x.entry.title)).not.toContain("Just a note");
    expect(p.map((x) => x.entry.title)).not.toContain("Finished");
  });

  it("scores project health from the evidence", () => {
    const s = projectStats(project, entries, TODAY);
    expect(s.overdue).toHaveLength(1);
    expect(s.suggested).toBe("At risk");
  });

  it("builds a Monday brief with sections", () => {
    const b = weeklyBrief(entries, [project], [], TODAY);
    expect(b.title).toContain("16 November 2026");
    expect(b.sections[0].heading).toBe("Top priorities this week");
    expect(b.sections[0].items[0]).toContain("Overdue deck");
    expect(b.sections.find((s) => s.heading === "Due this week")!.items.join()).toContain("Due Thursday");
  });
});
