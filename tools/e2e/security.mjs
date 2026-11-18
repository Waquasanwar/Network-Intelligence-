/**
 * Security journey: what an outsider, or a signed-in user of the wrong kind, can and cannot reach.
 * Headers, signed-out access, role isolation, record guessing, sign-in throttling, script injection
 * through the public forms, session cookie flags, and what the installed app keeps on the device.
 */
import { BASE, DIR, launch, session, step, assert, sql, summary } from "./lib.mjs";

const b = await launch();
const stamp = Date.now();
// One owner session for the whole journey: sign-in allows 12 attempts per account every 5 minutes,
// and the other journeys have already used some of them.
let owner;
const ownerPage = async () => (owner ??= await session(b, "waqas@networkintelligence.local"));
const stranger = async (ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`) => {
  const c = await b.newContext({ viewport: { width: 1360, height: 950 }, extraHTTPHeaders: { "x-real-ip": ip } });
  const p = await c.newPage(); p.errs = []; return p;
};
const person = sql(`select p.id from "Person" p join "Relationship" r on r."personId" = p.id where r."workedTogether" limit 1`);
const personName = sql(`select "firstName" || ' ' || "lastName" from "Person" where id = '${person}'`);
const brief = sql(`select id from "Brief" limit 1`);
const PRIVATE = ["/overview", "/network", `/network/${person}`, "/network/map", "/invite", "/community", "/conversations", "/requirements", `/requirements/${brief}`, "/opportunities", "/partners", "/amana", "/portal", "/portal/search", "/member", "/settings/security", "/settings/commercials", "/settings/integrations"];

await step("headers: every response carries the security headers, and pages stay out of search engines", null, async () => {
  const p = await stranger();
  for (const path of ["/", "/login", "/overview"]) {
    const r = await p.request.get(BASE + path, { maxRedirects: 0 });
    const h = r.headers();
    for (const [k, test] of [["content-security-policy", /default-src 'self'/], ["x-frame-options", /DENY/i], ["x-content-type-options", /nosniff/], ["referrer-policy", /strict-origin/], ["permissions-policy", /camera=\(\)/], ["strict-transport-security", /max-age=\d{7,}/], ["x-robots-tag", /noindex/]]) assert(test.test(h[k] ?? ""), `${path}: ${k} = ${h[k]}`);
  }
  await p.context().close();
});

await step("signed out: every private page and private API sends you to sign in", null, async () => {
  const p = await stranger();
  for (const path of PRIVATE) {
    const r = await p.request.get(BASE + path, { maxRedirects: 0 });
    assert([302, 303, 307, 308].includes(r.status()) && /\/login/.test(r.headers().location ?? ""), `${path} gave ${r.status()} → ${r.headers().location}`);
  }
  for (const path of ["/api/import/template", "/api/voice/agent-session"]) {
    const r = await p.request.get(BASE + path, { maxRedirects: 0 });
    assert(r.status() >= 300 && r.status() !== 500 && !(r.status() === 200), `${path} gave ${r.status()}`);
  }
  const cron = await p.request.get(BASE + "/api/cron/retention", { maxRedirects: 0 });
  assert(cron.status() === 401 || cron.status() === 403 || cron.status() === 307, "retention job needs its secret, got " + cron.status());
  await p.context().close();
});

for (const [who, email, pw, allowed] of [
  ["client", "client@meridian.local", undefined, ["/portal", "/portal/search", "/client-workspace", "/settings/security"]],
  ["agency", "partner@harboursearch.local", undefined, ["/portal", "/portal/search", "/partner-portal", "/settings/security"]],
  ["member", "layla.haddad@example.com", "Harbour-lights-2031", ["/member", "/community", "/settings/security"]],
]) {
  await step(`roles: ${who === "agency" ? "an" : "a"} ${who} cannot open the team's pages or anyone's record`, null, async () => {
    const p = await session(b, email, pw);
    for (const path of PRIVATE.filter((x) => !allowed.includes(x))) {
      await p.goto(BASE + path, { waitUntil: "domcontentloaded" });
      const at = new URL(p.url()).pathname;
      assert(at !== path, `${who} reached ${path}`);
      assert(!(await p.locator("body").innerText()).includes(personName), `${who} saw ${personName} on ${path}`);
    }
    await p.context().close();
  });
}

await step("sign-in: repeated wrong passwords from one place are throttled", null, async () => {
  const p = await stranger("203.0.113.250");
  let throttled = false;
  for (let i = 0; i < 20 && !throttled; i++) {
    await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await p.fill('input[name="email"]', `nobody-${stamp}@example.com`); await p.fill('input[name="password"]', "wrong-password-1");
    await p.click('button[type="submit"]'); await p.waitForURL(/error=/, { timeout: 20000 });
    throttled = /error=throttled/.test(p.url());
  }
  assert(throttled, "never throttled after 20 tries");
  await p.context().close();
});

await step("injection: script typed into the public form shows as text and never runs", null, async () => {
  const email = `e2e-xss-${stamp}@example.com`;
  const p = await stranger();
  await p.goto(`${BASE}/#join`, { waitUntil: "networkidle" });
  const f = p.locator("#join form");
  await f.getByLabel("Your name").fill(`<img src=x onerror="window.__pwned=1">Eve`); await f.getByLabel("Email").fill(email);
  await f.getByLabel(/What you do/).fill(`<script>window.__pwned=1</script>Fractional COO`);
  await f.getByLabel(/The work you are best at/).fill(`"><svg onload="window.__pwned=1"> Operations turnarounds and interim leadership.`);
  await f.locator('input[name="consent"]').check();
  await f.getByRole("button", { name: "Send my application" }).click(); await p.waitForURL(/sent=join/, { timeout: 20000 });
  await p.context().close();
  const o = await ownerPage();
  await o.goto(`${BASE}/invite`, { waitUntil: "networkidle" });
  assert(await o.getByText("Fractional COO", { exact: false }).first().isVisible(), "application listed");
  assert(!(await o.evaluate(() => window.__pwned)), "injected script ran");
  assert(await o.getByText("<script>", { exact: false }).count() || await o.getByText("onerror", { exact: false }).count(), "the markup shows as plain text");
  sql(`delete from "PublicRequest" where email = '${email}'`);
});

await step("session cookie: not readable by page scripts, and not sent to other sites", null, async () => {
  const p = await ownerPage();
  const c = (await p.context().cookies()).find((x) => /session-token/.test(x.name));
  assert(c && c.httpOnly && (c.sameSite === "Lax" || c.sameSite === "Strict"), "session cookie flags " + JSON.stringify(c && { httpOnly: c.httpOnly, sameSite: c.sameSite }));
  assert(!(await p.evaluate(() => document.cookie)).includes("session-token"), "page script can read the session");
});

await step("installed app: the device keeps code and icons only, never pages or data", null, async () => {
  const p = await ownerPage();
  await p.goto(`${BASE}/overview`, { waitUntil: "networkidle" });
  await p.evaluate(() => navigator.serviceWorker?.ready);
  for (const path of ["/network", "/requirements", `/network/${person}`]) await p.goto(BASE + path, { waitUntil: "networkidle" });
  const cached = await p.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname); return out; });
  const bad = cached.filter((u) => !(u === "/offline.html" || u.startsWith("/icons/") || u.startsWith("/_next/static/")));
  assert(cached.length > 0, "nothing cached at all; is the worker running?");
  assert(!bad.length, "cached private paths: " + bad.join(", "));
  await p.screenshot({ path: `${DIR}/security-home.png` });
  await p.context().close();
});

summary(); await b.close();
