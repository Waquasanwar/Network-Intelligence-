import { describe, expect, it } from "vitest";
import { signals } from "./agent";
import { EMPTY_ICP, type Person } from "./people";
import { emptyMetrics, type DailyMetric, type Post } from "./types";

const NOW = new Date("2026-11-17T12:00:00Z").getTime(); // a Tuesday
const post = (o: Partial<Post>): Post => ({
  id: Math.random().toString(36), url: "", title: "Post", status: "Published", text: "x", pillar: null, format: null, hookType: null, tags: [],
  ratings: { hook: null, clarity: null, value: null, voice: null, gut: null }, aiScore: null, aiNotes: "", plannedFor: null, publishedAt: "2026-11-10",
  linkedinUrl: null, linkedinUrn: null, metrics: { ...emptyMetrics(), impressions: 1000 }, engagementRate: null, performanceScore: 50, rank: 2, metricsSource: null, lastSynced: null, createdAt: "2026-11-01", ...o,
});
const person = (o: Partial<Person>): Person => ({ id: "p", name: "Jane Doe", url: null, email: null, company: "", position: "VP Talent", connectedOn: null, seniority: "VP", function: "People / Talent", engagedCount: 1, lastEngaged: "2026-11-15", engagedOn: "Hiring", watch: false, leadStatus: null, notes: "", ...o });
const day = (d: string, impressions: number): DailyMetric => ({ id: d, day: d, impressions, membersReached: null, engagements: null, newFollowers: null, totalFollowers: null, profileViews: null, searchAppearances: null, source: "Import" });

describe("signals", () => {
  it("puts warm target leads first", () => {
    const s = signals({ posts: [post({})], daily: [], people: [person({})], icp: { ...EMPTY_ICP, functions: ["People / Talent"], seniorities: ["VP"] }, now: NOW });
    expect(s[0].id).toBe("warm-leads");
    expect(s[0].detail).toContain("Jane Doe");
  });
  it("flags today as the best day when it is", () => {
    const s = signals({
      posts: [post({ publishedAt: "2026-11-10", performanceScore: 90 }), post({ publishedAt: "2026-11-12", performanceScore: 20 })],
      daily: [], people: [], icp: EMPTY_ICP, now: NOW,
    });
    expect(s.map((x) => x.id)).toContain("best-day");
  });
  it("notices a reach dip week on week", () => {
    const daily = [day("2026-11-05", 1000), day("2026-11-08", 1000), day("2026-11-12", 300), day("2026-11-15", 300)];
    const s = signals({ posts: [], daily, people: [], icp: EMPTY_ICP, now: NOW });
    expect(s.find((x) => x.id === "reach-dip")?.title).toBe("Reach is down 70% this week");
  });
  it("nudges cadence and setup", () => {
    const s = signals({ posts: [post({ publishedAt: "2026-11-01" })], daily: [], people: [], icp: EMPTY_ICP, now: NOW });
    expect(s.map((x) => x.id)).toEqual(expect.arrayContaining(["cadence", "no-network"]));
  });
});
