import { describe, expect, it } from "vitest";
import { calibration, correlation, engagementRate, percentile, scorePosts, tierFor } from "./scoring";
import { emptyMetrics, type Metrics } from "./types";

const m = (over: Partial<Metrics>): Metrics => ({ ...emptyMetrics(), ...over });

describe("engagementRate", () => {
  it("is engagements over impressions, as a percentage", () => {
    expect(engagementRate(m({ impressions: 1000, reactions: 30, comments: 10, reposts: 2 }))).toBe(4.2);
  });
  it("is null without impressions", () => {
    expect(engagementRate(m({ reactions: 5 }))).toBeNull();
  });
});

describe("percentile", () => {
  it("places the max at 1 and the min at 0", () => {
    expect(percentile([1, 2, 3], 3)).toBe(1);
    expect(percentile([1, 2, 3], 1)).toBe(0);
    expect(percentile([1, 2, 3], 2)).toBe(0.5);
  });
});

describe("scorePosts", () => {
  it("ranks a post with more reach and better engagement first", () => {
    const res = scorePosts([
      { id: "weak", metrics: m({ impressions: 500, reactions: 5 }) },
      { id: "strong", metrics: m({ impressions: 5000, reactions: 200, comments: 40, reposts: 10 }) },
      { id: "mid", metrics: m({ impressions: 1500, reactions: 30, comments: 5 }) },
      { id: "draft", metrics: m({}) },
    ]);
    expect(res.map((r) => r.id)).toEqual(["strong", "mid", "weak"]);
    expect(res[0].rank).toBe(1);
    expect(res[0].performanceScore).toBe(100);
    expect(res[2].performanceScore).toBe(0);
  });
});

describe("tierFor", () => {
  it("marks the top 10% as Breakout once there are 10+ posts", () => {
    expect(tierFor(95, 1, 20)).toBe("Breakout");
    expect(tierFor(95, 1, 5)).toBe("Strong");
    expect(tierFor(10, 18, 20)).toBe("Below par");
  });
});

describe("correlation", () => {
  it("needs five pairs", () => {
    expect(correlation([[1, 1], [2, 2]])).toBeNull();
  });
  it("is 1 for a perfect linear relationship", () => {
    expect(correlation([[1, 10], [2, 20], [3, 30], [4, 40], [5, 50]])).toBe(1);
  });
  it("calibration ignores unscored posts", () => {
    expect(calibration([]).gutN).toBe(0);
  });
});
