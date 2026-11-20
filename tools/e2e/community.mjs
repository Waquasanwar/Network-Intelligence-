import { launch, session, step, assert, sql, BASE, DIR, NEWPW, summary, walk } from "./lib.mjs";

/**
 * The trust framework, the members' community board, referral shares and client search. Runs after
 * the network journey, which creates the members it uses (Ana, screened; Cy, registered).
 */
const b = await launch();
const until = async (ok, ms = 12000) => { for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 250))) if (ok()) return true; return ok(); };
const tenant = sql(`select "tenantId" from "User" where email='waqas@networkintelligence.local'`);
const ana = sql(`select u.email || '|' || u."personId" from "User" u join "Person" p on p.id=u."personId" where u.email like 'ana%@example.com' and p."screeningStatus"='APPROVED' order by u."createdAt" desc limit 1`).split("|");
const cy = sql(`select u.email || '|' || u."personId" from "User" u where u.email like 'cy%@example.com' order by u."createdAt" desc limit 1`).split("|");
const person = sql(`select p.id from "Person" p join "Relationship" r on r."personId"=p.id where p."tenantId"='${tenant}' and r."workedTogether" order by p."createdAt" limit 1`);
const STAMP = Date.now().toString(36), TITLE = `E2E board work ${STAMP}`;
const o = await session(b, "waqas@networkintelligence.local");

await step("framework: 22 checks in five areas behind the score, and a check you confirm records who and when", o, async () => {
  sql(`update "Person" set checks=null where id='${person}'`);
  await o.goto(`${BASE}/network/${person}`, { waitUntil: "networkidle" });
  const fw = o.locator("[data-framework]");
  assert((await fw.locator("[data-area]").count()) === 5, "five areas");
  assert((await fw.locator("[data-check]").count()) === 22, "22 checks");
  const before = Number(await fw.getAttribute("data-framework"));
  await fw.locator('[data-area="identity"] summary').click();
  const form = fw.locator('[data-check="linkedin"] form');
  await form.locator('input[name="note"]').fill("Matches the history they gave"); await form.getByRole("button", { name: "Mark as checked" }).click();
  await o.waitForFunction((b4) => Number(document.querySelector("[data-framework]")?.getAttribute("data-framework")) === b4 + 1, before, { timeout: 30000 });
  assert(/Checked by Waqas Anwar/.test(await fw.locator('[data-check="linkedin"]').innerText()), "who checked it");
  assert(/"linkedin"/.test(sql(`select checks::text from "Person" where id='${person}'`)), "stored on the person");
  await fw.locator('[data-check="linkedin"]').getByRole("button", { name: "Undo" }).click();
  await o.waitForFunction((b4) => Number(document.querySelector("[data-framework]")?.getAttribute("data-framework")) === b4, before, { timeout: 30000 });
  return `${before} of 22 held`;
});

await step("community: a member who is not yet screened sees the door, not the board", null, async () => {
  sql(`update "Person" set "screeningStatus"='REGISTERED', "screenedAt"=null where id='${cy[1]}'`);
  const m = await session(b, cy[0], NEWPW);
  await m.goto(`${BASE}/community`, { waitUntil: "networkidle" });
  assert(await m.getByText("Opens once your screening is accepted").isVisible(), "gated");
  await m.context().close();
});

let m1, m2;
await step("community: a member shares work, and it lands in your Requirements as a lead", null, async () => {
  sql(`update "Person" set "screeningStatus"='APPROVED', "screenedAt"=now(), "referralConsent"='yes' where id='${cy[1]}'`);
  m1 = await session(b, ana[0], NEWPW);
  await m1.goto(`${BASE}/community`, { waitUntil: "networkidle" });
  // One question at a time. Work goes up only once they agree it is introduced through the network.
  const g = m1.locator("[data-guide]").first();
  await walk(g, [{ pick: "Work I know about" }, TITLE, "An energy group needs an interim finance transformation lead for six months in Dubai.", { pick: "Interim" }, null]);
  assert(/before it goes up/.test(await g.locator(".guide-ask").innerText()), "asked to agree first");
  assert(!(await g.getByRole("button", { name: "Post" }).count()), "nothing to post before agreeing");
  assert(sql(`select count(*) from "BoardPost" where title='${TITLE}'`) === "0", "not posted without agreeing");
  await walk(g, [{ yes: true }], "Post"); await m1.waitForURL(/notice=posted/, { timeout: 60000 });
  const lead = sql(`select b."submittedVia" || '|' || b.status from "BoardPost" p join "Brief" b on b.id=p."briefId" where p.title='${TITLE}'`);
  assert(lead === "BOARD|NEW", "a new lead from the board: " + lead);
  await m1.screenshot({ path: `${DIR}/community-board.png`, fullPage: true });
});

