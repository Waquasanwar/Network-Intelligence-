import { launch, session, step, assert, sql, BASE, summary } from "./lib.mjs";

/**
 * Nothing is released until the owner says so. With every switch off, a member, a client, an agency
 * and a visitor to the public page each see only that their part is not open yet (members keep their
 * privacy and security pages); one switch in Settings → Release opens the member area at once.
 */
const b = await launch();
const tenant = sql(`select "tenantId" from "User" where email='waqas@networkintelligence.local'`);
const before = sql(`select coalesce(features::text, '{}') from "Tenant" where id='${tenant}'`);
sql(`update "Tenant" set features='{}'::jsonb where id='${tenant}'`);
const member = sql(`select u.email from "User" u join "Person" p on p.id=u."personId" where u.role='MEMBER' and u."tenantId"='${tenant}' and u.email like '%.demo@example.com' limit 1`);
let m;
try {
  await step("closed by default: members, clients, agencies and the public see nothing unreleased", null, async () => {
    m = await session(b, member);
    await m.goto(`${BASE}/member`, { waitUntil: "networkidle" });
    assert(await m.locator("[data-not-open]").count(), "a member sees that their space is not open yet");
    assert(!(await m.locator("aside").getByRole("link", { name: "Messages", exact: true }).count()), "no links to what is not released");
    assert(await m.locator("aside").getByRole("link", { name: "Privacy & data", exact: true }).count(), "privacy is always there");
    await m.goto(`${BASE}/member?tab=privacy`, { waitUntil: "networkidle" });
    assert(!(await m.locator("[data-not-open]").count()), "their privacy page stays open");
    await m.goto(`${BASE}/member?tab=refer`, { waitUntil: "networkidle" });
    assert(await m.locator("[data-not-open]").count(), "referrals are closed too");
    for (const [email, path] of [["client@meridian.local", "/portal"], ["client@meridian.local", "/client-workspace"], ["partner@harboursearch.local", "/partner-portal"]]) {
      const c = await session(b, email);
      await c.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      assert(await c.locator("[data-not-open]").count(), `${email} sees ${path} is not open yet`);
      await c.context().close();
    }
    const pub = await (await b.newContext()).newPage();
    await pub.goto(`${BASE}/`, { waitUntil: "networkidle" });
    assert(await pub.locator("[data-by-invitation]").count(), "the public page says it is by invitation");
    assert(!(await pub.locator('form textarea[name="message"], #join').count()), "no application forms");
    await pub.context().close();
    return "member, client, agency and public all closed";
  });

  await step("one switch releases the member area, at once, and it is audited", null, async () => {
    const o = await session(b, "waqas@networkintelligence.local");
    await o.goto(`${BASE}/settings/features`, { waitUntil: "networkidle" });
    const sw = o.locator('[data-feature="memberArea"]').getByRole("switch");
    assert((await sw.getAttribute("aria-checked")) === "false", "starts off");
    await sw.click();
    await o.waitForFunction(() => document.querySelector('[data-feature="memberArea"] [role="switch"]')?.getAttribute("aria-checked") === "true", null, { timeout: 30000 });
    await m.goto(`${BASE}/member`, { waitUntil: "networkidle" });
    assert(!(await m.locator("[data-not-open]").count()) && (await m.locator("[data-member-hero]").count()), "the member's page opens");
    assert(!(await m.locator("[data-who-do-you-know]").count()), "referring stays closed until it is released too");
    assert(sql(`select count(*) from "AuditLog" where action='feature.update' and "tenantId"='${tenant}' and metadata->>'feature'='memberArea'`) !== "0", "the change is audited");
    await o.context().close();
    return "member area released";
  });
} finally {
  sql(`update "Tenant" set features='${before.replace(/'/g, "''")}'::jsonb where id='${tenant}'`);
}
summary(); await b.close();
