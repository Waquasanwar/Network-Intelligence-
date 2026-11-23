import { launch, session, step, assert, sql, BASE, DIR, NEWPW, summary, walk } from "./lib.mjs";

/**
 * The standard (six proofs), references by link, and the public page. Everything here is built
 * to run without a phone call, so every step is driven the way a stranger, a referee or a member
 * would drive it: signed out where they would be signed out.
 */
const b = await launch();
const stamp = Date.now().toString(36);
const APPLY = `e2e-apply-${stamp}@example.com`, NEED = `e2e-need-${stamp}@example.com`, REFEREE = `E2E Referee ${stamp}`;
const tenant = sql(`select "tenantId" from "User" where email='waqas@networkintelligence.local'`);
const person = sql(`select p.id from "Person" p join "Relationship" r on r."personId"=p.id where p."tenantId"='${tenant}' and r."workedTogether" order by p."createdAt" limit 1`);
const stranger = async () => { const c = await b.newContext({ viewport: { width: 1360, height: 950 }, extraHTTPHeaders: { "x-real-ip": `203.0.113.${Math.floor(Math.random() * 250) + 1}` } }); const p = await c.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push("PAGEERROR " + e.message.slice(0, 160))); p.on("response", (r) => { if (r.status() >= 500) p.errs.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); }); return p; };
const o = await session(b, "waqas@networkintelligence.local");
/** Wait for the database to show what a click asked for, rather than guessing a delay. */
const until = async (ok, ms = 10000) => { for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 250))) if (ok()) return true; return ok(); };

/** Talk to Amana on the front door, as a stranger would, and return the final "send" form. */
const door = async (p, mode, a) => {
  await p.goto(`${BASE}/${mode === "join" ? "?as=join" : ""}#ask`, { waitUntil: "networkidle" });
  await p.locator("#front-ask").fill(a.text); await p.locator("#front-ask").press("Enter");
  const ans = async (t) => { await p.locator("#front-answer").fill(t); await p.locator("#front-answer").press("Enter"); };
  await ans(a.name); await ans(a.email);
  if (mode === "need") { if (a.who === "agency") await p.getByRole("button", { name: "An agency" }).click(); await ans(a.org); }
  else if (a.knows) await ans(a.knows); else await p.getByRole("button", { name: "Skip" }).click();
  const f = p.locator(".door-send"); await f.waitFor(); return f;
};

await step("public page: signed out, it says what the network is and publishes the six proofs", null, async () => {
  const p = await stranger();
  const r = await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
  assert(r.status() === 200 && new URL(p.url()).pathname === "/", "public page served at / to a stranger, got " + p.url());
  assert(/who do you need/i.test(await p.locator("h1").innerText()), "headline"); assert(await p.locator("#front-ask").count(), "the question box");
  for (const t of ["Came through someone we know", "Screened", "Vouched for", "Worked with", "Delivery on record", "Up to date"]) assert(await p.getByText(t, { exact: true }).first().isVisible(), "proof listed: " + t);
  // Nothing about who is in the network.
  const body = await p.locator("body").innerText();
  assert(!/Sarah|Okonkwo|Aisha|Meridian/i.test(body), "no member or client names on the public page");
  await p.screenshot({ path: `${DIR}/public.png`, fullPage: true });
  if (p.errs.length) throw new Error(p.errs.join("; ")); await p.context().close();
});

await step("public page: a signed-in user is sent home, not shown the front door", o, async () => {
  await o.goto(`${BASE}/`, { waitUntil: "networkidle" }); assert(/\/overview/.test(o.url()), "owner sent to /overview, at " + o.url());
});

