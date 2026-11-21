import { launch, session, step, assert, dialog, sql, BASE, DIR, PW, summary, NEWPW, walk } from "./lib.mjs";
import * as OTPAuth from "otpauth";
const stamp = String(Date.now()).slice(-6);
const b = await launch();
const tenant = sql(`select "tenantId" from "User" where email='waqas@networkintelligence.local'`);
const hashOf = sql(`select "passwordHash" from "User" where email='waqas@networkintelligence.local'`);
const cEmail = `contrib${stamp}@example.com`;
sql(`insert into "User" (id,"tenantId",email,name,role,"passwordHash","updatedAt") values ('e2e-c-${stamp}','${tenant}','${cEmail}','Casey Contributor','CONTRIBUTOR','${hashOf}',now())`);
const o = await session(b, "waqas@networkintelligence.local");
const c = await session(b, cEmail);
const ana = sql(`select email from "User" where email like 'ana%' order by "createdAt" desc limit 1`);
const m = await session(b, ana, NEWPW);
const og = (u) => o.goto(BASE + u, { waitUntil: "networkidle" });
const briefId = sql(`select id from "Brief" where "openToMembers" and "memberSummary" is not null order by "createdAt" desc limit 1`);
const anaId = sql(`select "personId" from "User" where email='${ana}'`);

