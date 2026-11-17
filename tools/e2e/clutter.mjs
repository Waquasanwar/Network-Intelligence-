import { launch, session, step, assert, sql, BASE, DIR, PW, NEWPW, summary } from "./lib.mjs";

/**
 * A clutter budget. Every screen is measured in a real browser and held to a limit, so a page cannot
 * quietly fill up with panels again.
 *
 * A "box" is anything drawn as its own object: rounded, with an edge, a shadow or a fill of its
 * own, and big enough to read as a panel. Fields, buttons and links are not boxes. Detail that is
 * folded away is not on screen and is not counted.
 */
const MAX_BOXES = 8; // on any one screen
const MAX_FIRST = 6; // in the first screenful

const measure = () => {
  const seen = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05 && !el.closest("details:not([open]) > :not(summary)"); };
  const main = document.querySelector("main") ?? document.body;
  const boxes = [...main.querySelectorAll("*")].filter((el) => {
    if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(el.tagName) || !seen(el)) return false;
    const r = el.getBoundingClientRect(); if (r.width < 150 || r.height < 56) return false;
    const cs = getComputedStyle(el);
    const edge = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopColor !== "rgba(0, 0, 0, 0)", fill = cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.backgroundImage !== "none";
    return parseFloat(cs.borderTopLeftRadius) >= 10 && (edge || cs.boxShadow !== "none" || fill);
  });
  return { boxes: boxes.length, first: boxes.filter((el) => el.getBoundingClientRect().top < window.innerHeight).length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
};

const b = await launch();
const tenant = sql(`select "tenantId" from "User" where email='waqas@networkintelligence.local'`);
const brief = sql(`select b.id from "Brief" b where b."tenantId"='${tenant}' order by (select count(*) from "ShortlistItem" s where s."briefId"=b.id) desc, b."createdAt" desc limit 1`);
const opp = sql(`select id from "Opportunity" where "tenantId"='${tenant}' order by "createdAt" desc limit 1`);
const person = sql(`select "personId" from "Relationship" where "workedTogether" limit 1`);
const member = sql(`select u.email from "User" u where u.role='MEMBER' and u.email like 'ana%' order by u."createdAt" desc limit 1`);
const report = [];

async function check(label, p, routes, phone = false) {
  const over = [];
  for (const [name, url] of routes) {
    await p.goto(BASE + url, { waitUntil: "networkidle" }); await p.waitForTimeout(400);
    const m = await p.evaluate(measure); report.push(`${label}/${name}: ${m.boxes} boxes, ${m.first} in the first screen`);
    if (m.overflow > 1) over.push(`${label}/${name} scrolls sideways by ${m.overflow}px`);
    if (!phone && m.boxes > MAX_BOXES) over.push(`${label}/${name} has ${m.boxes} boxes (limit ${MAX_BOXES})`);
    if (!phone && m.first > MAX_FIRST) over.push(`${label}/${name} opens with ${m.first} boxes (limit ${MAX_FIRST})`);
  }
  // Report every screen that is over, not only the first.
  if (over.length) { report.length = 0; throw new Error(over.join("; ")); }
}

await step("team screens stay within the clutter budget", null, async () => {
  const p = await session(b, "waqas@networkintelligence.local");
  await check("team", p, [["home", "/overview"], ["people", "/network"], ["person", `/network/${person}`], ["map", "/network/map"], ["grow", "/invite"], ["import", "/network/import"], ["conversations", "/conversations"], ["requirements", "/requirements"], ["accounts", "/requirements?tab=accounts"], ["fees", "/requirements?tab=fees"], ...(brief ? [["requirement", `/requirements/${brief}`]] : []), ["opportunities", "/opportunities"], ...(opp ? [["opportunity", `/opportunities/${opp}`]] : []), ["referrals", "/referrals"], ["relocation", "/relocation"], ["portal", "/portal"], ["agencies", "/partners"], ["amana", "/amana"], ["screening", "/settings/screening"], ["commercials", "/settings/commercials"], ["integrations", "/settings/integrations"], ["security", "/settings/security"]]);
  await p.screenshot({ path: `${DIR}/clutter-team.png` });
  if (p.errs.length) throw new Error(p.errs.join("; ")); await p.context().close();
  return report.splice(0).join(" · ");
});
await step("client, agency and member screens stay within the clutter budget", null, async () => {
  const c = await session(b, "client@meridian.local"); await check("client", c, [["workspace", "/client-workspace"], ["portal", "/portal"]]); await c.context().close();
  const a = await session(b, "partner@harboursearch.local"); await check("agency", a, [["portal", "/partner-portal"]]); await a.context().close();
  if (member) { const m = await session(b, member, NEWPW); await check("member", m, [["home", "/member"], ["opportunities", "/member?tab=opportunities"], ["refer", "/member?tab=refer"], ["privacy", "/member?tab=privacy"]]); await m.context().close(); }
  return report.splice(0).join(" · ") + (member ? "" : " · no member account to check (run the network suite first)");
});
await step("nothing scrolls sideways on a phone", null, async () => {
  const p = await session(b, "waqas@networkintelligence.local"); await p.setViewportSize({ width: 390, height: 844 });
  await check("phone", p, [["home", "/overview"], ["people", "/network"], ["person", `/network/${person}`], ["map", "/network/map"], ["grow", "/invite"], ["requirements", "/requirements"], ...(brief ? [["requirement", `/requirements/${brief}`]] : []), ["opportunities", "/opportunities"], ["conversations", "/conversations"], ["agencies", "/partners"], ["portal", "/portal"], ["security", "/settings/security"]], true);
  await p.context().close();
  return `${report.splice(0).length} screens`;
});
void PW;
summary(); await b.close();