await step("apply to join: a stranger applies, the owner invites them from Grow", o, async () => {
  const p = await stranger();
  const A = { text: "Fractional CFO, energy and utilities. Finance transformation and turnaround for mid-size energy groups. Open to fractional and SOW.", name: "Rana Aziz", email: APPLY, knows: "Sarah Okonkwo" };
  let f = await door(p, "join", A);
  // Without consent nothing is stored.
  await f.locator('input[name="consent"]').evaluate((el) => { el.required = false; });
  await f.getByRole("button", { name: "Send my application" }).click(); await p.waitForURL(/error=consent/, { timeout: 20000 });
  assert(sql(`select count(*) from "PublicRequest" where email='${APPLY}'`) === "0", "nothing stored without consent");
  f = await door(p, "join", A);
  await f.locator('input[name="consent"]').check();
  await f.getByRole("button", { name: "Send my application" }).click(); await p.waitForURL(/sent=join/, { timeout: 20000 });
  assert(await p.getByText(/application is with us/i).isVisible(), "thank-you shown");
  await p.context().close();
  assert(sql(`select status from "PublicRequest" where email='${APPLY}' and kind='JOIN'`) === "NEW", "application stored as NEW");

  await o.goto(`${BASE}/invite`, { waitUntil: "networkidle" });
  const row = o.locator("[data-application]").filter({ hasText: APPLY });
  assert(await row.isVisible(), "application listed on Grow");
  await row.getByRole("button", { name: "Invite" }).click(); await o.waitForURL(/invited=/, { timeout: 20000 });
  const st = sql(`select pr.status, i.email from "PublicRequest" pr join "Invite" i on i.id=pr."inviteId" where pr.email='${APPLY}'`);
  assert(st === `ACCEPTED|${APPLY}`, "accepted and turned into an invitation: " + st);
});

await step("bring us a need: a company sends one, the owner hands it to the co-pilot", o, async () => {
  const p = await stranger();
  const f = await door(p, "need", { text: "We need an interim programme director in Dubai for nine months to recover a delayed billing replacement.", name: "Tom Reyes", email: NEED, org: "Gulf Utilities Co" });
  assert(await p.locator(".door-chip").count() >= 1, "Amana shows how it read the need");
  await f.locator('input[name="consent"]').check();
  await f.getByRole("button", { name: "Send it to us" }).click(); await p.waitForURL(/sent=need/, { timeout: 20000 });
  await p.context().close();

  await o.goto(`${BASE}/requirements`, { waitUntil: "networkidle" });
  const row = o.locator("[data-enquiry]").filter({ hasText: "Gulf Utilities Co" });
  assert(await row.isVisible(), "need listed on Requirements");
  await row.getByRole("button", { name: "Read this need" }).click(); await o.waitForURL(/requirements\?q=/, { timeout: 30000 }); await o.waitForLoadState("networkidle");
  assert(/Gulf Utilities Co/.test(await o.locator('textarea[name="q"]').first().inputValue()), "co-pilot prefilled with the need");
  assert(await o.getByText("How we read it").isVisible(), "co-pilot read it");
  assert(sql(`select status from "PublicRequest" where email='${NEED}'`) === "ACCEPTED", "marked as read");
});

await step("declining something sent in deletes it", o, async () => {
  const p = await stranger();
  const gone = `e2e-decline-${stamp}@example.com`;
  const f = await door(p, "join", { text: "Something else entirely, not related to this network at all, sorry.", name: "Not A Fit", email: gone });
  await f.locator('input[name="consent"]').check(); await f.getByRole("button", { name: "Send my application" }).click(); await p.waitForURL(/sent=join/, { timeout: 20000 }); await p.context().close();
  await o.goto(`${BASE}/invite`, { waitUntil: "networkidle" });
  const row = o.locator("[data-application]").filter({ hasText: gone });
  await row.getByRole("button", { name: "Decline" }).click(); await row.waitFor({ state: "detached", timeout: 20000 });
  // The server finishes before the row leaves the page; poll rather than guess a delay.
  let left = "1"; for (let i = 0; i < 40 && left !== "0"; i++) { left = sql(`select count(*) from "PublicRequest" where email='${gone}'`); if (left !== "0") await o.waitForTimeout(250); }
  assert(left === "0", "declined application deleted");
});

await step("a filled-in trap field stores nothing", null, async () => {
  const p = await stranger();
  const bot = `e2e-bot-${stamp}@example.com`;
  const f = await door(p, "need", { text: "Buy cheap followers now from our website please.", name: "Bot", email: bot, org: "Bots Ltd" });
  await f.locator('input[name="consent"]').check();
  await f.locator('input[name="website"]').evaluate((el) => { el.value = "http://spam.example"; });
  await f.getByRole("button", { name: "Send it to us" }).click(); await p.waitForURL(/sent=need/, { timeout: 20000 }); await p.context().close();
  assert(sql(`select count(*) from "PublicRequest" where email='${bot}'`) === "0", "nothing stored from a script");
});

