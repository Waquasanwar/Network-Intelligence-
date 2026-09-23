import { describe, it, expect } from "vitest";
import { advantage, daysBetween, demandTotals, median, reach, velocity } from "./velocity";

const day = (n: number) => new Date(Date.UTC(2026, 0, n)).toISOString();

describe("the arithmetic", () => {
  it("counts whole days forwards and refuses to count backwards", () => {
    expect(daysBetween(day(1), day(15))).toBe(14);
    expect(daysBetween(day(15), day(1))).toBeNull(); // a placement before its own requirement is bad data, not -14
    expect(daysBetween(null, day(1))).toBeNull();
  });

  it("takes the median so one long engagement cannot move the headline", () => {
    expect(median([10, 12, 14, 200])).toBe(13);
    expect(median([10, 12, 14])).toBe(12);
    expect(median([])).toBeNull();
  });
});

describe("how big the network really is", () => {
  it("separates who we hold from who we could get to today", () => {
    const r = reach({
      people: [{ id: "a" }, { id: "b" }, { id: "c" }],
      referrals: [{ referredPersonId: "c" }, { referredPersonId: null }, { referredPersonId: undefined }],
      relationships: [{ personId: "b", introducedById: "a" }, { personId: "c", introducedById: "a" }, { personId: "a" }],
    });
    expect(r.inNetwork).toBe(3);
    expect(r.viaIntroduction).toBe(2);
    expect(r.namedNotYetJoined).toBe(2);
    expect(r.reachable).toBe(5);
  });
});

const briefs = [
  { id: "b1", createdAt: day(1) },
  { id: "b2", createdAt: day(1) },
  { id: "b3", createdAt: day(1) },
];

describe("how fast a requirement reaches somebody's first day", () => {
  const v = velocity({
    briefs,
    shortlist: [
      { briefId: "b1", personId: "known", decision: "PLACED", createdAt: day(3), updatedAt: day(15) },
      { briefId: "b2", personId: "fresh", decision: "PLACED", createdAt: day(5), updatedAt: day(31) },
      { briefId: "b3", personId: "other", decision: "PROPOSED", createdAt: day(2), updatedAt: day(2) },
    ],
    workedWith: ["known"],
  });

  it("measures from taking the requirement, not from proposing somebody", () => {
    expect(v.placements.find((p) => p.personId === "known")!.toStart).toBe(14);
    expect(v.placements.find((p) => p.personId === "known")!.toProposed).toBe(2);
  });

  it("gives the median, the fastest and the sample size", () => {
    expect(v.daysToStart).toBe(22);
    expect(v.fastest).toBe(14);
    expect(v.count).toBe(2);
  });

  it("times the first proposal on every requirement, filled or not", () => {
    expect(v.daysToProposed).toBe(2); // 2, 4 and 1 days across the three requirements
  });

  it("flags a sample too thin to read a trend into", () => {
    expect(v.thin).toBe(true);
  });
});

describe("whether knowing somebody actually helps", () => {
  const v = velocity({
    briefs,
    shortlist: [
      { briefId: "b1", personId: "known", decision: "PLACED", createdAt: day(3), updatedAt: day(15) },
      { briefId: "b2", personId: "fresh", decision: "PLACED", createdAt: day(5), updatedAt: day(31) },
    ],
    workedWith: ["known"],
  });

  it("compares the two groups and says what was saved", () => {
    const a = advantage(v);
    expect(a.known.medianDays).toBe(14);
    expect(a.newToUs.medianDays).toBe(30);
    expect(a.daysSaved).toBe(16);
    expect(a.sharePct).toBe(50);
    expect(a.line).toMatch(/16 days sooner/);
  });

  it("says so plainly when the record points the other way, rather than hiding it", () => {
    const flipped = velocity({
      briefs,
      shortlist: [
        { briefId: "b1", personId: "known", decision: "PLACED", createdAt: day(3), updatedAt: day(31) },
        { briefId: "b2", personId: "fresh", decision: "PLACED", createdAt: day(5), updatedAt: day(15) },
      ],
      workedWith: ["known"],
    });
    expect(advantage(flipped).daysSaved).toBe(-16);
    expect(advantage(flipped).line).toMatch(/actually been quicker by 16 days/);
  });

  it("does not invent a comparison when only one group has placements", () => {
    const onlyKnown = velocity({ briefs, shortlist: [{ briefId: "b1", personId: "known", decision: "PLACED", createdAt: day(3), updatedAt: day(15) }], workedWith: ["known"] });
    const a = advantage(onlyKnown);
    expect(a.daysSaved).toBeNull();
    expect(a.line).toMatch(/Every placement so far .* was somebody here had already worked with/);
  });

  it("is honest when there is nothing to go on at all", () => {
    expect(advantage(velocity({ briefs, shortlist: [], workedWith: [] })).line).toMatch(/No placements yet/);
  });
});

describe("everything the demand side has ever asked for", () => {
  it("counts what was taken, not only what is open", () => {
    const t = demandTotals(
      [{ status: "FILLED", headcount: 2 }, { status: "CLOSED" }, { status: "SEARCHING", headcount: 3 }],
      [{ status: "ENGAGED" }, { status: "CLOSED_LOST" }],
    );
    expect(t.taken).toBe(5);
    expect(t.open).toBe(2); // one searching brief, one engaged opportunity
    expect(t.filled).toBe(1);
    expect(t.fillRatePct).toBe(50); // one filled of two concluded
    expect(t.headcount).toBe(6);
  });

  it("does not divide by zero before anything has concluded", () => {
    expect(demandTotals([{ status: "SEARCHING" }], []).fillRatePct).toBe(0);
  });
});
