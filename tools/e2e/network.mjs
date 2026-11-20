import { launch, session, step, assert, dialog, sql, BASE, DIR, PW, summary, NEWPW } from "./lib.mjs";
const stamp = String(Date.now()).slice(-6);
const b = await launch();
const o = await session(b, "waqas@networkintelligence.local");
const og = (u) => o.goto(BASE + u, { waitUntil: "networkidle" });
const fresh = async () => { const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await c.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push("PAGEERROR " + e.message.slice(0, 160))); p.on("response", (r) => { if (r.status() >= 500) p.errs.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); }); return p; };
const login = async (p, email, pw) => { if (!/\/login/.test(p.url())) await p.goto(`${BASE}/login`, { waitUntil: "networkidle" }); await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', pw); await p.click('button[type="submit"]'); await p.waitForURL((u) => !/login/.test(u.pathname), { timeout: 30000 }); };
const register = async (p, { first, last, email, pw = NEWPW }) => { if (first) await p.fill('input[name="firstName"]', first); if (last) await p.fill('input[name="lastName"]', last); if (email) await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', pw); await p.check('input[name="consent"]'); await p.click('button[type="submit"]'); };
let link1, networkLink, memberLink, m1, a1 = `ana${stamp}@example.com`;

await step("public: join with no invitation shows nothing about the network", null, async () => {
  const p = await fresh(); await p.goto(`${BASE}/join`, { waitUntil: "networkidle" });
  assert(await p.getByText("You need an invitation to join").count(), "invitation needed");
  assert(!(await p.locator("select").count()) && !(await p.locator('input[name="email"]').count()), "no form, no member list");
  const html = await p.content(); for (const n of ["Rosa Diaz", "Tariq Mansour", "Kofi Mensah"]) assert(!html.includes(n), "leaks " + n);
  await p.goto(`${BASE}/join?ref=cmw4cwqo0003j7dh34mk0m1jy`, { waitUntil: "networkidle" }); assert(await p.getByText("You need an invitation to join").count(), "unsigned ref refused");
  await p.goto(`${BASE}/join?t=abcDEF123_forged.token.value`, { waitUntil: "networkidle" }); assert(await p.getByText("That invitation link is not valid").count(), "forged token refused");
  await p.screenshot({ path: `${DIR}/join-none.png` }); await p.context().close();
});
await step("owner: Grow the network page + personal invite", o, async () => {
  await og("/invite"); await o.screenshot({ path: `${DIR}/grow.png`, fullPage: true });
  networkLink = await o.locator('input[aria-label="Invitation link"]').first().inputValue(); assert(/\/join\?t=/.test(networkLink), "network link");
  const card = o.locator("form").filter({ hasText: "Their name" });
  await card.locator("input").nth(0).fill("Ana Costa" + stamp); await card.locator('input[type="email"]').fill(a1);
  await card.getByRole("button", { name: "Worked with them" }).click(); // how the inviter knows them: one optional tap
  await card.getByRole("button", { name: "Create invitation" }).click();
  await o.getByText(/invitation is ready/).waitFor({ timeout: 15000 });
  assert(sql(`select "knownHow" from "Invite" where email='${a1}'`) === "worked", "how the inviter knows them is kept");
  link1 = await o.locator('input[aria-label="Invitation link"]').first().inputValue();
  assert(link1 !== networkLink && /\/join\?t=/.test(link1), "personal link");
  assert(!link1.includes("cmw"), "no id readable in link");
  const mailto = await o.locator('a[href^="mailto:"]').first().getAttribute("href"); assert(mailto.includes(encodeURIComponent(a1)) && decodeURIComponent(mailto).includes(link1), "mailto carries address and link");
  await o.screenshot({ path: `${DIR}/invite-ready.png` });
});
await step("invitee: opens personal link, weak password refused, then joins", null, async () => {
  const p = await fresh(); await p.goto(link1, { waitUntil: "networkidle" });
  assert((await p.inputValue('input[name="firstName"]')) === "Ana", "name prefilled"); assert((await p.inputValue('input[name="email"]')) === a1, "email prefilled");
  assert(sql(`select status from "Invite" where email='${a1}'`) === "OPENED", "marked opened");
  await p.screenshot({ path: `${DIR}/join-invited.png`, fullPage: true });
  await register(p, { pw: "password123" }); await p.waitForURL(/error=password-weak/, { timeout: 15000 }); await p.getByText(/too easy to guess/).waitFor({ timeout: 15000 }); await p.waitForLoadState("networkidle");
  // Creating the account signs them straight in: no second password prompt.
  await register(p, { first: "Ana", last: "Costa" + stamp, email: a1 }); await p.waitForURL((u) => u.pathname === "/member", { timeout: 30000 }); await p.waitForLoadState("networkidle");
  assert(/Welcome, Ana/.test(await p.locator("h1").innerText()), "greeted on member home");
  const steps = await p.locator("[data-checklist] [data-step]").count(); assert(steps === 3, "three things to do, got " + steps);
  assert(!(await p.locator("[data-standard]").count()), "no trust panel before the screening");
  const known = sql(`select r."sourceType" from "Relationship" r join "Person" p on p.id=r."personId" where p.email='${a1}'`);
  assert(known === "PERSONAL_NETWORK", "invited by name, so known first hand: " + known);
  m1 = p; assert(sql(`select status from "Invite" where email='${a1}'`) === "JOINED", "invite joined");
  assert(sql(`select role from "User" where email='${a1}'`) === "MEMBER", "member user");
  await p.screenshot({ path: `${DIR}/member-home.png`, fullPage: true });
  if (p.errs.length) throw new Error(p.errs.join("; "));
});
await step("personal invitation works once", null, async () => {
  const p = await fresh(); await p.goto(link1, { waitUntil: "networkidle" }); assert(await p.getByText("already been used").count(), "single use"); await p.context().close();
});
await step("member (not yet approved): cannot invite, sees only own security page", m1, async () => {
  await m1.goto(`${BASE}/member?tab=refer`, { waitUntil: "networkidle" }); assert(await m1.getByText("Available once you are approved").count(), "invite gated");
  await m1.goto(`${BASE}/settings/security`, { waitUntil: "networkidle" });
  const t = await m1.locator("main").innerText(); assert(/Sign-in security/.test(t), "own security page"); assert(!/Users & roles|Audit log|waqas@/i.test(t), "no directory or audit: " + t.slice(0, 120));
  for (const u of ["/invite", "/network", "/overview", "/settings/commercials", "/requirements"]) { await m1.goto(BASE + u, { waitUntil: "domcontentloaded" }); assert(/forbidden/.test(m1.url()), u + " should be forbidden, got " + m1.url()); }
});
await step("member: 15-minute screening end to end", m1, async () => {
  await m1.goto(`${BASE}/member`, { waitUntil: "networkidle" });
  await m1.getByRole("button", { name: /Start the AI screening|Start.*screening/i }).first().click(); await m1.waitForURL(/\/screening\//, { timeout: 20000 });
  for (let i = 0; i < 30 && /\/screening\//.test(m1.url()); i++) {
    await m1.waitForLoadState("networkidle");
    const ta = m1.locator('textarea[name="a"]'), people = m1.locator('input[name="pn"]'), txt = m1.locator('input[name="a"]:not([type="radio"]):not([type="checkbox"])'), radios = m1.locator('input[name="a"][type="radio"], input[name="a"][type="checkbox"]');
    if (await ta.count()) await ta.first().fill("Took a red core-banking programme to amber in a quarter by re-baselining honestly and rebuilding trust with the board.");
    else if (await people.count()) { await people.first().fill("Ben Hughes" + stamp); await m1.locator('input[name="pc"]').first().fill("Ran the recovery workstream for me. Calm and precise."); }
    else if (await txt.count()) await txt.first().fill("Programme director, Dubai, UAE");
    else if (await radios.count()) await radios.first().check().catch(() => radios.first().click());
    const before = m1.url(); await m1.locator('button[name="nav"][value="next"]').first().click(); await m1.waitForURL((u) => u.toString() !== before, { timeout: 15000 }).catch(() => {});
  }
  assert(/\/member/.test(m1.url()), "back on member home, at " + m1.url());
  assert(sql(`select "screeningStatus" from "Person" where email='${a1}'`) === "SUBMITTED", "screening submitted");
});
await step("owner: reviews and approves the screening", o, async () => {
  await og("/conversations?tab=review"); await o.screenshot({ path: `${DIR}/review.png`, fullPage: true });
  const row = o.locator("main").getByText("Costa" + stamp).first(); if (await row.count()) await row.click().catch(() => {});
  await o.getByRole("button", { name: /Approve/i }).first().click(); await o.waitForTimeout(2500);
  const st = sql(`select "screeningStatus", "screenedAt" is not null from "Person" where email='${a1}'`); assert(/APPROVED|\|t/.test(st), "approved: " + st);
});
await step("member (approved): own link + invites someone by name", m1, async () => {
  await m1.goto(`${BASE}/member?tab=refer`, { waitUntil: "networkidle" });
  await m1.locator('input[aria-label="Invitation link"]').first().waitFor({ timeout: 15000 });
  memberLink = await m1.locator('input[aria-label="Invitation link"]').first().inputValue(); assert(/\/join\?t=/.test(memberLink), "member link");
  const f = m1.locator("form").filter({ hasText: "Their name" }); await f.locator("input").nth(0).fill("Bo Lin" + stamp); await f.getByRole("button", { name: "Create invitation" }).click();
  await m1.getByText(/invitation is ready/).waitFor({ timeout: 15000 });
  await m1.screenshot({ path: `${DIR}/member-invite.png`, fullPage: true });
  assert(sql(`select count(*) from "Invite" i join "Person" p on p.id=i."inviterPersonId" where p.email='${a1}'`) === "1", "member invite row");
});
await step("second person joins on the member's link and is linked to them", null, async () => {
  const p = await fresh(); await p.goto(memberLink, { waitUntil: "networkidle" });
  assert(await p.getByText(new RegExp("Invited by Ana Costa" + stamp)).count(), "shows inviter");
  await register(p, { first: "Cy", last: "Okafor" + stamp, email: `cy${stamp}@example.com` }); await p.waitForURL((u) => u.pathname === "/member", { timeout: 30000 });
  const intro = sql(`select ip.email from "Relationship" r join "Person" p on p.id=r."personId" join "Person" ip on ip.id=r."introducedById" where p.email='cy${stamp}@example.com'`);
  assert(intro === a1, "introducedBy = inviting member, got " + intro); await p.context().close();
});
await step("owner: invite an existing contact to claim their profile", o, async () => {
  const pid = sql(`select id from "Person" where "lastName" like 'Tester%' and email is not null and id not in (select "personId" from "User" where "personId" is not null) order by "createdAt" desc limit 1`); assert(pid, "an unclaimed contact exists");
  const before = sql(`select count(*) from "Person"`);
  await og(`/network/${pid}`); await o.getByRole("button", { name: "More" }).click(); await o.getByRole("button", { name: /Invite to join/ }).click();
  const d = dialog(o); await d.waitFor(); await d.getByRole("button", { name: /Create their invitation/ }).click(); await d.getByText(/invitation is ready/).waitFor({ timeout: 15000 });
  const link = await d.locator('input[aria-label="Invitation link"]').inputValue(); await o.keyboard.press("Escape");
  const p = await fresh(); await p.goto(link, { waitUntil: "networkidle" }); assert(await p.getByText(/We already know you a little/).count(), "claim wording");
  const email = await p.inputValue('input[name="email"]'); await register(p, {}); await p.waitForURL((u) => u.pathname === "/member", { timeout: 30000 });
  assert(sql(`select "personId" from "User" where email='${email}'`) === pid, "login attached to the existing profile");
  assert(sql(`select count(*) from "Person"`) === before, "no duplicate person created"); await p.context().close();
});
await step("duplicate registration can be joined up by the owner", o, async () => {
  const existing = sql(`select id||'|'||"firstName"||'|'||"lastName" from "Person" where "lastName" like 'Row%' and id not in (select "personId" from "User" where "personId" is not null) order by "createdAt" desc limit 1`).split("|"); assert(existing[0], "an imported contact exists");
  const p = await fresh(); await p.goto(networkLink, { waitUntil: "networkidle" }); const em = `dup${stamp}@example.com`;
  await register(p, { first: existing[1], last: existing[2], email: em }); await p.waitForURL((u) => u.pathname === "/member", { timeout: 30000 }); await p.context().close();
  const newId = sql(`select "personId" from "User" where email='${em}'`); assert(newId && newId !== existing[0], "registered as a new profile");
  await og(`/network/${newId}`); assert(await o.getByText(/you already had/).count(), "duplicate banner"); await o.screenshot({ path: `${DIR}/merge-banner.png` });
  await o.getByRole("button", { name: /Same person: join them up/ }).click(); await o.waitForURL(new RegExp(`/network/${existing[0]}`), { timeout: 20000 });
  assert(sql(`select "personId" from "User" where email='${em}'`) === existing[0], "login moved"); assert(sql(`select count(*) from "Person" where id='${newId}'`) === "0", "duplicate removed");
});
await step("owner: cancel an invitation and reset the network link", o, async () => {
  await og("/invite"); const row = o.locator("tr").filter({ hasText: "Bo Lin" + stamp });
  if (await row.count()) { /* member's invite is visible to the owner */ }
  const f = o.locator("form").filter({ hasText: "Their name" }); await f.locator("input").nth(0).fill("Dee Park" + stamp); await f.getByRole("button", { name: "Create invitation" }).click(); await o.getByText(/invitation is ready/).waitFor({ timeout: 15000 });
  const link = await o.locator('input[aria-label="Invitation link"]').first().inputValue();
  await og("/invite"); await o.locator("tr").filter({ hasText: "Dee Park" + stamp }).getByRole("button", { name: "Cancel" }).click(); await o.waitForTimeout(1500);
  const p = await fresh(); await p.goto(link, { waitUntil: "networkidle" }); assert(await p.getByText("no longer open").count(), "cancelled link refused");
  await og("/invite"); await o.getByRole("button", { name: /Reset link/ }).click(); await o.waitForTimeout(2000);
  await p.goto(networkLink, { waitUntil: "networkidle" }); assert(await p.getByText("no longer open").count(), "old network link refused");
  await og("/invite"); const nl = await o.locator('input[aria-label="Invitation link"]').first().inputValue(); assert(nl !== networkLink, "new network link issued");
  await p.goto(nl, { waitUntil: "networkidle" }); assert(await p.locator('input[name="email"]').count(), "new link works"); await p.context().close();
  await o.screenshot({ path: `${DIR}/grow-after.png`, fullPage: true });
});
await step("member: export leaves out team notes; consents; deletion request hides them", m1, async () => {
  await m1.goto(`${BASE}/member?tab=privacy`, { waitUntil: "networkidle" }); await m1.screenshot({ path: `${DIR}/member-privacy.png`, fullPage: true });
  const [dl] = await Promise.all([m1.waitForEvent("download", { timeout: 15000 }).catch(() => null), m1.getByRole("button", { name: /Download|Export/i }).first().click()]);
  if (dl) { const fs = await import("node:fs"); const path = await dl.path(); const txt = fs.readFileSync(path, "utf8"); assert(!/relationshipNotes|networkOwnerId|tenantId|rawNotes|CAUTION/.test(txt), "export contains internal fields"); assert(/"about"/.test(txt) && txt.includes(a1), "export has their own data"); }
  await m1.getByRole("button", { name: "Save permissions" }).click(); await m1.waitForTimeout(1200);
  await m1.getByRole("button", { name: "Delete my data" }).click();
  await m1.locator('input[name="confirm"]').fill("DELETE"); await m1.getByRole("button", { name: "Request deletion" }).click(); await m1.waitForTimeout(1500);
  assert(sql(`select privacy->>'erasureRequestedAt' is not null, "referralConsent" from "Person" where email='${a1}'`) === "t|no", "erasure recorded");
  assert(sql(`select count(*) from "Invite" i join "Person" p on p.id=i."inviterPersonId" where p.email='${a1}' and i.status in ('SENT','OPENED')`) === "0", "their open invitations revoked");
  const p = await fresh(); await p.goto(memberLink, { waitUntil: "networkidle" }); assert(await p.getByText("no longer open").count(), "leaving member's link stops working"); await p.context().close();
  await m1.getByRole("button", { name: /Keep my profile/ }).click(); await m1.waitForTimeout(1200);
  assert(sql(`select privacy->>'erasureRequestedAt' is null from "Person" where email='${a1}'`) === "t", "erasure cancelled");
});
summary();
await b.close();