let link = "";
await step("a profile shows the framework behind the score, and what clients see of it", o, async () => {
  await o.goto(`${BASE}/network/${person}`, { waitUntil: "networkidle" });
  const fw = o.locator("[data-framework]");
  assert((await fw.locator("[data-check]").count()) === 22, "22 checks");
  assert(await fw.locator('[data-check="workedWith"][data-held]').count(), "worked-with held for someone we delivered with");
  assert(/Clients see \d of 6 proofs/.test(await fw.innerText()), "the six proofs clients see");
  return `${await fw.getAttribute("data-framework")} of 22 held`;
});

await step("ask for a reference: the team creates a link from the profile", o, async () => {
  await o.getByRole("button", { name: "Ask for a reference" }).first().click();
  const d = o.locator('[role="dialog"]:visible').last();
  await d.getByLabel("Their name").fill(REFEREE); await d.getByLabel(/How do they know/).fill("Steering committee chair on the billing replacement");
  await d.getByRole("button", { name: "Create the link" }).click();
  link = await d.getByLabel("Reference link").inputValue({ timeout: 20000 });
  assert(/\/vouch\?t=[A-Za-z0-9_.-]+$/.test(link), "a sealed link: " + link);
  await o.keyboard.press("Escape");
});

await step("the referee answers with no login, and the proof is earned", null, async () => {
  const before = Number(sql(`select count(*) from "Vouch" where "personId"='${person}' and "voucherKind"='EXTERNAL'`));
  const p = await stranger();
  await p.goto(link, { waitUntil: "networkidle" });
  assert(/would value a few words/i.test(await p.locator("h1").innerText()), "page says the team asked");
  assert(!(await p.getByText(/Trust|score|Waqas/).count()), "the referee sees nothing about the network beyond the name");
  await walk(p.locator("[data-guide]"), [{ keep: true }, { pick: "We worked alongside each other" }, "2016", "Billing replacement, 2024", { pick: "Yes" }, "Pulled a failing vendor back into line and landed the cutover on the planned weekend.", { yes: true }], "Send my reference");
  await p.waitForURL(/done=1/, { timeout: 20000 });
  await p.goto(link, { waitUntil: "networkidle" }); assert(/already been given/i.test(await p.locator("h1").innerText()), "link works once");
  assert(sql(`select "knownSince" from "Vouch" where "voucherName"='${REFEREE}' order by "createdAt" desc limit 1`) === "2016", "the referee's 'known since' is kept");
  await p.goto(`${BASE}/vouch?t=forged.token.here`, { waitUntil: "networkidle" }); assert(/not valid/i.test(await p.locator("h1").innerText()), "forged link refused");
  await p.screenshot({ path: `${DIR}/vouch-refused.png` });
  if (p.errs.length) throw new Error(p.errs.join("; ")); await p.context().close();
  assert(Number(sql(`select count(*) from "Vouch" where "personId"='${person}' and "voucherKind"='EXTERNAL'`)) === before + 1, "one outside reference recorded");
  assert(sql(`select status from "ReferenceRequest" where "refereeName"='${REFEREE}'`) === "ANSWERED", "request closed");
});

await step("the profile shows the reference apart from vouches inside the network", o, async () => {
  await o.goto(`${BASE}/network/${person}`, { waitUntil: "networkidle" });
  await o.locator('[data-framework] [data-area="record"] summary').click();
  const v = await o.locator('[data-check="reference"]').first().innerText();
  assert(await o.locator('[data-check="reference"][data-held]').count() && /reference/.test(v), "reference counted as outside: " + v.replace(/\n/g, " "));
});

