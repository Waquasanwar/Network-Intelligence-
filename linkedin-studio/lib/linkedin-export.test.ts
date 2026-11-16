import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { activityIdFrom, parseSheets, parseWorkbook, toDay, type Sheet } from "./linkedin-export";

const creator: Sheet[] = [
  {
    name: "DISCOVERY",
    rows: [
      ["Overall Performance", "10/17/2025 - 11/15/2025"],
      ["Impressions", "12,345"],
      ["Members reached", 6789],
    ],
  },
  {
    name: "ENGAGEMENT",
    rows: [
      ["Date", "Impressions", "Engagements"],
      ["11/1/2025", 500, 20],
      ["11/2/2025", 800, 41],
    ],
  },
  {
    name: "TOP POSTS",
    rows: [
      ["Maximum of 50 posts available to include in this list"],
      [],
      ["Post URL", "Post publish date", "Engagements", null, "Post URL", "Post publish date", "Impressions"],
      [
        "https://www.linkedin.com/feed/update/urn:li:activity:7390000000000000001",
        "11/1/2025",
        120,
        null,
        "https://www.linkedin.com/feed/update/urn:li:activity:7390000000000000002",
        "11/2/2025",
        9000,
      ],
      [
        "https://www.linkedin.com/feed/update/urn:li:activity:7390000000000000002",
        "11/2/2025",
        90,
        null,
        "https://www.linkedin.com/feed/update/urn:li:activity:7390000000000000001",
        "11/1/2025",
        4000,
      ],
    ],
  },
  {
    name: "FOLLOWERS",
    rows: [
      ["Total followers on 11/15/2025:", 2400],
      [],
      ["Date", "New followers"],
      ["11/1/2025", 4],
      ["11/2/2025", 11],
    ],
  },
  {
    name: "DEMOGRAPHICS",
    rows: [
      ["Top Demographics", "Value", "Percentage"],
      ["Job titles", "Founder", 0.12],
      ["Locations", "London", "8%"],
    ],
  },
];

describe("helpers", () => {
  it("reads LinkedIn post ids from URLs and URNs", () => {
    expect(activityIdFrom("https://www.linkedin.com/feed/update/urn:li:activity:7390000000000000001/")).toBe("7390000000000000001");
    expect(activityIdFrom("https://www.linkedin.com/posts/jane_ai-activity-7390000000000000003-AbCd")).toBe("7390000000000000003");
    expect(activityIdFrom("urn:li:share:7390000000000000004")).toBe("7390000000000000004");
    expect(activityIdFrom("https://example.com")).toBeNull();
  });
  it("reads US dates, ISO dates and Date cells", () => {
    expect(toDay("11/2/2025")).toBe("2025-11-02");
    expect(toDay("2025-11-02T10:00:00Z")).toBe("2025-11-02");
    expect(toDay(new Date("2025-11-02T00:00:00Z"))).toBe("2025-11-02");
  });
});

describe("creator export", () => {
  const res = parseSheets(creator);
  it("is detected", () => expect(res.kind).toBe("creator"));
  if (res.kind !== "creator") return;
  it("reads totals and period", () => {
    expect(res.totals).toEqual({ impressions: 12345, membersReached: 6789 });
    expect(res.period).toEqual({ start: "2025-10-17", end: "2025-11-15" });
  });
  it("merges daily engagement and followers", () => {
    expect(res.daily).toEqual([
      { day: "2025-11-01", impressions: 500, engagements: 20, newFollowers: 4 },
      { day: "2025-11-02", impressions: 800, engagements: 41, newFollowers: 11 },
    ]);
    expect(res.totalFollowers).toEqual({ count: 2400, asOf: "2025-11-15" });
  });
  it("joins both top-post tables by post id", () => {
    const p1 = res.topPosts.find((p) => p.activityId === "7390000000000000001");
    expect(p1).toMatchObject({ engagements: 120, impressions: 4000, publishedOn: "2025-11-01" });
    expect(res.topPosts).toHaveLength(2);
  });
  it("normalises demographic percentages", () => {
    expect(res.demographics.map((d) => d.percent)).toEqual([12, 8]);
  });
});

describe("single-post export", () => {
  it("reads label/value metrics", () => {
    const res = parseSheets([
      {
        name: "PERFORMANCE",
        rows: [
          ["Post URL", "https://www.linkedin.com/feed/update/urn:li:activity:7390000000000000009"],
          ["Post Date", "11/3/2025"],
          ["Impressions", 3210],
          ["Members reached", 2100],
          ["Profile viewers from this post", 31],
          ["Followers gained from this post", 6],
          ["Reactions", 88],
          ["Comments", 14],
          ["Reposts", 3],
          ["Saves", 9],
          ["Sends on LinkedIn", 5],
        ],
      },
    ]);
    expect(res.kind).toBe("post");
    if (res.kind !== "post") return;
    expect(res.activityId).toBe("7390000000000000009");
    expect(res.publishedOn).toBe("2025-11-03");
    expect(res.metrics).toMatchObject({ impressions: 3210, reactions: 88, comments: 14, saves: 9, sends: 5, profileViews: 31, followersGained: 6 });
  });
});

describe("parseWorkbook", () => {
  it("round-trips a real .xlsx file", async () => {
    const wb = new ExcelJS.Workbook();
    for (const s of creator) wb.addWorksheet(s.name).addRows(s.rows);
    const buf = await wb.xlsx.writeBuffer();
    const res = await parseWorkbook(buf as ArrayBuffer);
    expect(res.kind).toBe("creator");
    if (res.kind === "creator") expect(res.daily).toHaveLength(2);
  });
  it("rejects unrelated spreadsheets", () => {
    expect(() => parseSheets([{ name: "Sheet1", rows: [] }])).toThrow(/LinkedIn analytics export/);
  });
});
