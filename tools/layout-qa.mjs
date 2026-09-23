/**
 * Layout QA. Every page at four widths, checking for sideways scroll, text overflow, elements
 * outside their column, controls below a comfortable tap target and misaligned card headings.
 */
import { chromium } from "playwright-core";

const PAGES = [
  ["#/overview", "Overview"], ["#/intelligence", "Intelligence"], ["#/performance", "Performance"], ["#/network", "Experts"],
  ["#/people/p-sarah", "Person"], ["#/requirements", "Requirements"], ["#/requirements/b-1", "Requirement"],
  ["#/referrals", "Referrals"], ["#/conversations", "Conversations"], ["#/amana", "Amana"],
  ["#/partners", "Partners"], ["#/relocation", "Relocation"], ["#/import", "Import"],
  ["#/settings", "Settings"], ["#/settings?tab=commercials", "Commercials"], ["#/settings?tab=screening", "Screening cfg"],
  ["#/settings?tab=privacy", "Privacy"], ["#/settings?tab=security", "Security"], ["#/settings?tab=audit", "Audit"], ["#/settings?tab=screening&edit=1", "Script editor"], ["#/member", "Member"], ["#/join", "Join"],
  ["#/portal?account=ac-clienta", "Client portal"], ["#/portal?account=ac-gulf", "Agency portal"],
  ["#/opportunities", "Opportunities"], ["#/portal?account=ac-clienta&tab=terms", "Client terms"], ["#/portal?account=ac-gulf&tab=terms", "Agency terms"], ["#/member?tab=privacy", "Member privacy"], ["#/screening/p-leila?restart=1", "Screening lobby"],
];
const WIDTHS = [1440, 1180, 900, 390];
const U = "http://localhost:8787/index.html";

const audit = () => {
  const issues = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 2) issues.push(`page scrolls sideways by ${doc.scrollWidth - doc.clientWidth}px`);
  const main = document.getElementById("main");
  if (!main) return issues;
  const mainBox = main.getBoundingClientRect();
  // An element inside a scroller is allowed to be wider than the column: that is what the scroller is for.
  const inScroller = (el) => { let n = el.parentElement; while (n && n !== main) { const o = getComputedStyle(n); if (o.overflowX === "auto" || o.overflowX === "scroll" || o.overflow === "hidden" || o.overflowX === "hidden") return true; n = n.parentElement; } return false; };
  for (const el of main.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || !el.getClientRects().length) continue;
    if (inScroller(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // content wider than its own box, with no scroll and no ellipsis to explain it
    // A custom element's shadow layout is its own business (overlapping discs, dials); the
    // "sticks out of the column" rule below still catches a genuine overflow.
    if (!el.tagName.includes("-") && el.scrollWidth > el.clientWidth + 2 && cs.overflowX === "visible" && cs.textOverflow !== "ellipsis" && el.children.length === 0) {
      issues.push(`text overflows: <${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""}> "${(el.textContent || "").trim().slice(0, 34)}"`);
    }
    // anything sticking out past the main column
    if (r.right > mainBox.right + 3 || r.left < mainBox.left - 3) {
      const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      if (!["HTML", "BODY"].includes(el.tagName) && cs.position !== "fixed") issues.push(`sticks out of the column: <${el.tagName.toLowerCase()}${cls ? "." + cls : ""}>`);
    }
    // a button or control shorter than a comfortable tap target
    if (el.tagName === "BUTTON" && !el.className.includes("pick-chip") && r.height > 0 && r.height < 26) {
      issues.push(`control only ${Math.round(r.height)}px tall: "${(el.textContent || "").trim().slice(0, 24)}"`);
    }
  }
  // Card headings must start where the card's content starts: a lone heading pushed to the right
  // edge (or centred) is the classic grid-alignment slip, and no overflow check catches it.
  for (const card of main.querySelectorAll(".card")) {
    const head = card.querySelector(":scope > header"); if (!head) continue;
    const title = head.querySelector("h3"); if (!title) continue;
    const hs = getComputedStyle(head);
    const base = head.getBoundingClientRect().left + (parseFloat(hs.paddingLeft) || 0) + (parseFloat(hs.borderLeftWidth) || 0);
    const t = title.getBoundingClientRect();
    if (t.left - base > 3) issues.push(`card heading is off its left edge by ${Math.round(t.left - base)}px: "${title.textContent.trim().slice(0, 28)}"`);
  }
  return [...new Set(issues)];
};

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let total = 0;
for (const width of WIDTHS) {
  const p = await b.newPage({ viewport: { width, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  console.log(`\n── ${width}px ──`);
  for (const [hash, name] of PAGES) {
    await p.goto(U + hash); await p.waitForTimeout(520);
    const issues = await p.evaluate(audit);
    if (issues.length || errs.length) {
      total += issues.length + errs.length;
      console.log(`${name.padEnd(16)} ${issues.slice(0, 4).join(" | ")}${errs.length ? ` || JS: ${errs[0]}` : ""}`);
      errs.length = 0;
    }
  }
  await p.close();
}
console.log(`\ntotal issues: ${total}`);
await b.close();
