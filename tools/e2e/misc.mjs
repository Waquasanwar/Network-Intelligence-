import { launch, session, step, assert, sql, BASE, DIR, summary } from "./lib.mjs";
const b = await launch();
const o = await session(b, "waqas@networkintelligence.local");
await step("sign out from the account menu", o, async () => {
  await o.goto(`${BASE}/overview`, { waitUntil: "networkidle" });
  await o.getByRole("button", { name: "Your account" }).click();
  await o.getByRole("button", { name: /Sign out/i }).click(); await o.waitForURL(/\/login/, { timeout: 15000 });
  await o.screenshot({ path: `${DIR}/signout.png` });
  await o.goto(`${BASE}/overview`, { waitUntil: "networkidle" }); assert(/\/login/.test(o.url()), "signed out, at " + o.url());
});
await step("unknown page and bad record id show friendly pages", null, async () => {
  const p = await session(b, "waqas@networkintelligence.local");
  let r = await p.goto(`${BASE}/network/not-a-real-id`, { waitUntil: "networkidle" }); assert(r.status() === 404, "404 for unknown person, got " + r.status()); assert(await p.getByText(/could not find that page/i).count(), "friendly 404");
  await p.screenshot({ path: `${DIR}/404.png` });
  r = await p.goto(`${BASE}/requirements/nope`, { waitUntil: "networkidle" }); assert(r.status() === 404, "404 for unknown brief");
  await p.context().close();
});
await step("no horizontal overflow on the new pages at phone width", null, async () => {
  const p = await session(b, "waqas@networkintelligence.local"); await p.setViewportSize({ width: 375, height: 800 });
  const link = await (async () => { await p.goto(`${BASE}/invite`, { waitUntil: "networkidle" }); return p.locator('input[aria-label="Invitation link"]').first().inputValue(); })();
  for (const u of ["/invite", "/member?tab=refer", "/settings/security", link.replace(BASE, ""), "/join", "/network", "/network/map", "/requirements", "/requirements?tab=accounts", "/opportunities", "/conversations", "/partners", `/network/${sql(`select "personId" from "Relationship" where "workedTogether" limit 1`)}`]) {
    await p.goto(BASE + u, { waitUntil: "networkidle" }); const m = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert(m[0] <= m[1] + 1, `${u.slice(0, 20)} overflows: ${m}`);
  }
  await p.goto(`${BASE}/invite`, { waitUntil: "networkidle" }); await p.screenshot({ path: `${DIR}/grow-phone.png`, fullPage: false });
  await p.context().close();
});
await step("navigation, next step and ask bar", null, async () => {
  const p = await session(b, "waqas@networkintelligence.local");
  await p.goto(`${BASE}/network`, { waitUntil: "networkidle" });
  // six sections in the sidebar; the pages of the section as tabs above the page
  for (const l of ["Home", "Network", "Conversations", "Work", "Clients", "Settings"]) assert(await p.locator("aside").getByRole("link", { name: l, exact: true }).count(), `sidebar link ${l}`);
  await p.locator('nav[aria-label="Network"]').getByRole("link", { name: "Map" }).click(); await p.waitForURL(/\/network\/map/); await p.locator(".orbit-stage").waitFor();
  // growth on the map: everyone added in the last 30 days carries a ring, and one filter shows only them
  const fresh = Number(sql(`select count(*) from "Person" where "tenantId"=(select "tenantId" from "User" where email='waqas@networkintelligence.local') and "createdAt" > now() - interval '30 days'`));
  assert((await p.locator(".orbit-stage .orbit-bud").count()) === fresh, `a ring for each of the ${fresh} people added this month, found ${await p.locator(".orbit-stage .orbit-bud").count()}`);
  if (fresh) { await p.getByRole("button", { name: /New this month/ }).click(); assert((await p.getByRole("button", { name: /New this month/ }).getAttribute("aria-pressed")) === "true", "growth filter on"); await p.getByRole("button", { name: /New this month/ }).click(); }
  assert(await p.getByRole("img", { name: /People added in each of the last six months/ }).count(), "growth chart");
  await p.locator("aside").getByRole("link", { name: "Work", exact: true }).click(); await p.waitForURL(/\/requirements/);
  await p.getByRole("link", { name: /^Accounts/ }).click(); await p.waitForURL(/tab=accounts/); assert(await p.getByRole("button", { name: "New account" }).count(), "accounts tab");
  await p.getByRole("link", { name: /^Fees/ }).click(); await p.waitForURL(/tab=fees/); assert(await p.getByText("Fee pipeline").count(), "fees tab");
  // one suggested next step, with somewhere to go
  await p.goto(`${BASE}/network`, { waitUntil: "networkidle" });
  const ns = p.locator(".next-step"); assert((await ns.count()) === 1, "one next step on the network page");
  const href = await ns.getByRole("link").getAttribute("href"); assert(/^\/(network\/|invite)/.test(href), "next step leads somewhere: " + href);
  // the ask bar opens search with its question typed, and that question can be asked
  const bar = p.getByRole("button", { name: /^Ask your network/ }); await bar.click();
  const box = p.getByRole("dialog", { name: "Search the network" }).locator("input"); const q = await box.inputValue(); assert(q.length > 10, "ask bar question carried over: " + q);
  await p.keyboard.press("Enter"); await p.waitForURL(/\/network\?q=/, { timeout: 15000 });
  await p.screenshot({ path: `${DIR}/ask.png` });
  await p.goto(`${BASE}/overview`, { waitUntil: "networkidle" }); assert(!(await p.locator(".ask-dock").count()), "home keeps its own composer");
  // profile graphics
  await p.goto(`${BASE}/network/${sql(`select "personId" from "Relationship" where "workedTogether" limit 1`)}`, { waitUntil: "networkidle" });
  assert(await p.getByRole("img", { name: /^Trust \d+ out of 100/ }).count(), "trust ring"); assert(await p.getByText("Keeping in touch").count(), "contact strip");
  await p.screenshot({ path: `${DIR}/profile.png`, fullPage: true });
  if (p.errs.length) throw new Error(p.errs.join("; ")); await p.context().close();
});
summary(); await b.close();
