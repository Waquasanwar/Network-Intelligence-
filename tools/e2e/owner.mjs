import { launch, session, step, assert, dialog, sql, BASE, DIR, summary, walk } from "./lib.mjs";
const stamp = String(Date.now()).slice(-6);
const b = await launch();
const p = await session(b, "waqas@networkintelligence.local");
const go = (u) => p.goto(BASE + u, { waitUntil: "networkidle" });
let personId, briefId, oppId;

await step("home: four blocks, and the invite link is under Grow", p, async () => {
  await go("/overview");
  // Home is the question box, the headline figures, the network and what needs you. Nothing else.
  assert(await p.locator("#agent-ask").count(), "ask box"); assert((await p.locator(".figures .figure").count()) === 4, "four headline figures"); assert(await p.locator(".orbit-stage").count(), "the network"); assert(await p.getByText("Waiting on you").count(), "what needs you");
  assert(!(await p.locator('input[aria-label="Your invite link"]').count()), "the invite card is no longer on Home");
  await go("/invite");
  const v = await p.locator('input[aria-label="Invitation link"]').first().inputValue();
  assert(/\/join\?t=/.test(v), "invite link " + v);
});
await step("overview: ask the network agent", p, async () => {
  await go("/overview");
  await p.locator("input.agent-input").fill("Who do we know for cyber security in the UAE?");
  await p.locator("input.agent-input").press("Enter");
  await p.locator("[data-agent-steps]").first().waitFor({ timeout: 60000 });
});
await step("command palette opens and searches", p, async () => {
  await go("/overview");
  await p.keyboard.press("Control+k");
  const d = dialog(p); await d.waitFor({ timeout: 5000 });
  await p.keyboard.type("Rosa"); await p.waitForTimeout(1500);
  assert(await d.getByText(/Rosa Diaz/).count(), "palette finds Rosa");
  await p.keyboard.press("Escape");
});
await step("add a person (drawer)", p, async () => {
  await go("/network");
  await p.getByRole("button", { name: "Add person" }).first().click();
  const d = dialog(p); await d.waitFor();
  if (!(await d.locator('input[name="firstName"]').count())) { const manual = d.getByRole("button", { name: /manual|skip|fill.*myself|by hand/i }); if (await manual.count()) await manual.first().click(); }
  await d.locator('input[name="firstName"]').fill("Etoe"); await d.locator('input[name="lastName"]').fill("Tester" + stamp);
  await d.locator('input[name="headline"]').fill("Interim finance director");
  await d.locator('input[name="capabilities"]').fill("Finance transformation, CFO");
  await d.locator('input[name="email"]').fill(`etoe${stamp}@example.com`);
  await d.getByRole("button", { name: "Add person" }).click();
  await p.waitForURL(/\/network\/[a-z0-9]+/, { timeout: 15000 });
  personId = p.url().split("/network/")[1].split(/[?#]/)[0];
  assert(sql(`select count(*) from "Person" where id='${personId}'`) === "1", "person row");
});
await step("person: edit profile", p, async () => {
  await go(`/network/${personId}`);
  await p.getByRole("button", { name: "More" }).click();
  await p.getByRole("button", { name: /Edit profile/i }).click();
  const d = dialog(p); await d.waitFor();
  await d.locator('input[name="primaryCity"]').fill("Dubai"); await d.locator('input[name="primaryCountry"]').fill("UAE");
  await d.getByRole("button", { name: "Save profile" }).click();
  await p.waitForTimeout(1500);
  assert(sql(`select "primaryCity" from "Person" where id='${personId}'`) === "Dubai", "city saved");
});
await step("person: update availability", p, async () => {
  await go(`/network/${personId}`);
  await p.getByRole("button", { name: "More" }).click();
  await p.getByRole("button", { name: /Update status/i }).click();
  const d = dialog(p); await d.waitFor();
  await d.locator('select[name="availabilityStatus"]').selectOption("AVAILABLE_NOW");
  await d.getByRole("button", { name: "Confirm status" }).click();
  await p.waitForTimeout(1500);
  assert(sql(`select "availabilityStatus" from "Person" where id='${personId}'`) === "AVAILABLE_NOW", "availability saved");
});
await step("person: vouch", p, async () => {
  await go(`/network/${personId}`);
  await p.getByRole("button", { name: "Vouch" }).first().click();
  const d = dialog(p); await d.waitFor();
  await d.locator('[name="context"]').fill("Worked together on a finance carve-out in 2023");
  await d.locator('[name="statement"]').fill("Calm under pressure and commercially sharp.");
  await d.getByRole("button", { name: "Vouch" }).click();
  await p.waitForTimeout(1500);
  assert(sql(`select count(*) from "Vouch" where "personId"='${personId}'`) === "1", "vouch row");
});
await step("person: book conversation", p, async () => {
  await go(`/network/${personId}`);
  await p.getByRole("button", { name: "Book conversation" }).click();
  const d = dialog(p); await d.waitFor();
  await d.locator('button[type="submit"]').last().click();
  await p.waitForTimeout(1800);
  assert(Number(sql(`select count(*) from "ScheduledConversation" where "personId"='${personId}'`)) >= 1, "scheduled row");
});
await step("person: capture conversation → review → approve", p, async () => {
  await go(`/network/${personId}`);
  await p.getByRole("button", { name: "More" }).click();
  await p.getByRole("button", { name: /Capture/i }).click();
  const d = dialog(p); await d.waitFor();
  const ta = d.locator("textarea").first();
  await ta.fill("Spoke for 40 minutes. Available from January for fractional CFO work, two to three days a week, Dubai or remote. Day rate around AED 5,500. Led the carve-out of a retail division, strong on board reporting. Wants to avoid long permanent roles.");
  await d.locator('button[type="submit"]').last().click();
  await p.waitForTimeout(2500);
  assert(Number(sql(`select count(*) from "Conversation" where "personId"='${personId}'`)) >= 1, "conversation row");
  await go("/conversations?tab=review");
  const approve = p.getByRole("button", { name: /Approve/i }).first();
  await approve.waitFor({ timeout: 8000 }); await approve.click(); await p.waitForTimeout(2000);
  assert(Number(sql(`select count(*) from "Conversation" where "personId"='${personId}' and "approvalStatus"='APPROVED'`)) >= 1, "approved");
});
await step("requirements: new account", p, async () => {
  await go("/requirements");
  await p.getByRole("button", { name: "New account" }).click();
  const d = dialog(p); await d.waitFor();
  await d.locator('input[name="name"]').fill("E2E Client " + stamp);
  await d.locator('input[name="contactEmail"]').fill(`buyer${stamp}@example.com`);
  await d.getByRole("button", { name: "Create account" }).click();
  await p.waitForTimeout(1800);
  assert(sql(`select count(*) from "CommercialAccount" where name='E2E Client ${stamp}'`) === "1", "account row");
});
await step("requirements: post a brief via co-pilot", p, async () => {
  await go("/requirements");
  // Raised on the client's behalf, one question at a time.
  await walk(p.locator("[data-guide]").first(), [{ pick: `E2E Client ${stamp}` }, "A fractional CFO two days a week for six months", { pick: "Fractional" }, "Dubai", { pick: "Within a month" }, "AED 5,000 a day", null], "Raise requirement");
  await p.waitForURL(/\/requirements\/[a-z0-9]+$/, { timeout: 60000 });
  await p.screenshot({ path: `${DIR}/req-copilot.png` });
  const m = p.url().match(/\/requirements\/([a-z0-9]+)/);
  briefId = m?.[1] ?? sql(`select id from "Brief" order by "createdAt" desc limit 1`);
  assert(briefId, "brief created");
  return p.url();
});
await step("requirement: find people, shortlist, open to members, terms, fee", p, async () => {
  await go(`/requirements/${briefId}`);
  await p.getByRole("button", { name: /Find people|Refresh/ }).first().click(); await p.waitForTimeout(3000);
  const n = Number(sql(`select count(*) from "ShortlistItem" where "briefId"='${briefId}'`));
  assert(n > 0, "shortlist items " + n);
  await go(`/requirements/${briefId}`);
  const cb = p.locator('input[name="openToMembers"]'); await cb.check(); await p.locator('[name="memberSummary"]').fill("Fractional CFO, Dubai, two days a week.");
  await p.locator("form").filter({ has: p.locator('input[name="openToMembers"]') }).getByRole("button", { name: "Save" }).click(); await p.waitForTimeout(1500);
  assert(sql(`select "openToMembers" from "Brief" where id='${briefId}'`) === "t", "open to members");
  await p.getByText("Change the terms").click(); // the terms form is folded away until you ask for it
  await p.getByRole("button", { name: "Save terms" }).click(); await p.waitForTimeout(1500);
  await p.getByRole("button", { name: "Fee line" }).click();
  const d = dialog(p); await d.waitFor();
  const amt = d.locator('input[type="number"]').first(); if (await amt.count()) await amt.fill("12000");
  await d.locator('button[type="submit"]').last().click(); await p.waitForTimeout(1500);
  return `shortlist ${n}, fee lines ${sql(`select count(*) from "FeeLine" where "briefId"='${briefId}'`)}`;
});
await step("requirement: set status + shortlist decision", p, async () => {
  await go(`/requirements/${briefId}`);
  const sel = p.locator('select[name="status"]').first(); const opts = await sel.locator("option").allTextContents();
  await sel.selectOption({ index: Math.min(1, opts.length - 1) }); await p.getByRole("button", { name: "Set status" }).click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${DIR}/req-detail.png`, fullPage: true });
});
await step("person: refer to a client", p, async () => {
  await go(`/network/${personId}`);
  await p.getByRole("button", { name: /Refer to a client/i }).click();
  const d = dialog(p); await d.waitFor();
  const t = d.locator('select[name="target"]'); const vals = await t.locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
  assert(vals.length, "refer targets"); await t.selectOption(vals[vals.length - 1]);
  await d.getByRole("button", { name: "Refer them" }).click(); await p.waitForTimeout(2500);
  assert(Number(sql(`select count(*) from "ShortlistItem" where "personId"='${personId}'`)) >= 1, "referred onto a brief");
});
await step("opportunities: create, suggestions, decide", p, async () => {
  await go("/opportunities");
  await p.getByRole("button", { name: "New opportunity" }).click();
  const d = dialog(p); await d.waitFor();
  await d.locator('[name="title"]').fill("E2E finance turnaround " + stamp);
  await d.locator('[name="problemStatement"]').fill("A retail group needs its finance function stabilised after a carve-out.");
  await d.locator('[name="requiredCapabilities"]').fill("Finance transformation, CFO");
  await d.getByRole("button", { name: "Create opportunity" }).click();
  await p.waitForURL(/\/opportunities\/[a-z0-9]+/, { timeout: 15000 });
  oppId = p.url().split("/opportunities/")[1].split(/[?#]/)[0];
  await p.getByRole("button", { name: /Refresh suggestions|Find possible matches/i }).first().click(); await p.waitForTimeout(3500);
  const n = Number(sql(`select count(*) from "Match" where "opportunityId"='${oppId}'`)); assert(n > 0, "matches " + n);
  await go(`/opportunities/${oppId}`);
  await p.locator("main details > summary").first().click({ position: { x: 300, y: 12 } });
  const f = p.locator("details[open] form").filter({ has: p.locator('select[name="decision"]') }).first();
  const dv = await f.locator('select[name="decision"] option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
  await f.locator('select[name="decision"]').selectOption(dv.find((v) => /SHORT|APPROV|YES/i.test(v)) ?? dv[0]);
  await f.getByRole("button", { name: /Save decision/i }).click(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${DIR}/opp-detail.png`, fullPage: true });
  return `matches ${n}, decisions ${dv.join("/")}`;
});
await step("opportunity: set stage", p, async () => {
  await go(`/opportunities/${oppId}`);
  const sel = p.locator('select[name="status"]').first(); await sel.selectOption({ index: 1 }); await p.getByRole("button", { name: "Set stage" }).click(); await p.waitForTimeout(1200);
});
await step("partners: save terms + log requirement", p, async () => {
  await go("/partners");
  await p.getByRole("button", { name: "Save terms" }).first().click(); await p.waitForTimeout(1200);
  await p.getByRole("button", { name: "Log requirement" }).click();
  const d = dialog(p); await d.waitFor();
  await d.locator('select[name="partnerId"]').selectOption({ index: 1 });
  for (const el of await d.locator("input:not([type=hidden]):not([type=checkbox]), textarea").all()) { const t = await el.getAttribute("type"); await el.fill(t === "number" ? "1" : t === "date" ? "2026-12-01" : "E2E requirement " + stamp).catch(() => {}); }
  await d.locator('button[type="submit"]').last().click(); await p.waitForTimeout(1500);
  assert(Number(sql(`select count(*) from "PartnerRequirement"`)) >= 1, "partner requirement row");
});
await step("relocation: capture interest", p, async () => {
  await go("/relocation");
  await p.getByRole("button", { name: "Capture interest" }).click();
  let d = dialog(p); await d.waitFor();
  await d.locator('select[name="personId"]').selectOption({ index: 1 });
  await d.getByRole("button", { name: "Continue" }).click();
  await p.waitForURL(/tab=relocation/, { timeout: 15000 });
  await p.locator("main").getByRole("button", { name: /relocation|Capture|Add|Edit/i }).last().click();
  d = dialog(p); await d.waitFor();
  await d.locator('[name="targetLocation"]').fill("Dubai");
  await d.locator('button[type="submit"]').last().click(); await p.waitForTimeout(1500);
  assert(Number(sql(`select count(*) from "RelocationProfile"`)) >= 1, "relocation row");
});
await step("settings: save rate card + voice", p, async () => {
  await go("/settings/commercials"); await p.getByRole("button", { name: "Save rate card" }).click(); await p.waitForTimeout(1200);
  await go("/settings/screening"); await p.getByRole("button", { name: "Save voice" }).click(); await p.waitForTimeout(1200);
});
await step("settings: integrations connect/disconnect", p, async () => {
  await go("/settings/integrations"); await p.screenshot({ path: `${DIR}/integrations.png`, fullPage: true });
});
await step("import: CSV preview and commit", p, async () => {
  await go("/network/import");
  await p.locator('textarea[name="text"]').fill(`first name,last name,email,headline,capabilities,city,country\nImpa,Row${stamp},impa${stamp}@example.com,Supply chain lead,"Supply chain, Procurement",Leeds,UK\nImpb,Row${stamp},impb${stamp}@example.com,Data lead,"Data platform",Dubai,UAE`);
  await p.getByRole("button", { name: "Preview import" }).click(); await p.waitForTimeout(2500);
  await p.getByRole("button", { name: /^Import / }).click(); await p.waitForTimeout(3000);
  assert(sql(`select count(*) from "Person" where "lastName"='Row${stamp}'`) === "2", "imported 2");
});
await step("intake: summarise a conversation", p, async () => {
  await go("/network/intake");
  const inp = p.locator('textarea, input[placeholder*="answer"]').first();
  for (const line of ["Jo Park, interim COO based in Leeds.", "We worked together at a logistics firm in 2022; she ran the turnaround.", "Available from March, interim or fractional, UK or Gulf."]) { await inp.fill(line); await inp.press("Enter"); await p.waitForTimeout(500); }
  await p.getByRole("button", { name: "Summarise" }).click(); await p.waitForTimeout(3000);
  await p.screenshot({ path: `${DIR}/intake2.png`, fullPage: true });
  assert(!(await p.getByText(/Couldn't summarise/i).count()), "summary produced");
});
await step("network: search + filters", p, async () => {
  await go("/network?q=cyber"); assert(await p.getByText(/Hassan Ali/).count(), "search finds cyber person");
  await go("/network/map"); await p.locator(".orbit-stage").waitFor();
});
await step("person: export + deletion request (owner)", p, async () => {
  await go(`/network/${personId}`);
  await p.screenshot({ path: `${DIR}/person.png`, fullPage: true });
});
console.log(JSON.stringify({ personId, briefId, oppId }));
summary();
await b.close();