await step("Grow shows where the network is thin, and each count opens the people missing that proof", o, async () => {
  await o.goto(`${BASE}/invite`, { waitUntil: "networkidle" });
  const thin = o.locator("[data-thin]"); assert(await thin.isVisible(), "thin-spots line shown");
  const a = thin.locator("a").first(); const n = Number((await a.innerText()).match(/\d+/)[0]);
  await a.click(); await o.waitForURL(/missing=/); await o.waitForLoadState("networkidle");
  const rows = await o.locator("table.data tbody tr").count();
  assert(rows === n, `filter shows the ${n} people counted, got ${rows}`);
  return `${n} people`;
});

await step("member: sees their own proofs, confirms availability in one tap, and can ask for a reference", null, async () => {
  // A member who is on the radar: the proofs panel only appears once the screening is done.
  const email = sql(`select u.email from "User" u join "Person" p on p.id=u."personId" where u.role='MEMBER' and p."screeningStatus"='APPROVED' order by u."createdAt" desc limit 1`);
  const m = await session(b, email, NEWPW);
  await m.goto(`${BASE}/member?tab=profile`, { waitUntil: "networkidle" });
  const s = m.locator("[data-standard]").first(); assert((await s.locator("[data-proof]").count()) === 6, "six proofs for the member");
  assert(!/Waqas Anwar has delivered/.test(await s.innerText()), "the member is not shown who on the team said what");
  await m.locator('[data-step="availability"]').getByRole("button", { name: /^(Confirm|Update|Still right)$/ }).click(); await m.waitForLoadState("networkidle"); await m.waitForTimeout(800);
  assert(/confirmed today/.test(await m.locator('[data-proof="current"]').first().innerText()), "availability confirmed by the member themselves");
  assert(await m.getByRole("button", { name: "Ask for a reference" }).first().isVisible(), "member can ask for a reference");
  await m.screenshot({ path: `${DIR}/member-proofs.png`, fullPage: true });
  if (m.errs.length) throw new Error(m.errs.join("; ")); await m.context().close();
});

await step("availability: a member sets when and how they work in a few taps, and the team sees it on the map of who is free", null, async () => {
  const email = sql(`select u.email from "User" u join "Person" p on p.id=u."personId" where u.role='MEMBER' and p."screeningStatus"='APPROVED' order by u."createdAt" desc limit 1`);
  const pid = sql(`select "personId" from "User" where email='${email}'`);
  const m = await session(b, email, NEWPW);
  await m.goto(`${BASE}/member`, { waitUntil: "networkidle" });
  const box = m.locator('[data-step="availability"]');
  await box.locator("summary").filter({ hasText: "Change" }).click();
  await walk(box.locator("[data-guide]"), [{ pick: "Yes, now" }, { pick: "Part time" }, { pick: "3 days" }, { pick: "Remote" }], "Save");
  assert(await until(() => sql(`select "availabilityStatus" || '|' || array_to_string("workPattern", ',') || '|' || coalesce("daysPerWeek"::text, '') || '|' || array_to_string("workSetting", ',') from "Person" where id='${pid}'`) === "AVAILABLE_NOW|part_time|3|remote"), "saved as free now, part time three days, remote");
  await m.goto(`${BASE}/member`, { waitUntil: "networkidle" });
  assert(/Part time/.test(await m.locator('[data-step="availability"] [data-availability]').innerText()), "shown back to them as chips");
  if (m.errs.length) throw new Error(m.errs.join("; ")); await m.context().close();
  await o.goto(`${BASE}/network/availability?when=now`, { waitUntil: "networkidle" });
  assert(await o.locator("[data-world-strip] .world-col").count(), "the team sees who is free, by time zone");
  assert(await o.locator(`[data-availability-list] a[href="/network/${pid}"]`).count(), "the member is on the list of who is free");
  const req = sql(`select id from "Brief" where locations[1] is not null and status not in ('FILLED','CLOSED') order by "updatedAt" desc limit 1`);
  if (req) {
    await o.goto(`${BASE}/network/availability?when=all&req=${req}`, { waitUntil: "networkidle" });
    assert(await o.locator(".avail-fit").count(), "measured against a requirement: hours apart and working day shared");
  }
});

