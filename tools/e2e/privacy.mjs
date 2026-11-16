import { launch, session, step, assert, sql, BASE, DIR, summary, NEWPW } from "./lib.mjs";
const a1 = sql(`select email from "User" where email like 'ana%' order by "createdAt" desc limit 1`);
const b = await launch();
const m1 = await session(b, a1, NEWPW);
const o = await session(b, "waqas@networkintelligence.local");
let memberLink;
await step("member: export leaves out team notes; consents; deletion request hides them", m1, async () => {
  await m1.goto(`${BASE}/member?tab=refer`, { waitUntil: "networkidle" });
  memberLink = await m1.locator('input[aria-label="Invitation link"]').first().inputValue();
  await m1.goto(`${BASE}/member?tab=privacy`, { waitUntil: "networkidle" });
  const [dl] = await Promise.all([m1.waitForEvent("download", { timeout: 15000 }), m1.getByRole("button", { name: /Download my data/i }).first().click()]);
  const fs = await import("node:fs"); const txt = fs.readFileSync(await dl.path(), "utf8");
  assert(!/relationshipNotes|networkOwnerId|tenantId|rawNotes|CAUTION|nextAction/.test(txt), "export contains internal fields"); assert(/"about"/.test(txt) && txt.includes(a1), "export has their own data");
  await m1.getByRole("button", { name: "Save permissions" }).click(); await m1.waitForTimeout(1200);
  await m1.getByRole("button", { name: "Delete my data" }).click();
  await m1.locator('input[name="confirm"]').fill("DELETE"); await m1.getByRole("button", { name: "Request deletion" }).click(); await m1.waitForTimeout(1500);
  assert(sql(`select privacy->>'erasureRequestedAt' is not null, "referralConsent" from "Person" where email='${a1}'`) === "t|no", "erasure recorded");
  assert(sql(`select count(*) from "Invite" i join "Person" p on p.id=i."inviterPersonId" where p.email='${a1}' and i.status in ('SENT','OPENED')`) === "0", "their open invitations revoked");
  const c = await b.newContext(); const p = await c.newPage(); await p.goto(memberLink, { waitUntil: "networkidle" }); assert(await p.getByText("no longer open").count(), "leaving member's link stops working"); await c.close();
  await m1.screenshot({ path: `${DIR}/member-erasing.png`, fullPage: true });
});
await step("consent enforced outward: a person who asked to be deleted disappears from the client portal", o, async () => {
  const pid = sql(`select id from "Person" where email='${a1}'`);
  const acct = sql(`select id from "CommercialAccount" where "portalEnabled" order by "createdAt" limit 1`);
  const brief = sql(`select id from "Brief" where "accountId"='${acct}' order by "createdAt" desc limit 1`); assert(brief, "a brief on a portal account");
  sql(`insert into "ShortlistItem" (id,"briefId","personId","fitScore","fitExplanation",dimensions,checks,tier,decision,"updatedAt") values ('e2e-sl-${Date.now()}','${brief}','${pid}',80,'e2e','[]','[]','meets','PROPOSED',now()) on conflict do nothing`);
  await o.goto(`${BASE}/portal?account=${acct}`, { waitUntil: "networkidle" });
  const hidden = await o.locator("main").innerText();
  await m1.goto(`${BASE}/member?tab=privacy`, { waitUntil: "networkidle" }); await m1.getByRole("button", { name: /Keep my profile/ }).click(); await m1.waitForTimeout(1500);
  assert(sql(`select privacy->>'erasureRequestedAt' is null from "Person" where email='${a1}'`) === "t", "erasure cancelled");
  // cancelling restores the profile but not the referral consent, which they set back themselves
  sql(`update "Person" set "referralConsent"='ask' where id='${pid}'`);
  await o.goto(`${BASE}/portal?account=${acct}`, { waitUntil: "networkidle" });
  const shown = await o.locator("main").innerText();
  const count = (t) => (t.match(/NI-[0-9A-F]{8}/g) || []).length;
  assert(count(shown) === count(hidden) + 1, `card hidden while deleting (${count(hidden)}) and back after (${count(shown)})`);
  await o.screenshot({ path: `${DIR}/portal.png`, fullPage: true });
});
summary(); await b.close();