await step("community: another member says they are interested and refers someone, both reaching you", null, async () => {
  m2 = await session(b, cy[0], NEWPW);
  await m2.goto(`${BASE}/community`, { waitUntil: "networkidle" });
  const post = m2.locator("[data-post]").filter({ hasText: TITLE });
  await post.getByRole("button", { name: /interested/ }).click(); await m2.waitForURL(/notice=interested/, { timeout: 30000 });
  const brief = sql(`select "briefId" from "BoardPost" where title='${TITLE}'`);
  assert(sql(`select count(*) from "Pitch" where "briefId"='${brief}' and "personId"='${cy[1]}'`) === "1", "interest recorded as a pitch on the lead");
  const p2 = m2.locator("[data-post]").filter({ hasText: TITLE });
  await p2.locator("summary").filter({ hasText: "Refer someone" }).click();
  await walk(p2.locator("[data-guide]"), [`Omar Refer${STAMP}`, "Ran our finance systems change last year", null], "Send referral"); await m2.waitForURL(/notice=referred/, { timeout: 30000 });
  assert(sql(`select count(*) from "Referral" where "briefId"='${brief}' and "referrerPersonId"='${cy[1]}'`) === "1", "referral on the lead");
});

await step("community: members who chose to be seen can connect, and only then see each other's email", null, async () => {
  for (const m of [m1, m2]) { await m.goto(`${BASE}/community?tab=members`, { waitUntil: "networkidle" }); const on = m.getByRole("button", { name: "Show me to other members" }); if (await on.count()) { await on.click(); await m.waitForURL(/tab=members/); await m.waitForLoadState("networkidle"); } }
  await m1.goto(`${BASE}/community?tab=members`, { waitUntil: "networkidle" });
  const row = m1.locator("[data-member]").filter({ hasText: /Okafor/ });
  assert(await row.count(), "Cy is listed for Ana");
  assert(!/@example\.com/.test(await m1.locator("main").innerText()), "no email before connecting");
  await row.getByRole("button", { name: "Connect" }).click(); await m1.waitForURL(/notice=asked/, { timeout: 30000 });
  await m2.goto(`${BASE}/community?tab=connections`, { waitUntil: "networkidle" });
  await m2.getByRole("button", { name: "Accept" }).first().click();
  // The page is already on this tab, so wait for the acceptance to be saved rather than for a URL.
  assert(await until(() => sql(`select count(*) from "Connection" where status='ACCEPTED' and "toPersonId" in ('${ana[1]}','${cy[1]}')`) !== "0", 15000), "connection accepted");
  await m1.goto(`${BASE}/community?tab=connections`, { waitUntil: "networkidle" });
  assert(new RegExp(cy[0].replace(/[.]/g, "\\.")).test(await m1.locator("[data-thread]").innerText()), "email shared once accepted");
});

await step("community: connected members message each other privately, and replies on a post are open to all", null, async () => {
  const words = `Good to meet you ${STAMP}`;
  await m1.locator("[data-thread]").getByLabel(/^Message /).fill(words); await m1.getByRole("button", { name: "Send message" }).click();
  await m1.waitForURL(/tab=connections&with=/, { timeout: 30000 });
  await m1.locator("[data-message]").filter({ hasText: words }).waitFor({ timeout: 20000 }); // shown in the sender's thread
  assert(sql(`select count(*) from "AuditLog" where action='message.send' and metadata::text like '%${STAMP}%'`) === "0", "what was written is not in the audit log");
  await m2.goto(`${BASE}/community`, { waitUntil: "networkidle" });
  assert(/1/.test(await m2.getByRole("link", { name: /^Connections/ }).first().innerText()), "unread shown on the tab");
  await m2.goto(`${BASE}/community?tab=connections`, { waitUntil: "networkidle" });
  assert(await m2.locator("[data-message]").filter({ hasText: words }).count(), "the other member reads it");
  assert(sql(`select count(*) from "MemberMessage" where body='${words}' and "readAt" is not null`) === "1", "marked read once opened");
  // A reply on the board, under the post, for every member.
  await m2.goto(`${BASE}/community`, { waitUntil: "networkidle" });
  const post = m2.locator("[data-post]").filter({ hasText: TITLE });
  await post.getByLabel(/^Reply to/).fill("I know two people for this. Sending them your way."); await post.getByRole("button", { name: "Send reply" }).click();
  assert(await until(() => sql(`select count(*) from "BoardReply" r join "BoardPost" p on p.id=r."postId" where p.title='${TITLE}'`) === "1"), "reply saved");
  await m1.goto(`${BASE}/community`, { waitUntil: "networkidle" });
  assert(await m1.locator("[data-post]").filter({ hasText: TITLE }).locator("[data-reply]").filter({ hasText: "two people" }).count(), "the author sees the reply");
});

