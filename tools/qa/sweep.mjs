/**
 * Quality sweep: every screen, for each role, on a phone, on a desktop and in dark mode.
 * Fails on page errors, failed requests, sideways scrolling, a missing or doubled page heading,
 * "undefined"/"NaN" in the text, axe WCAG 2.1 AA violations, and controls under 24px on a phone.
 *
 *   node tools/qa/sweep.mjs            (app on localhost:3000, seeded demo data)
 * Env: QA_BASE_URL, QA_OUT (screenshots + issues.json), PLAYWRIGHT_PATH, QA_MEMBER_EMAIL/QA_MEMBER_PASSWORD.
 */
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
const B = process.env.QA_BASE_URL ?? "http://localhost:3000", OUT = process.env.QA_OUT ?? join(tmpdir(), "ni-qa");
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
fs.mkdirSync(OUT, { recursive: true });
const ROLES = {
  public: { routes: ["/", "/login", "/join", "/portal"] },
  owner: { email: "waqas@networkintelligence.local", pw: "Password123!", routes: ["/overview", "/network", "/network/map", "/network/availability", "/network/import", "/network/intake", "/network/@person", "/conversations", "/conversations/capture", "/opportunities", "/opportunities/@opp", "/requirements", "/requirements/@req", "/referrals", "/amana", "/partners", "/relocation", "/invite", "/community", "/community?tab=connections", "/settings", "/settings/features", "/settings/commercials", "/settings/screening", "/settings/security", "/settings/integrations", "/forbidden"] },
  partner: { email: "partner@harboursearch.local", pw: "Password123!", routes: ["/partner-portal", "/portal/search"] },
  client: { email: "client@meridian.local", pw: "Password123!", routes: ["/client-workspace", "/portal"] },
  member: { email: process.env.QA_MEMBER_EMAIL ?? "tariq.demo@example.com", pw: process.env.QA_MEMBER_PASSWORD ?? "Password123!", routes: ["/member", "/member?tab=profile", "/community", "/community?tab=connections", "/member?tab=refer", "/member?tab=privacy", "/settings/security"] },
};
const VIEWS = [{ n: "phone", w: 390, h: 844, dark: false }, { n: "desk", w: 1280, h: 860, dark: false }, { n: "desk-dark", w: 1280, h: 860, dark: true }];
const issues = []; const add = (o) => { issues.push(o); };
const b = await chromium.launch();
const ids = {};
for (const [role, cfg] of Object.entries(ROLES)) {
  for (const v of VIEWS) {
    const ctx = await b.newContext({ viewport: { width: v.w, height: v.h }, colorScheme: v.dark ? "dark" : "light", deviceScaleFactor: 1, extraHTTPHeaders: { "x-real-ip": `198.51.100.${Math.floor(Math.random() * 250) + 1}` } });
    const p = await ctx.newPage();
    let cur = ""; const errs = [];
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
    p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message.slice(0, 200)));
    p.on("response", (r) => { const u = r.url(); if (u.startsWith(B) && r.status() >= 400 && !/favicon/.test(u)) errs.push(`HTTP ${r.status()} ${u.replace(B, "")}`); });
    if (cfg.email) {
      await p.goto(B + "/login", { waitUntil: "networkidle" });
      await p.fill('input[name="email"]', cfg.email); await p.fill('input[name="password"]', cfg.pw);
      await Promise.all([p.waitForURL((u) => !/login/.test(u.pathname), { timeout: 60000 }), p.click('button[type="submit"]')]);
      await p.waitForLoadState("networkidle");
    }
    for (let route of cfg.routes) {
      if (route.includes("@")) {
        const key = route.split("@")[1];
        if (!ids[key]) { const sel = { person: 'a[href^="/network/c"]', opp: 'a[href^="/opportunities/c"]', req: 'a[href^="/requirements/c"]' }[key]; await p.goto(B + route.split("@")[0].replace(/\/$/, ""), { waitUntil: "networkidle" }); ids[key] = await p.locator(sel).first().getAttribute("href").catch(() => null); }
        if (!ids[key]) { add({ role, view: v.n, route, kind: "skip", msg: "no link found" }); continue; }
        route = ids[key];
      }
      errs.length = 0; cur = route;
      const t0 = Date.now();
      const r = await p.goto(B + route, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => { add({ role, view: v.n, route, kind: "nav", msg: e.message.slice(0, 160) }); return null; });
      const ms = Date.now() - t0;
      if (!r) continue;
      await p.waitForTimeout(600);
      if (r.status() >= 400) add({ role, view: v.n, route, kind: "status", msg: String(r.status()) });
      if (ms > 4000) add({ role, view: v.n, route, kind: "slow", msg: `${ms}ms` });
      if (/\/login/.test(p.url()) && cfg.email) add({ role, view: v.n, route, kind: "bounced", msg: p.url() });
      const m = await p.evaluate(() => {
        const cw = document.documentElement.clientWidth, out = {};
        out.overflow = document.documentElement.scrollWidth > cw + 1 ? document.documentElement.scrollWidth : 0;
        if (out.overflow) { for (const el of document.querySelectorAll("body *")) { const r = el.getBoundingClientRect(); if (r.right > cw + 1 && r.width > 0 && r.width < cw * 3) { let a = el.parentElement, clip = false; while (a && a !== document.body) { const o = getComputedStyle(a).overflowX; if (o !== "visible") { clip = true; break; } a = a.parentElement; } if (!clip) { out.culprit = `${el.tagName}.${String(el.className).slice(0, 80)} right=${Math.round(r.right)}`; break; } } } }
        const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
        out.small = [...document.querySelectorAll("a[href],button,input:not([type=hidden]),select,summary,[role=button]")].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); const inline = el.tagName === "A" && getComputedStyle(el).display === "inline"; return !inline && (Math.round(r.height) < 24 || Math.round(r.width) < 24) && el.type !== "checkbox" && el.type !== "radio"; }).slice(0, 6).map((el) => `${el.tagName} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
        out.h1 = [...document.querySelectorAll("h1")].filter(vis).length;
        out.text = document.body.innerText;
        return out;
      });
      if (m.overflow) add({ role, view: v.n, route, kind: "overflow", msg: `${m.overflow}px ${m.culprit ?? ""}` });
      if (m.h1 !== 1) add({ role, view: v.n, route, kind: "h1", msg: `${m.h1} h1 elements` });
      if (/undefined|NaN|\[object Object\]|null\b(?! on)/.test(m.text)) { const hit = m.text.match(/.{0,40}(undefined|NaN|\[object Object\]|\bnull\b).{0,40}/); add({ role, view: v.n, route, kind: "text", msg: hit?.[0]?.replace(/\s+/g, " ") }); }
      if (v.n === "phone" && m.small.length) add({ role, view: v.n, route, kind: "tap", msg: m.small.join(" | ") });
      {
        await p.evaluate(AXE);
        const ax = await p.evaluate(async (dark) => { const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] }, resultTypes: ["violations"] }); return r.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, t: x.nodes.slice(0, 3).map((nd) => nd.target.join(" ") + (nd.any?.[0]?.data?.contrastRatio ? ` (${nd.any[0].data.contrastRatio} fg ${nd.any[0].data.fgColor} bg ${nd.any[0].data.bgColor})` : "")).join(" ; ") })); }, v.dark);
        for (const x of ax) add({ role, view: v.n, route, kind: "axe:" + x.id, msg: `${x.impact} x${x.n}: ${x.t.slice(0, 300)}` });
      }
      for (const e of [...new Set(errs)]) add({ role, view: v.n, route, kind: "console", msg: e });
      const name = `${role}-${v.n}-${route.replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}`;
      await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    }
    await ctx.close();
  }
}
await b.close();
fs.writeFileSync(`${OUT}/issues.json`, JSON.stringify(issues, null, 1));
const by = {}; for (const i of issues) by[i.kind] = (by[i.kind] || 0) + 1;
// Known and accepted: the hidden file input behind the labelled drop area on Import.
const real = issues.filter((i) => !(i.kind === "tap" && /^INPUT "" 1x1$/.test(i.msg)));
for (const i of real) console.log(`${i.kind.padEnd(24)} ${i.role.padEnd(7)} ${i.view.padEnd(9)} ${i.route}  ${String(i.msg).replace(/\s+/g, " ").slice(0, 200)}`);
console.log(real.length ? `${real.length} quality issues (screens in ${OUT})` : `No quality issues. Screens in ${OUT}`);
process.exitCode = real.length ? 1 : 0;
