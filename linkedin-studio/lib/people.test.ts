import { describe, expect, it } from "vitest";
import { classifyFunction, classifySeniority, draftAudience, EMPTY_ICP, matchEngagers, networkStats, rankLeads, type Person } from "./people";

const person = (o: Partial<Person>): Person => ({
  id: Math.random().toString(36), name: "A B", url: null, email: null, company: "", position: "", connectedOn: null,
  seniority: "Unknown", function: "Other", engagedCount: 0, lastEngaged: null, engagedOn: "", watch: false, leadStatus: null, notes: "", ...o,
});

describe("classification", () => {
  it("seniority", () => {
    expect(classifySeniority("Co-Founder & CEO")).toBe("Founder / Owner");
    expect(classifySeniority("Chief Revenue Officer")).toBe("C-suite");
    expect(classifySeniority("VP, Talent Acquisition")).toBe("VP");
    expect(classifySeniority("Head of Data")).toBe("Director / Head");
    expect(classifySeniority("Engineering Manager")).toBe("Manager / Lead");
    expect(classifySeniority("Senior Software Engineer")).toBe("Senior IC");
    expect(classifySeniority("Graduate Analyst")).toBe("Student / Early");
    expect(classifySeniority("")).toBe("Unknown");
  });
  it("function", () => {
    expect(classifyFunction("VP, Talent Acquisition")).toBe("People / Talent");
    expect(classifyFunction("Senior Software Engineer")).toBe("Engineering");
    expect(classifyFunction("Account Executive")).toBe("Sales");
    expect(classifyFunction("Partner at Seedcamp Ventures")).toBe("Investing");
    expect(classifyFunction("Head of Data Science")).toBe("Data / AI");
  });
});

describe("leads", () => {
  const icp = { ...EMPTY_ICP, functions: ["People / Talent"], seniorities: ["VP", "Director / Head"], titleKeywords: ["talent"] };
  it("ranks a warm, on-profile person first and explains why", () => {
    const now = new Date("2026-11-16").getTime();
    const leads = rankLeads(
      [
        person({ name: "Cold Fit", position: "VP Talent", function: "People / Talent", seniority: "VP" }),
        person({ name: "Warm Fit", position: "Director of Talent", function: "People / Talent", seniority: "Director / Head", engagedCount: 2, lastEngaged: "2026-11-10", engagedOn: "Hiring post" }),
        person({ name: "Off Profile", position: "Engineer", function: "Engineering", seniority: "IC" }),
      ],
      icp,
    );
    expect(leads[0].person.name).toBe("Warm Fit");
    expect(leads[0].action).toContain("Message them");
    expect(leads[0].reasons.join(" ")).toContain("Engaged with 2");
  });
  it("respects exclusions", () => {
    const l = rankLeads([person({ position: "Recruiter at Competitor Co", function: "People / Talent" })], { ...icp, excludeKeywords: ["competitor"] });
    expect(l).toHaveLength(0);
  });
});

describe("draft audience", () => {
  it("finds the people a hiring post is for", () => {
    const res = draftAudience("Most hiring advice is wrong. Here is how we interview candidates.", [
      person({ name: "Tal", position: "Talent Partner", function: "People / Talent" }),
      person({ name: "Eng", position: "Engineer", function: "Engineering" }),
    ]);
    expect(res.segments[0].function).toBe("People / Talent");
    expect(res.top[0].person.name).toBe("Tal");
  });
});

describe("network", () => {
  it("counts connections per month and by level", () => {
    const now = new Date("2026-11-16").getTime();
    const s = networkStats([person({ connectedOn: "2026-11-02", seniority: "VP" }), person({ connectedOn: "2026-10-02", seniority: "VP" })], now);
    expect(s.perMonth.at(-1)).toEqual({ x: "2026-11-01", y: 1 });
    expect(s.seniority[0]).toEqual({ key: "VP", count: 2 });
    expect(s.last90).toBe(2);
  });
  it("matches engagers by name in pasted comments", () => {
    const ppl = [person({ name: "Jane Doe" }), person({ name: "John Smith" })];
    expect(matchEngagers("Jane Doe • 1st\nGreat post!\n\nSomeone Else\nAgree", ppl).map((p) => p.name)).toEqual(["Jane Doe"]);
  });
});