const ONLY = process.env.ONLY; const realStep = step; const stepIf = (n, p, f) => (!ONLY || new RegExp(ONLY).test(n)) ? realStep(n, p, f) : null;
await stepIf("member: the agent asks whether to put them forward, and their yes reaches the team", m, async () => {
  assert(briefId, "an open brief exists");
  // Members do not browse roles or pitch: the agent brings a match to them and asks.
  sql(`delete from "AgentNote" where key='fit:${briefId}:${anaId}'`);
  sql(`insert into "AgentNote" (id,"tenantId",audience,"personId",key,kind,title,body,"briefId") values ('e2e-note-${stamp}','${tenant}','MEMBER','${anaId}','fit:${briefId}:${anaId}','fit','A role has come in that fits you: Fractional CFO · Dubai','Shall I put you forward? Your name is only shared with your yes.','${briefId}')`);
  await m.goto(`${BASE}/member?tab=opportunities`, { waitUntil: "networkidle" });
  const t = await m.locator("main").innerText();
  assert(!/Pitch with my profile/.test(t), "no pitching for members"); assert(!/E2E Client/.test(t), "client name leaked to member"); assert(!/AED 5,000|5,000 a day/.test(t), "the budget is not shown to members");
  const ask = m.locator('[data-note="fit"]').first(); assert(await ask.count(), "the agent's question is on their home");
  await ask.getByRole("button", { name: "Yes, put me forward" }).click(); await m.waitForLoadState("networkidle"); await m.waitForTimeout(1200);
  assert(Number(sql(`select count(*) from "Pitch" where "personId"='${anaId}' and "briefId"='${briefId}'`)) === 1, "their yes is a pitch on the requirement");
  assert(sql(`select count(*) from "AgentNote" where audience='OWNER' and key='answer:e2e-note-${stamp}'`) === "1", "the team is told");
});
  const t = await m.locator("main").innerText(); assert(/client name hidden/i.test(t), "client hidden"); assert(!/E2E Client/.test(t), "client name leaked to member");
  // Each opportunity says how it suits them, from what we know of them, never from the budget.
  assert(await m.locator("[data-fit]").count(), "suitability shown on opportunities");
  assert(!/AED 5,000|5,000 a day/.test(t), "the budget is not shown to members");
  await m.getByRole("button", { name: /Pitch with my profile/ }).first().click(); const d = dialog(m); await d.waitFor();
  await d.locator('[name="note"]').fill("I ran exactly this for a retail group last year and can start in March."); await d.getByRole("button", { name: "Send pitch" }).click(); await m.waitForTimeout(2000);
  assert(Number(sql(`select count(*) from "Pitch" where "personId"='${anaId}'`)) >= 1, "pitch row");
});
await stepIf("member: recommends someone", m, async () => {
  await m.goto(`${BASE}/member?tab=refer`, { waitUntil: "networkidle" });
  const f = m.locator("[data-guide]").filter({ hasText: "Recommend someone good" });
  const opps = sql(`select count(*) from "Brief" where "openToMembers" and "memberSummary" is not null and status not in ('FILLED','CLOSED')`) !== "0";
  await walk(f, ["Rae Stone" + stamp, { pick: "Seen their work" }, "Led the data migration for me. Careful, quick and well liked.", null, ...(opps ? [null] : []), { yes: true }], "Send referral");
  await m.waitForURL(/sent=1/, { timeout: 15000 });
  assert(sql(`select count(*) from "Referral" where name='Rae Stone${stamp}'`) === "1", "referral row");
  assert(sql(`select "knownHow" from "Referral" where name='Rae Stone${stamp}'`) === "seen", "how the member knows them is kept");
});
await stepIf("owner: triages the pitch and the referral", o, async () => {
  await og("/referrals?tab=pitches"); const add = o.getByRole("button", { name: "Add to shortlist" }); if (await add.count()) { await add.first().click(); await o.waitForTimeout(2000); }
  assert(Number(sql(`select count(*) from "Pitch" where "personId"='${anaId}' and status='SHORTLISTED'`)) >= 1, "pitch shortlisted");
  await og("/referrals"); const rid = sql(`select id from "Referral" where name='Rae Stone${stamp}'`);
  await o.locator("form").filter({ has: o.locator(`input[name="referralId"][value="${rid}"]`) }).filter({ has: o.locator('input[name="action"][value="accept"]') }).getByRole("button").click(); await o.waitForTimeout(2500);
  assert(sql(`select count(*) from "Person" where "firstName"='Rae' and "lastName"='Stone${stamp}'`) === "1", "referred person added to the network");
  assert(sql(`select status from "Referral" where name='Rae Stone${stamp}'`) !== "NEW", "referral triaged");
});
await stepIf("name release: contributor refused, owner needs consent, then it is audited", o, async () => {
  const item = sql(`select id from "ShortlistItem" where "briefId"='${briefId}' and "personId"='${anaId}'`); assert(item, "ana is on the shortlist");
  sql(`update "Person" set "referralConsent"='ask' where id='${anaId}'`); sql(`update "ShortlistItem" set decision='CLIENT_INTERESTED' where id='${item}'`);
  const form = (p) => p.locator("form").filter({ has: p.locator(`input[name="itemId"][value="${item}"]`) });
  // Each person on the shortlist is one line; the decision is inside it, so open their line first.
  const openRow = async (p) => { const row = p.locator("details").filter({ has: p.locator(`input[name="itemId"][value="${item}"]`) }); if (!(await row.evaluate((d) => d.open))) await row.locator("summary").click(); };
  await c.goto(`${BASE}/requirements/${briefId}`, { waitUntil: "networkidle" }); await openRow(c); await form(c).locator('select[name="decision"]').selectOption("INTRODUCED"); await form(c).locator('input[name="consentConfirmed"]').check(); await form(c).getByRole("button", { name: "Save" }).click();
  await c.waitForURL(/notice=reveal-role/, { timeout: 15000 }); assert(sql(`select decision from "ShortlistItem" where id='${item}'`) === "CLIENT_INTERESTED", "contributor could not release");
  await og(`/requirements/${briefId}`); await openRow(o); await form(o).locator('select[name="decision"]').selectOption("INTRODUCED"); await form(o).getByRole("button", { name: "Save" }).click();
  await o.waitForURL(/notice=reveal-consent/, { timeout: 15000 }); await o.getByText(/record that they have agreed/).waitFor(); await o.screenshot({ path: `${DIR}/reveal-notice.png` });
  assert(sql(`select decision from "ShortlistItem" where id='${item}'`) === "CLIENT_INTERESTED", "owner blocked without consent");
  await og(`/requirements/${briefId}`); await openRow(o); await form(o).locator('select[name="decision"]').selectOption("INTRODUCED"); await form(o).locator('input[name="consentConfirmed"]').check(); await form(o).getByRole("button", { name: "Save" }).click(); await o.waitForTimeout(2500);
  assert(sql(`select decision from "ShortlistItem" where id='${item}'`) === "INTRODUCED", "released with consent");
  assert(Number(sql(`select count(*) from "AuditLog" where action='identity.reveal' and metadata->>'personId'='${anaId}'`)) >= 1, "identity.reveal audited");
});
await stepIf("session ends at once when a role changes", o, async () => {
  await og("/settings/security"); const row = o.locator("tr").filter({ hasText: cEmail }); await row.locator('select[name="role"]').selectOption("ADMIN"); await row.getByRole("button", { name: "Set" }).click(); await o.waitForTimeout(1500);
  assert(sql(`select role, "sessionVersion" from "User" where email='${cEmail}'`) === "ADMIN|1", "role changed and sessions revoked");
  await c.goto(`${BASE}/network`, { waitUntil: "networkidle" }); assert(/\/login/.test(c.url()), "old session signed out, at " + c.url()); assert(await c.getByText(/signed out because your account changed/).count(), "explains why");
});
await stepIf("partner: portal shows keyed references, never names or ids", null, async () => {
  const p = await session(b, "partner@harboursearch.local"); await p.goto(`${BASE}/partner-portal`, { waitUntil: "networkidle" }); await p.screenshot({ path: `${DIR}/partner-portal.png`, fullPage: true });
  const html = await p.content(); for (const id of sql(`select id from "Person" limit 60`).split("\n")) assert(!html.includes(id), "person id in partner page: " + id);
  await p.goto(`${BASE}/portal`, { waitUntil: "networkidle" }); const html2 = await p.content(); for (const id of sql(`select id from "Person" limit 60`).split("\n")) assert(!html2.includes(id), "person id in portal page: " + id);
  await p.goto(`${BASE}/portal`, { waitUntil: "networkidle" }); assert(!(await p.locator("header, nav").getByText(/Agencies|Amana Expert Network|Commercials/).count()), "the team's section tabs are shown to a partner");
  for (const u of ["/network", "/invite", "/overview", "/member", "/partners"]) { await p.goto(BASE + u, { waitUntil: "domcontentloaded" }); assert(/forbidden/.test(p.url()), u + " open to partner"); }
  if (p.errs.length) throw new Error(p.errs.join("; ")); await p.context().close();
});
await stepIf("client: workspace and portal load, internal areas closed", null, async () => {
  const p = await session(b, "client@meridian.local"); await p.goto(`${BASE}/client-workspace`, { waitUntil: "networkidle" }); await p.screenshot({ path: `${DIR}/client.png`, fullPage: true });
  const html = await p.content(); for (const id of sql(`select id from "Person" limit 60`).split("\n")) assert(!html.includes(id), "person id in client page");
  await p.goto(`${BASE}/portal`, { waitUntil: "networkidle" }); await walk(p.locator("[data-guide]"), ["A head of procurement in London", { pick: "Permanent" }, "London", { pick: "In the next three months" }, "£120k", null], "See how we read it"); await p.waitForLoadState("networkidle");
  await p.getByRole("button", { name: "Send requirement" }).click(); await p.waitForTimeout(2500);
  assert(Number(sql(`select count(*) from "Brief" where "submittedVia"='PORTAL' and "createdAt" > now() - interval '1 minute'`)) >= 1, "portal brief created");
  for (const u of ["/network", "/invite", "/requirements", "/settings/commercials"]) { await p.goto(BASE + u, { waitUntil: "domcontentloaded" }); assert(/forbidden/.test(p.url()), u + " open to client"); }
  if (p.errs.length) throw new Error(p.errs.join("; ")); await p.context().close();
});
await stepIf("MFA: enrol, sign in with a code, replay refused, device cannot be swapped silently", null, async () => {
  const email = `mfa${stamp}@example.com`; sql(`insert into "User" (id,"tenantId",email,name,role,"passwordHash","updatedAt") values ('e2e-m-${stamp}','${tenant}','${email}','Morgan Mfa','CONTRIBUTOR','${hashOf}',now())`);
  const p = await session(b, email); await p.goto(`${BASE}/settings/security`, { waitUntil: "networkidle" }); await p.getByRole("button", { name: "Set up MFA" }).click();
  const secret = (await p.locator("span.font-mono.break-all").innerText()).trim();
  assert(sql(`select "mfaSecret" is null, "mfaPendingSecret" like 'enc:v1:%' from "User" where email='${email}'`) === "t|t", "pending secret stored encrypted, live secret untouched");
  const totp = new OTPAuth.TOTP({ issuer: "Network Intelligence", label: email, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
  const code = totp.generate(); await p.locator('input[inputmode="numeric"]').fill(code); await p.getByRole("button", { name: "Turn on MFA" }).click(); await p.getByText(/recovery codes/i).waitFor({ timeout: 15000 });
  const rec = (await p.locator(".font-mono.tabular span, .tabular span").first().innerText()).trim(); assert(/^[0-9A-F]{5}(-[0-9A-F]{5}){3}$/.test(rec), "long recovery code: " + rec);
  assert(sql(`select "mfaEnabled", "mfaSecret" like 'enc:v1:%' from "User" where email='${email}'`) === "t|t", "enabled, secret encrypted at rest");
  await p.context().close();
  const q = await (await b.newContext()).newPage(); const attempt = async (c) => { await q.goto(`${BASE}/login`, { waitUntil: "networkidle" }); await q.fill('input[name="email"]', email); await q.fill('input[name="password"]', PW); const ci = q.locator('input[name="code"]'); if (c && await ci.count()) { await q.getByText("I use an authenticator app").click(); await ci.fill(c); } await q.click('button[type="submit"]'); await q.waitForTimeout(2500); return !/\/login/.test(q.url()); };
  assert(!(await attempt("")), "password alone is not enough");
  assert(!(await attempt(code)), "the code used to enrol cannot be replayed");
  assert(await attempt(rec), "a recovery code signs in");
  await q.context().clearCookies(); assert(!(await attempt(rec)), "a recovery code works once");
  await q.context().close();
});
await stepIf("sign-in: ten wrong passwords pause the account", null, async () => {
  const email = `lock${stamp}@example.com`; sql(`insert into "User" (id,"tenantId",email,name,role,"passwordHash","updatedAt") values ('e2e-l-${stamp}','${tenant}','${email}','Lee Locked','CONTRIBUTOR','${hashOf}',now())`);
  // A client address of its own, as every real visitor has behind the hosting platform.
  const q = await (await b.newContext({ extraHTTPHeaders: { "x-real-ip": "203.0.113." + (Number(stamp) % 250) } })).newPage();
  for (let i = 0; i < 10; i++) { await q.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await q.fill('input[name="email"]', email); await q.fill('input[name="password"]', "wrong-password-" + i); await q.click('button[type="submit"]'); await q.waitForURL(/error=/, { timeout: 15000 }); }
  const st = sql(`select "lockedUntil" > now(), (select count(*) from "AuditLog" where action='auth.login_failed' and "actorId"='e2e-l-${stamp}') from "User" where email='${email}'`);
  assert(/^t\|/.test(st), "account locked: " + st);
  await q.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }); await q.fill('input[name="email"]', email); await q.fill('input[name="password"]', PW); await q.click('button[type="submit"]'); await q.waitForTimeout(2500);
  assert(/\/login/.test(q.url()), "correct password refused while locked"); await q.screenshot({ path: `${DIR}/locked.png` }); await q.context().close();
  return st;
});
summary(); await b.close();
