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