await step("a client's card shows the proofs held and names nobody", null, async () => {
  const c = await session(b, "client@meridian.local");
  await c.goto(`${BASE}/portal`, { waitUntil: "networkidle" });
  const line = c.locator('ul[aria-label="What we hold on record for this person"]').first();
  assert(await line.isVisible(), "proof line on the client card");
  const t = await line.innerText();
  assert(!/Waqas|introduced by|Grace|Sarah/i.test(t), "no names in the proofs: " + t.replace(/\n/g, " | "));
  if (c.errs.length) throw new Error(c.errs.join("; ")); await c.context().close();
  return t.split("\n").length + " proofs shown";
});

await step("the owner can let complete screenings through automatically, and turn it off again", o, async () => {
  await o.goto(`${BASE}/settings/screening`, { waitUntil: "networkidle" });
  const box = o.getByLabel("Accept complete screenings automatically");
  await box.check(); await o.getByRole("button", { name: "Save", exact: true }).click();
  assert(await until(() => sql(`select "screeningAutoAccept" from "Tenant" where id='${tenant}'`) === "t"), "switched on");
  await o.goto(`${BASE}/settings/screening`, { waitUntil: "networkidle" });
  await o.getByLabel("Accept complete screenings automatically").uncheck(); await o.getByRole("button", { name: "Save", exact: true }).click();
  assert(await until(() => sql(`select "screeningAutoAccept" from "Tenant" where id='${tenant}'`) === "f"), "switched off again");
});

await step("the public page and the reference page do not scroll sideways on a phone", null, async () => {
  const p = await stranger(); await p.setViewportSize({ width: 390, height: 844 });
  for (const u of ["/", "/vouch?t=forged.token.here"]) {
    await p.goto(BASE + u, { waitUntil: "networkidle" });
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(over <= 1, `${u} scrolls sideways by ${over}px`);
  }
  await p.context().close();
});

// Leave the shared demo data as it was.
sql(`delete from "Invite" where email in ('${APPLY}')`);
await step("photo: a member adds their own photo, it shows inside the network only, and removing it deletes it", null, async () => {
  const email = sql(`select u.email from "User" u join "Person" p on p.id=u."personId" where u.role='MEMBER' and p."screeningStatus"='APPROVED' order by u."createdAt" desc limit 1`);
  const pid = sql(`select "personId" from "User" where email='${email}'`);
  const m = await session(b, email, NEWPW);
  await m.goto(`${BASE}/member?tab=profile`, { waitUntil: "networkidle" });
  // Any picture will do: the browser crops it square and makes a small JPEG before sending it.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAMklEQVR4nG3CgRAAIAAEwccJIogggjiIIIII4rESuJ3NoDqT6iyqs6kOVOdQnUt1HtUfWlFrgWgxPgwAAAAASUVORK5CYII=", "base64");
  await m.locator("[data-photo-input]").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  assert(await until(() => sql(`select ("photoUrl" is not null)::text || '|' || coalesce(privacy->'consents'->>'showPhoto', '') from "Person" where id='${pid}'`) === "true|true"), "saved, and adding it is the consent to show it");
  await m.goto(`${BASE}/member`, { waitUntil: "networkidle" });
  assert(await m.locator("[data-member-hero] img").count(), "their photo on their own page");
  await o.goto(`${BASE}/network/${pid}`, { waitUntil: "networkidle" });
  assert(await o.locator("main img").count(), "the team sees it on their profile");
  await m.goto(`${BASE}/member?tab=profile`, { waitUntil: "networkidle" });
  await m.locator("[data-photo-picker]").getByRole("button", { name: "Remove" }).click();
  assert(await until(() => sql(`select ("photoUrl" is null)::text || '|' || coalesce(privacy->'consents'->>'showPhoto', '') from "Person" where id='${pid}'`) === "true|false"), "removing it deletes it");
  if (m.errs.length) throw new Error(m.errs.join("; ")); await m.context().close();
});

sql(`delete from "PublicRequest" where email like 'e2e-%@example.com'`);
sql(`delete from "Vouch" where "voucherName"='${REFEREE}'`);
sql(`delete from "ReferenceRequest" where "refereeName"='${REFEREE}'`);
sql(`update "Tenant" set "screeningAutoAccept"=false where id='${tenant}'`);
summary(); await b.close();