await step("referral share: placing someone from a member's lead credits that member, and you mark it paid", o, async () => {
  const brief = sql(`select "briefId" from "BoardPost" where title='${TITLE}'`);
  const item = sql(`select id from "ShortlistItem" where "briefId"='${brief}' and "personId"<>'${ana[1]}' order by "fitScore" desc limit 1`); assert(item, "someone on the lead's shortlist");
  await o.goto(`${BASE}/requirements/${brief}`, { waitUntil: "networkidle" });
  const row = o.locator("details").filter({ has: o.locator(`input[name="itemId"][value="${item}"]`) });
  if (!(await row.evaluate((d) => d.open))) await row.locator("summary").click();
  const form = o.locator("form").filter({ has: o.locator(`input[name="itemId"][value="${item}"]`) });
  await form.locator('select[name="decision"]').selectOption("PLACED");
  if (await form.locator('input[name="consentConfirmed"]').count()) await form.locator('input[name="consentConfirmed"]').check();
  await form.getByRole("button", { name: "Save" }).click();
  assert(await until(() => sql(`select count(*) from "ReferralCredit" where "briefId"='${brief}' and "personId"='${ana[1]}'`) === "1"), "the member who shared the work is credited");
  assert(sql(`select pct::int from "ReferralCredit" where "briefId"='${brief}' and "personId"='${ana[1]}'`) === "10", "at the rate card's 10%");
  await o.goto(`${BASE}/requirements/${brief}`, { waitUntil: "networkidle" });
  await o.locator("[data-credits]").getByRole("button", { name: "Mark paid" }).first().click();
  assert(await until(() => sql(`select status from "ReferralCredit" where "briefId"='${brief}' and "personId"='${ana[1]}'`) === "PAID"), "marked paid");
  // Earnings are off until the owner switches them on in Settings → Features: recorded, but not shown.
  const tenant = sql(`select "tenantId" from "Brief" where id='${brief}'`);
  await m1.goto(`${BASE}/member?tab=refer`, { waitUntil: "networkidle" });
  assert(!(await m1.locator("[data-member-credits]").count()), "earnings stay hidden while switched off");
  sql(`update "Tenant" set "features" = coalesce("features", '{}'::jsonb) || '{"earnings":true}'::jsonb where id='${tenant}'`);
  try {
    await m1.goto(`${BASE}/member?tab=refer`, { waitUntil: "networkidle" });
    assert(/Paid/.test(await m1.locator("[data-member-credits]").innerText()), "once switched on, the member sees their share");
  } finally { sql(`update "Tenant" set "features" = "features" - 'earnings' where id='${tenant}'`); }
});

await step("search: off until you switch it on for an account; then clients find people by skill, never by name", o, async () => {
  const acct = sql(`select id from "CommercialAccount" where name='Meridian Energy'`);
  sql(`update "CommercialAccount" set "searchEnabled"=false where id='${acct}'`);
  const c = await session(b, "client@meridian.local");
  await c.goto(`${BASE}/portal/search`, { waitUntil: "networkidle" });
  assert(await c.getByText("Search is not switched on for your account").isVisible(), "off by default");
  await o.goto(`${BASE}/requirements?tab=accounts`, { waitUntil: "networkidle" });
  await o.locator("li").filter({ hasText: "Meridian Energy" }).first().getByRole("button", { name: "Give search access" }).click();
  assert(await until(() => sql(`select "searchEnabled" from "CommercialAccount" where id='${acct}'`) === "t"), "switched on");
  // Make sure someone is findable: Ana chose to be.
  sql(`update "Person" set privacy = jsonb_set(coalesce(privacy::jsonb, '{"consents":{}}'::jsonb), '{consents,searchable}', 'true') where id='${ana[1]}'`);
  const anaSkill = sql(`select capabilities[1] from "Person" where id='${ana[1]}'`) || "transformation";
  await c.goto(`${BASE}/portal/search?q=${encodeURIComponent(anaSkill.split(" ")[0])}`, { waitUntil: "networkidle" });
  const n = await c.locator("[data-result]").count(); assert(n > 0, "results by skill");
  const text = await c.locator("main").innerText();
  const last = sql(`select "lastName" from "Person" where id='${ana[1]}'`);
  assert(!text.includes(last) && !/@example\.com/.test(text), "no names or emails in results");
  await c.goto(`${BASE}/portal/search?q=${encodeURIComponent(last)}`, { waitUntil: "networkidle" });
  assert((await c.locator("[data-result]").count()) === 0, "a name finds nobody");
  await c.goto(`${BASE}/portal/search?q=${encodeURIComponent(anaSkill.split(" ")[0])}`, { waitUntil: "networkidle" });
  const first = c.locator("[data-result]").first(); const ref = await first.locator("code").innerText();
  await first.locator("summary").click(); await first.locator('select[name="route"]').selectOption("SOW");
  await first.getByRole("button", { name: /Send to/ }).click(); await c.waitForURL(/notice=asked/, { timeout: 60000 });
  const asked = sql(`select b."submittedVia" || '|' || b."engagementRoute" || '|' || s.decision from "Brief" b join "ShortlistItem" s on s."briefId"=b.id where b."accountId"='${acct}' and b.title like '%${ref}%'`);
  assert(asked === "SEARCH|SOW|CLIENT_INTERESTED", "the ask reaches you as a requirement with that person on it: " + asked);
  await c.screenshot({ path: `${DIR}/client-search.png`, fullPage: true });
  if (c.errs.length) throw new Error(c.errs.join("; ")); await c.context().close();
  return `${n} results`;
});

