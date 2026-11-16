import { describe, expect, it } from "vitest";
import { parseCapture, resolveDate } from "./parse";

const TODAY = "2026-11-16"; // a Monday

describe("resolveDate", () => {
  it("handles words, weekdays, offsets and dates", () => {
    expect(resolveDate("today", TODAY)).toBe("2026-11-16");
    expect(resolveDate("tomorrow", TODAY)).toBe("2026-11-17");
    expect(resolveDate("fri", TODAY)).toBe("2026-11-20");
    expect(resolveDate("mon", TODAY)).toBe("2026-11-23"); // same weekday means next week
    expect(resolveDate("3d", TODAY)).toBe("2026-11-19");
    expect(resolveDate("2w", TODAY)).toBe("2026-11-30");
    expect(resolveDate("2026-12-01", TODAY)).toBe("2026-12-01");
    expect(resolveDate("5/1", TODAY)).toBe("2027-01-05"); // day/month already passed this year
    expect(resolveDate("banana", TODAY)).toBeUndefined();
  });
});

describe("parseCapture", () => {
  it("reads explicit markers and keeps names readable", () => {
    const p = parseCapture("d: go with vendor B for +Data_Migration with @Sarah #tooling !2 due:fri", TODAY);
    expect(p.type).toBe("Decision");
    expect(p.title).toBe("go with vendor B for Data Migration with Sarah");
    expect(p.projects).toEqual(["Data Migration"]);
    expect(p.people).toEqual(["Sarah"]);
    expect(p.tags).toContain("tooling");
    expect(p.priority).toBe("P2 High");
    expect(p.due).toBe("2026-11-20");
    expect(p.inferred).not.toContain("type");
  });

  it("drops trailing mentions from the title but keeps them as links", () => {
    const p = parseCapture("Asked finance for the revised forecast @Lena +Q1_Planning #budget", TODAY);
    expect(p.title).toBe("Asked finance for the revised forecast");
    expect(p.people).toEqual(["Lena"]);
    expect(p.projects).toEqual(["Q1 Planning"]);
    expect(parseCapture("@Sarah", TODAY).title).toBe("Sarah");
    const linked = parseCapture("r: send board pack to @Sarah +Q1_Planning due:fri", TODAY);
    expect(linked.title).toBe("send board pack to Sarah");
    expect(linked.projects).toEqual(["Q1 Planning"]);
  });

  it("supports quoted multi-word names, follow-ups and direction", () => {
    const p = parseCapture('r: send Q4 numbers to @"Jane Doe" fu:tomorrow <<', TODAY);
    expect(p.people).toEqual(["Jane Doe"]);
    expect(p.followUp).toBe("2026-11-17");
    expect(p.direction).toBe("Incoming (to me)");
    expect(p.title).toBe("send Q4 numbers to Jane Doe");
  });

  it("infers type, category, source and sentiment from wording", () => {
    const p = parseCapture("Client said onboarding felt slow on the call", TODAY);
    expect(p.type).toBe("Comment / Feedback");
    expect(p.category).toBe("Sales & Clients");
    expect(p.source).toBe("Call");
    expect(p.sentiment).toBe("Negative");
    expect(p.tags).toContain("client");
    expect(p.inferred).toEqual(expect.arrayContaining(["type", "category", "source", "sentiment", "tags"]));
  });

  it("treats a trailing question mark as a question and asks as requests", () => {
    expect(parseCapture("Who owns the renewal for Acme?", TODAY).type).toBe("Question");
    const req = parseCapture("Can you pull the headcount numbers by Friday", TODAY);
    expect(req.type).toBe("Request");
    expect(req.direction).toBe("Incoming (to me)");
    expect(parseCapture("Asked finance for the forecast", TODAY).direction).toBe("Outgoing (from me)");
  });

  it("splits a multi-line capture into title and body", () => {
    const p = parseCapture("m: 1:1 with Sam\n- wants more ownership\n- worried about workload", TODAY);
    expect(p.type).toBe("Meeting");
    expect(p.title).toBe("1:1 with Sam");
    expect(p.body).toBe("- wants more ownership\n- worried about workload");
  });

  it("leaves unknown prefixes and bangs alone", () => {
    const p = parseCapture("Note to self: ship it! now", TODAY);
    expect(p.title).toBe("Note to self: ship it! now");
  });
});
