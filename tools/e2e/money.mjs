import { launch, session, step, assert, sql, BASE, summary } from "./lib.mjs";
const b = await launch();
const stamp = String(Date.now()).slice(-6);
const tenant = sql(`select "tenantId" from "User" where email='waqas@networkintelligence.local'`);
const hash = sql(`select "passwordHash" from "User" where email='waqas@networkintelligence.local'`);
const mk = (role) => { const email = `${role.toLowerCase()}${stamp}@example.com`; sql(`insert into "User" (id,"tenantId",email,name,role,"passwordHash","updatedAt") values ('e2e-${role[0]}${stamp}','${tenant}','${email}','Sam ${role}','${role}','${hash}',now())`); return email; };
const briefId = sql(`select id from "Brief" where "tenantId"='${tenant}' order by "createdAt" desc limit 1`);
const MONEY = [["/overview", /Indicative pipeline/], ["/requirements", /Fee pipeline|Fee to us|Forecast fees|Rate card/i], ["/requirements?tab=fees", /Fee pipeline|Forecast fees|invoiced and paid/i], [`/requirements/${briefId}`, /Commercials|Estimated fee|Fees on this requirement/], ["/partners", /Share %|Monthly fee|commercial model/i]];

for (const role of ["ADMIN", "CONTRIBUTOR"]) {
  await step(`${role.toLowerCase()}: fees, pipeline and terms are hidden`, null, async () => {
    const p = await session(b, mk(role));
    for (const [url, re] of MONEY) { await p.goto(BASE + url, { waitUntil: "networkidle" }); const t = await p.locator("main").innerText(); assert(!re.test(t), `${url} shows money to ${role}: ${t.match(re)?.[0]}`); }
    await p.goto(`${BASE}/settings/commercials`, { waitUntil: "domcontentloaded" }); assert(/forbidden/.test(p.url()), "rate card page open to " + role);
    await p.goto(`${BASE}/settings/security`, { waitUntil: "networkidle" });
    // The pages of a section are listed in the tabs above the page, so that is where the link would be.
    assert(await p.locator('nav[aria-label="Settings"]').getByText("Security").count(), "the settings tabs are missing");
    assert(!(await p.locator("aside, header, nav").getByText("Commercials").count()), "Commercials in the menu");
    const audit = await p.locator("main").innerText(); assert(!/ourTake|fee\.create|ratecard\.update/.test(audit), "fee entries in the audit log for " + role);
    if (p.errs.length) throw new Error(p.errs.join("; ")); await p.context().close();
  });
}
await step("owner: still sees the pipeline, fees and terms", null, async () => {
  const p = await session(b, "waqas@networkintelligence.local");
  for (const [url, re] of MONEY) { await p.goto(BASE + url, { waitUntil: "networkidle" }); const t = await p.locator("main").innerText(); assert(re.test(t), `${url} lost its money view for the owner`); }
  await p.goto(`${BASE}/settings/commercials`, { waitUntil: "networkidle" }); assert(await p.getByRole("button", { name: "Save rate card" }).count(), "rate card");
  if (p.errs.length) throw new Error(p.errs.join("; ")); await p.context().close();
});
summary(); await b.close();
