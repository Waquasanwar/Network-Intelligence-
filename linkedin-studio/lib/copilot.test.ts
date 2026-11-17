import { describe, expect, it } from "vitest";
import { localAnswer } from "./copilot";
import { EMPTY_ICP, type Person } from "./people";
import { emptyMetrics, type Post } from "./types";

const post = (o: Partial<Post>): Post => ({
  id: Math.random().toString(36), url: "", title: "Post", status: "Published", text: "x", pillar: null, format: null, hookType: null, tags: [],
  ratings: { hook: null, clarity: null, value: null, voice: null, gut: null }, aiScore: null, aiNotes: "", plannedFor: null, publishedAt: "2026-11-10",
  linkedinUrl: null, linkedinUrn: null, metrics: { ...emptyMetrics(), impressions: 1000 }, engagementRate: null, performanceScore: 50, rank: 1, metricsSource: null, lastSynced: null, createdAt: "2026-11-01", ...o,
});
const person = (o: Partial<Person>): Person => ({ id: "p", name: "Jane Doe", url: "https://www.linkedin.com/in/jane", email: null, company: "Monzo", position: "VP Talent", connectedOn: null, seniority: "VP", function: "People / Talent", engagedCount: 0, lastEngaged: null, engagedOn: "", watch: false, leadStatus: null, notes: "", ...o });
const data = { posts: [post({ title: "Hiring is broken", rank: 1, performanceScore: 99 })], daily: [], people: [person({})], icp: { ...EMPTY_ICP, functions: ["People / Talent"] } };

describe("local copilot", () => {
  it("lists top leads", () => {
    const a = localAnswer("who are my top leads?", data)!;
    expect(a.items?.[0].label).toContain("Jane Doe");
  });
  it("names the best post", () => {
    expect(localAnswer("what was my best post", data)!.items?.[0].label).toBe("#1 Hiring is broken");
  });
  it("finds the audience for a quoted draft", () => {
    const a = localAnswer('who should see "We changed how we interview candidates for every hire"', data)!;
    expect(a.items?.[0].label).toBe("Jane Doe");
  });
  it("returns null for things it doesn't know", () => {
    expect(localAnswer("write me a haiku about tea", data)).toBeNull();
  });
});
