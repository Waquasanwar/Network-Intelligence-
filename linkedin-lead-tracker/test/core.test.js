import { test } from "node:test";
import assert from "node:assert/strict";
import { csvToLeads, findDuplicate, normaliseProfileUrl, parseCsv, toCsv } from "../lib/csv.js";
import { defaultSettings, detectSector, enrichLead, hasKeyword, scoreLead, fillTemplate } from "../lib/scoring.js";
import * as store from "../lib/store.js";

const LINKEDIN_EXPORT = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Sarah,Khan,https://www.linkedin.com/in/sarah-khan-123,,Gulf Bank,Head of Transformation,12 Mar 2025
James,Lee,https://www.linkedin.com/in/jameslee,james@example.com,"Brightline Analytics, Inc.",Founder & CEO,01 Jan 2024
`;

function settings() {
  const s = defaultSettings();
  s.sectors.find((x) => x.name === "Financial Services").priority = 3;
  s.sectors.find((x) => x.name === "Technology & SaaS").priority = 1;
  s.targetTitles = ["head of transformation", "coo"];
  s.targetLocations = ["dubai"];
  s.excludeKeywords = ["recruiter"];
  return s;
}

test("parses LinkedIn's Connections.csv including the Notes preamble", () => {
  const { leads, error } = csvToLeads(LINKEDIN_EXPORT);
  assert.equal(error, null);
  assert.equal(leads.length, 2);
  assert.equal(leads[0].company, "Gulf Bank");
  assert.equal(leads[1].company, "Brightline Analytics, Inc.");
  assert.equal(leads[1].position, "Founder & CEO");
  assert.equal(leads[0].connectedOn, "12 Mar 2025");
});

test("splits a single Name column and reports a missing header", () => {
  assert.equal(csvToLeads("Name,Title\nPriya Anne Patel,CFO\n").leads[0].lastName, "Anne Patel");
  assert.ok(csvToLeads("foo,bar\n1,2\n").error);
});

test("csv round trip keeps commas, quotes and newlines", () => {
  const rows = [["a", 'b "q"', "c,d"], ["line\nbreak", "", "x"]];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

test("profile URLs normalise for de-duplication", () => {
  assert.equal(normaliseProfileUrl("https://www.LinkedIn.com/in/Sarah-Khan-123/?trk=x"), "linkedin.com/in/sarah-khan-123");
  assert.equal(normaliseProfileUrl("linkedin.com/in/sarah-khan-123"), "linkedin.com/in/sarah-khan-123");
});

test("keyword matching is whole-word", () => {
  assert.ok(hasKeyword("vp of ai products", "ai"));
  assert.ok(!hasKeyword("retail director", "ai"));
  assert.ok(hasKeyword("head of transformation, gulf bank", "head of transformation"));
});

test("detects sector, preferring a targeted sector on ties", () => {
  const s = settings();
  assert.equal(detectSector({ company: "Gulf Bank", position: "Head of Ops" }, s.sectors), "Financial Services");
  assert.equal(detectSector({ company: "Acme", position: "Engineer", sector: "Financial Services" }, s.sectors), "Financial Services");
  assert.equal(detectSector({ company: "Acme", position: "Nurse", sector: "Hospital & Health Care" }, s.sectors), "Healthcare & Life Sciences");
  assert.equal(detectSector({ company: "Acme Widgets", position: "Manager" }, s.sectors), "");
});

test("scores an ideal lead hot, with reasons", () => {
  const s = settings();
  const lead = enrichLead({ firstName: "Sarah", company: "Gulf Bank", position: "Head of Transformation", location: "Dubai, UAE", relationship: ["follows_page", "connection"], activities: [] }, s);
  assert.equal(lead.sector, "Financial Services");
  assert.equal(lead.tier, "hot");
  assert.equal(lead.score, 35 + 25 + 18 + 10);
  assert.ok(lead.scoreReasons.some((r) => r.includes("target title")));
});

test("recent inbound engagement adds points; old engagement doesn't", () => {
  const s = settings();
  const base = { firstName: "A", sector: "Financial Services", relationship: [] };
  const fresh = scoreLead({ ...base, activities: [{ type: "replied", at: new Date().toISOString() }] }, s);
  const old = scoreLead({ ...base, activities: [{ type: "replied", at: "2020-01-01T00:00:00Z" }] }, s);
  assert.equal(fresh.score - old.score, 10);
});

test("exclusions score zero", () => {
  const r = scoreLead({ firstName: "R", position: "Senior Recruiter", sector: "Financial Services", relationship: ["follows_me"] }, settings());
  assert.equal(r.score, 0);
  assert.equal(r.tier, "excluded");
});

test("templates fill placeholders with sensible fallbacks", () => {
  assert.equal(fillTemplate("Hi {firstName} at {company} {unknown}", { firstName: "Sam" }), "Hi Sam at your company {unknown}");
});

test("import merges duplicates instead of doubling them", () => {
  const state = store.emptyState();
  state.settings = settings();
  const first = store.importCsv(state, { csv: LINKEDIN_EXPORT, relationship: ["connection"] });
  assert.deepEqual(first, { created: 2, updated: 0, skipped: 0 });
  assert.equal(state.leads[0].stage, "connected");
  const followers = "Name,URL\nSarah Khan,linkedin.com/in/sarah-khan-123\nNew Person,\n";
  const second = store.importCsv(state, { csv: followers, relationship: ["follows_page"] });
  assert.deepEqual(second, { created: 1, updated: 1, skipped: 0 });
  const sarah = state.leads.find((l) => l.firstName === "Sarah");
  assert.deepEqual(sarah.relationship.sort(), ["connection", "follows_page"]);
  assert.equal(sarah.company, "Gulf Bank");
});

test("logging activity advances the stage forward only", () => {
  const state = store.emptyState();
  const lead = store.createLead(state, { firstName: "Jo", stage: "new" });
  store.addActivity(state, lead.id, { type: "connection_sent" });
  assert.equal(state.leads[0].stage, "requested");
  store.addActivity(state, lead.id, { type: "call_booked", at: "2026-11-02" });
  assert.equal(state.leads[0].stage, "booked");
  assert.equal(state.leads[0].appointmentAt, "2026-11-02");
  store.addActivity(state, lead.id, { type: "message_sent" });
  assert.equal(state.leads[0].stage, "booked");
  store.updateLead(state, lead.id, { stage: "lost" });
  store.addActivity(state, lead.id, { type: "replied" });
  assert.equal(state.leads[0].stage, "lost");
});

test("duplicate matching: URL first, then name + company, never two different namesakes", () => {
  const leads = [
    { firstName: "Sarah", lastName: "Khan", company: "Gulf Bank", profileUrl: "https://linkedin.com/in/sk" },
    { firstName: "John", lastName: "Smith", company: "Acme" },
    { firstName: "John", lastName: "Smith", company: "Globex" },
  ];
  assert.equal(findDuplicate(leads, { firstName: "sarah", lastName: "khan", company: "Gulf Bank" }), leads[0]);
  assert.equal(findDuplicate(leads, { firstName: "Sarah", lastName: "Khan" }), leads[0]);
  assert.equal(findDuplicate(leads, { firstName: "Sarah", lastName: "Khan", profileUrl: "linkedin.com/in/other" }), null);
  assert.equal(findDuplicate(leads, { firstName: "John", lastName: "Smith", company: "Globex" }), leads[2]);
  assert.equal(findDuplicate(leads, { firstName: "John", lastName: "Smith" }), null);
  assert.equal(findDuplicate(leads, { firstName: "John", lastName: "Smith", company: "Initech" }), null);
});

test("validation rejects bad input", () => {
  const state = store.emptyState();
  assert.throws(() => store.createLead(state, {}), store.ValidationError);
  assert.throws(() => store.createLead(state, { firstName: "A", stage: "nope" }), store.ValidationError);
  assert.throws(() => store.createLead(state, { firstName: "A", nextFollowUp: "tomorrow" }), store.ValidationError);
  store.createLead(state, { firstName: "A", profileUrl: "https://linkedin.com/in/a" });
  assert.throws(() => store.createLead(state, { firstName: "B", profileUrl: "linkedin.com/in/a/" }), /already/);
});

test("manual sector pins until cleared", () => {
  const state = store.emptyState();
  state.settings = settings();
  const l = store.createLead(state, { firstName: "A", company: "Gulf Bank" });
  assert.equal(store.updateLead(state, l.id, { sector: "Education" }).sector, "Education");
  assert.equal(store.updateLead(state, l.id, { notes: "x" }).sector, "Education");
  assert.equal(store.updateLead(state, l.id, { sector: "" }).sector, "Financial Services");
});

test("follower log upserts by date and stays sorted", () => {
  const state = store.emptyState();
  store.logFollowers(state, { date: "2026-10-05", profileFollowers: 900 });
  store.logFollowers(state, { date: "2026-09-28", profileFollowers: 850, pageFollowers: "" });
  store.logFollowers(state, { date: "2026-10-05", profileFollowers: 910 });
  assert.deepEqual(state.followerLog.map((e) => [e.date, e.profileFollowers]), [["2026-09-28", 850], ["2026-10-05", 910]]);
  assert.throws(() => store.logFollowers(state, { date: "2026-10-06" }), store.ValidationError);
});
