/** Test data: seeded posts in the mock Notion, and LinkedIn-shaped export files written to disk. */
import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const MOCK = "http://127.0.0.1:4998";
export const FIXTURES = path.join(process.cwd(), "test-results", "fixtures");

const t = (s: string) => [{ type: "text", text: { content: s } }];
const day = (ago: number) => new Date(Date.now() - ago * 864e5).toISOString().slice(0, 10);

export const SEED_POSTS = [
  { title: "Most hiring advice is wrong. Here's what worked for 40 hires:", hook: "Contrarian", pillar: "How-to", gut: 8, ago: 7, m: [14200, 520, 120, 31, 88, 40, 90, 34] },
  { title: "I turned down a promotion last year.", hook: "Story", pillar: "Lessons learned", gut: 6, ago: 2, m: [9800, 310, 64, 12, 40, 18, 55, 20] },
  { title: "We shipped late. Here's the honest post-mortem.", hook: "Confession", pillar: "Behind the scenes", gut: 7, ago: 22, m: [7600, 240, 51, 9, 33, 12, 40, 11] },
  { title: "3 things I'd tell my first-year self", hook: "Number / list", pillar: "Lessons learned", gut: 5, ago: 12, m: [4300, 90, 14, 2, 10, 3, 12, 2] },
  { title: "What does a great manager actually do?", hook: "Question", pillar: "Opinion", gut: 4, ago: 17, m: [2800, 40, 22, 1, 2, 1, 5, 0] },
  { title: "Our team grew 3x this year", hook: "Bold claim", pillar: "Wins", gut: 5, ago: 27, m: [3100, 70, 6, 1, 1, 0, 4, 1] },
];

export async function resetAndSeed() {
  await fetch(`${MOCK}/__reset`, { method: "POST" });
  for (const [i, p] of SEED_POSTS.entries()) {
    const [imp, re, co, rp, sa, se, pv, fg] = p.m;
    await fetch(`${MOCK}/v1/pages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parent: { data_source_id: "posts" },
        properties: {
          Title: { title: t(p.title) },
          Status: { select: { name: "Published" } },
          Text: { rich_text: t(`${p.title}\n\nA few short lines of the actual post.\n\nWhat would you add?`) },
          "Hook type": { select: { name: p.hook } },
          Pillar: { select: { name: p.pillar } },
          Format: { select: { name: i % 2 ? "Text" : "Image" } },
          "Gut score": { number: p.gut },
          "Published at": { date: { start: day(p.ago) } },
          "LinkedIn URN": { rich_text: t(`urn:li:activity:73900000000000000${10 + i}`) },
          Impressions: { number: imp }, Reactions: { number: re }, Comments: { number: co }, Reposts: { number: rp },
          Saves: { number: sa }, Sends: { number: se }, "Profile views": { number: pv }, "Followers gained": { number: fg },
        },
      }),
    });
  }
}

function usDate(ago: number) {
  const d = new Date(Date.now() - ago * 864e5);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

export async function writeCreatorExport(): Promise<string> {
  mkdirSync(FIXTURES, { recursive: true });
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("DISCOVERY").addRows([["Overall Performance", `${usDate(30)} - ${usDate(1)}`], ["Impressions", 52000], ["Members reached", 21000]]);
  const eng: (string | number)[][] = [["Date", "Impressions", "Engagements"]];
  const fol: (string | number | null)[][] = [[`Total followers on ${usDate(1)}:`, 3120], [], ["Date", "New followers"]];
  for (let d = 60; d >= 1; d--) {
    eng.push([usDate(d), Math.round(1500 - d * 12 + Math.sin(d / 2.3) * 380), 40 + (d % 7) * 9]);
    fol.push([usDate(d), 2 + (d % 5)]);
  }
  wb.addWorksheet("ENGAGEMENT").addRows(eng);
  wb.addWorksheet("FOLLOWERS").addRows(fol);
  wb.addWorksheet("TOP POSTS").addRows([
    ["Maximum of 50 posts"], [],
    ["Post URL", "Post publish date", "Engagements", null, "Post URL", "Post publish date", "Impressions"],
    ["https://www.linkedin.com/feed/update/urn:li:activity:7390000000000000010", usDate(7), 400, null, "https://www.linkedin.com/feed/update/urn:li:activity:7390000000000000099", usDate(15), 5200],
    ["https://www.linkedin.com/feed/update/urn:li:activity:7390000000000000099", usDate(15), 150, null, "https://www.linkedin.com/feed/update/urn:li:activity:7390000000000000010", usDate(7), 9800],
  ]);
  wb.addWorksheet("DEMOGRAPHICS").addRows([
    ["Top Demographics", "Value", "Percentage"],
    ["Job titles", "Founder", 0.14], ["Job titles", "Head of Talent", 0.09],
    ["Seniority", "Director", 0.21], ["Seniority", "CXO", 0.17], ["Seniority", "Senior", 0.25], ["Seniority", "Owner", 0.1],
    ["Industries", "Software Development", 0.31], ["Locations", "London Area, United Kingdom", 0.38], ["Companies", "Monzo", 0.03],
  ]);
  const file = path.join(FIXTURES, "creator-export.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

export function writeConnections(): string {
  mkdirSync(FIXTURES, { recursive: true });
  const people = [
    ["Jane", "Doe", "VP, Talent Acquisition", "Monzo"],
    ["Raj", "Patel", "Founder & CEO", "Fintechly"],
    ["Amira", "Haddad", "Head of People", "Revolut"],
    ["Tom", "Reed", "Senior Software Engineer", "Wise"],
    ["Lucy", "Chen", "Account Executive", "Acme Ltd"],
    ["Omar", "Farouk", "Chief People Officer", "Ocado"],
    ["Priya", "Shah", "Partner at Northwind Ventures", "Northwind"],
    ["Ben", "Hughes", "Graduate Analyst", "Sky"],
  ];
  const lines = [
    "Notes:",
    '"When exporting your connection data, you may notice that some of the email addresses are missing."',
    "",
    "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
    ...people.map(([f, l, title, co], i) => `${f},${l},https://www.linkedin.com/in/${f.toLowerCase()}${l.toLowerCase()},${i % 3 === 0 ? `${f.toLowerCase()}@example.com` : ""},${co},"${title}",0${(i % 9) + 1} Oct 2026`),
  ];
  const file = path.join(FIXTURES, "Connections.csv");
  writeFileSync(file, lines.join("\n") + "\n");
  return file;
}
