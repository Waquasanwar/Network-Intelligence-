import { describe, expect, it } from "vitest";
import { median, scoreTrend, splitWinners, trendDelta, vsTypical, winnersVsRest } from "./coach";
import { emptyMetrics, type Metrics, type Post } from "./types";

let i = 0;
const post = (score: number, m: Partial<Metrics>, day = `2026-10-${String(++i).padStart(2, "0")}`): Post => ({
  id: `p${i}`, url: "", title: `Post ${i}`, status: "Published", text: "x".repeat(score * 10), pillar: null, format: null, hookType: null, tags: [],
  ratings: { hook: null, clarity: null, value: null, voice: null, gut: null }, aiScore: null, aiNotes: "", plannedFor: null, publishedAt: day,
  linkedinUrl: null, linkedinUrn: null, metrics: { ...emptyMetrics(), ...m }, engagementRate: null, performanceScore: score, rank: null,
  metricsSource: null, lastSynced: null, createdAt: day,
});

const set = [
  post(20, { impressions: 1000, comments: 2 }),
  post(40, { impressions: 1000, comments: 4 }),
  post(60, { impressions: 1000, comments: 6 }),
  post(90, { impressions: 1000, comments: 20 }),
];

describe("coach", () => {
  it("median", () => expect(median([3, 1, 2, 10])).toBe(2.5));
  it("needs 4 scored posts to name winners", () => {
    expect(splitWinners(set.slice(0, 3))).toBeNull();
    expect(splitWinners(set)!.winners.map((p) => p.performanceScore)).toEqual([90]);
  });
  it("compares winners with the rest per 1k views", () => {
    const c = winnersVsRest(set).find((r) => r.key === "comments")!;
    expect(c.winners).toBe(20);
    expect(c.rest).toBe(4);
    expect(c.ratio).toBe(5);
  });
  it("trend is in publish order with a rolling average and a delta", () => {
    const t = scoreTrend(set);
    expect(t.map((p) => p.score)).toEqual([20, 40, 60, 90]);
    expect(t[2].rolling).toBe(40);
    expect(trendDelta(t)).toBe(45);
  });
  it("compares a post with the typical post", () => {
    const rows = vsTypical(set[3], set);
    expect(rows.find((r) => r.key === "comments")!.pct).toBe(400);
  });
});
