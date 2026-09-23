/**
 * Design consistency audit. Walks every screen and reports how many distinct font families,
 * sizes, weights, radii, button heights and heading styles the interface actually uses — the
 * numbers a design system is judged on. Run the prototype on :8787 first.
 *
 *   node prototype/build.mjs && (cd prototype/dist && python3 -m http.server 8787 &) && node tools/design-audit.mjs
 */
import { chromium } from "playwright-core";
import { readFileSync } from "fs";

// reuse the QA page list so the audit can never drift from the sweep
const src = readFileSync(new URL("./layout-qa.mjs", import.meta.url), "utf8");
const PAGES = eval(src.slice(src.indexOf("const PAGES ="), src.indexOf("];", src.indexOf("const PAGES =")) + 2).replace("const PAGES =", ""));
const U = "http://localhost:8787/index.html";

const collect = () => {
  const main = document.getElementById("main"); if (!main) return null;
  const fams = {}, sizes = {}, weights = {}, radii = {}, colors = {}, btnH = {}, heads = {};
  const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
  const norm = (f) => (f.split(",")[0] || "").replace(/["']/g, "").trim();

  for (const el of main.querySelectorAll("*")) {
    if (el.tagName.includes("-")) continue;                 // custom elements own their shadow styles
    const cs = getComputedStyle(el);
    if (cs.display === "none" || !el.getClientRects().length) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText) {
      bump(fams, norm(cs.fontFamily));
      bump(sizes, cs.fontSize);
      bump(weights, cs.fontWeight);
      bump(colors, cs.color);
    }
    const r = cs.borderTopLeftRadius;
    if (r !== "0px" && (cs.borderStyle !== "none" || cs.backgroundColor !== "rgba(0, 0, 0, 0)")) bump(radii, r);
    if (el.tagName === "BUTTON" || (el.tagName === "A" && el.className && String(el.className).includes("btn")))
      bump(btnH, Math.round(el.getBoundingClientRect().height) + "px");
    if (/^H[1-4]$/.test(el.tagName)) bump(heads, `${el.tagName} ${cs.fontSize}/${cs.fontWeight}`);
  }
  return { fams, sizes, weights, radii, colors, btnH, heads };
};

const merge = (into, from) => { for (const k of Object.keys(from)) for (const kk of Object.keys(from[k])) into[k][kk] = (into[k][kk] || 0) + from[k][kk]; };

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const all = { fams: {}, sizes: {}, weights: {}, radii: {}, colors: {}, btnH: {}, heads: {} };
const perPage = {};
for (const [hash, name] of PAGES) {
  await p.goto(U + hash); await p.waitForTimeout(500);
  const r = await p.evaluate(collect);
  if (!r) continue;
  merge(all, r); perPage[name] = r;
}
await b.close();

const show = (title, o, { limit = 40, rare = 0 } = {}) => {
  const rows = Object.entries(o).sort((a, c) => c[1] - a[1]).filter(([, n]) => n >= rare);
  console.log(`\n── ${title} (${Object.keys(o).length} distinct) ──`);
  for (const [k, n] of rows.slice(0, limit)) console.log(String(n).padStart(6), k);
};
show("font families", all.fams);
show("font sizes", all.sizes);
show("font weights", all.weights);
show("border radii", all.radii);
show("button heights", all.btnH);
show("heading styles", all.heads);

console.log("\n── one-offs (used fewer than 4 times) ──");
for (const key of ["sizes", "weights", "radii"]) {
  const odd = Object.entries(all[key]).filter(([, n]) => n < 4).sort((a, c) => a[1] - c[1]);
  if (odd.length) console.log(` ${key}:`, odd.map(([k, n]) => `${k}×${n}`).join("  "));
}