await step("community: you can take a post down, and members no longer see it", o, async () => {
  await o.goto(`${BASE}/community`, { waitUntil: "networkidle" });
  await o.locator("[data-post]").filter({ hasText: TITLE }).getByRole("button", { name: "Take down" }).click();
  assert(await until(() => sql(`select status from "BoardPost" where title='${TITLE}'`) === "HIDDEN"), "hidden");
  await m2.goto(`${BASE}/community`, { waitUntil: "networkidle" });
  assert(!(await m2.locator("[data-post]").filter({ hasText: TITLE }).count()), "gone for members");
});

await step("features: you switch the board off and members lose it at once, then switch it back on", o, async () => {
  const state = () => sql(`select coalesce(features->>'communityBoard', 'default') from "Tenant" where id='${tenant}'`);
  try {
    await o.goto(`${BASE}/settings/features`, { waitUntil: "networkidle" });
    assert((await o.locator("[data-feature]").count()) >= 4, "the switches are listed");
    const sw = o.locator('[data-feature="communityBoard"]').getByRole("switch");
    assert((await sw.getAttribute("aria-checked")) === "true", "the board starts on");
    await sw.click();
    assert(await until(() => state() === "false"), "stored as off");
    await o.waitForFunction(() => document.querySelector('[data-feature="communityBoard"] [role="switch"]')?.getAttribute("aria-checked") === "false", null, { timeout: 30000 });
    // The member sees no board, no post form, and no "share" card on their profile.
    await m2.goto(`${BASE}/community`, { waitUntil: "networkidle" });
    assert(!(await m2.locator("[data-guide]").count()), "nothing to post");
    assert(!(await m2.getByRole("link", { name: /^Board/ }).count()), "no board tab");
    await m2.goto(`${BASE}/member`, { waitUntil: "networkidle" });
    assert(!(await m2.locator('[data-value="share"]').count()), "no share card");
    assert(await m2.locator('[data-value="connect"]').count(), "connections still offered");
    // And it comes straight back.
    await o.locator('[data-feature="communityBoard"]').getByRole("switch").click();
    assert(await until(() => state() === "true"), "stored as on");
    await m2.goto(`${BASE}/community`, { waitUntil: "networkidle" });
    assert(await m2.locator("[data-guide]").count(), "the board is back");
    assert(sql(`select count(*) from "AuditLog" where action='feature.update' and "tenantId"='${tenant}'`) !== "0", "each change is in the audit log");
    return "off, then on";
  } finally { sql(`update "Tenant" set "features" = "features" - 'communityBoard' where id='${tenant}'`); }
});

// Leave the shared demo data as it was.
for (const m of [m1, m2]) await m?.context().close().catch(() => {});
sql(`delete from "Brief" where id in (select "briefId" from "BoardPost" where title like 'E2E board work %') or ("submittedVia"='SEARCH' and "accountId"=(select id from "CommercialAccount" where name='Meridian Energy'))`);
sql(`delete from "BoardPost" where title like 'E2E board work %'`);
sql(`delete from "Connection" where "fromPersonId" in ('${ana[1]}','${cy[1]}') or "toPersonId" in ('${ana[1]}','${cy[1]}')`);
sql(`update "CommercialAccount" set "searchEnabled"=false`);
summary(); await b.close();
