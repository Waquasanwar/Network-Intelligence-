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
  for (const u of ["/invite", "/member?tab=refer", "/settings/security", link.replace(BASE, ""), "/join"]) {
    await p.goto(BASE + u, { waitUntil: "networkidle" }); const m = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert(m[0] <= m[1] + 1, `${u.slice(0, 20)} overflows: ${m}`);
  }
  await p.goto(`${BASE}/invite`, { waitUntil: "networkidle" }); await p.screenshot({ path: `${DIR}/grow-phone.png`, fullPage: false });
  await p.context().close();
});
summary(); await b.close();
