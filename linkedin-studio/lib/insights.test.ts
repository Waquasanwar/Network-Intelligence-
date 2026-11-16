import { describe, expect, it } from "vitest";
import { nextMoves } from "./insights";
import { emptyMetrics, type Post } from "./types";

const post = (o: Partial<Post>): Post => ({
  id: Math.random().toString(36),
  url: "",
  title: "t",
  status: "Published",
  text: "x",
  pillar: null,
  format: null,
  hookType: null,
  tags: [],
  ratings: { hook: null, clarity: null, value: null, voice: null, gut: null },
  aiScore: null,
  aiNotes: "",
  plannedFor: null,
  publishedAt: "2026-11-10",
  linkedinUrl: null,
  linkedinUrn: null,
  metrics: emptyMetrics(),
  engagementRate: null,
  performanceScore: null,
  rank: null,
  metricsSource: null,
  lastSynced: null,
  createdAt: "2026-11-01",
  ...o,
});

describe("nextMoves", () => {
  const now = new Date("2026-11-30").getTime();
  it("nudges when you haven't posted in a week", () => {
    expect(nextMoves([post({ publishedAt: "2026-11-10" })], now)[0].id).toBe("cadence");
  });
  it("names your strongest hook type", () => {
    const moves = nextMoves(
      [
        post({ hookType: "Story", performanceScore: 90 }),
        post({ hookType: "Story", performanceScore: 80 }),
        post({ hookType: "Question", performanceScore: 20 }),
      ],
      new Date("2026-11-12").getTime(),
    );
    const hook = moves.find((m) => m.id === "hook");
    expect(hook?.title).toBe("Story hooks are your strongest");
  });
  it("asks for an import when nothing is scored", () => {
    expect(nextMoves([post({ publishedAt: null })], now).some((m) => m.id === "start")).toBe(true);
  });
});

import { postingPulse, recentActivity } from "./activity";

describe("activity", () => {
  it("orders events newest first", () => {
    const ev = recentActivity([
      post({ id: "a", title: "Old", publishedAt: "2026-11-01" }),
      post({ id: "b", title: "New", publishedAt: "2026-11-10" }),
    ]);
    expect(ev[0].text).toContain("New");
  });
  it("places beats on the right day and averages the gaps", () => {
    const now = new Date("2026-11-30T12:00:00Z").getTime();
    const p = postingPulse([post({ publishedAt: "2026-11-20" }), post({ publishedAt: "2026-11-24" }), post({ publishedAt: "2026-10-01" })], 30, now);
    expect(p.beats.map((b) => b.index)).toEqual([19, 23]);
    expect(p.avgGap).toBe(4);
  });
});
