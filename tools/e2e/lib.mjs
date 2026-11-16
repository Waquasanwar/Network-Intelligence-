/**
 * Shared helpers for the end-to-end journeys. They drive the real app in a browser and check the
 * database afterwards, so they need a running app and a seeded local database:
 *
 *   npm run db:fresh && npm run dev        # in one terminal
 *   npm run test:e2e                        # in another
 *
 * Environment: E2E_BASE_URL (default http://localhost:3000), DATABASE_URL (from .env), E2E_OUT
 * (screenshots; default a temp folder), PLAYWRIGHT_PATH (if playwright is not resolvable by name).
 * They create people, accounts and invitations: run them against a local database only.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const DIR = process.env.E2E_OUT ?? join(tmpdir(), "ni-e2e");
mkdirSync(DIR, { recursive: true });
/** The seeded demo password, and the one the journeys register new members with. */
export const PW = "Password123!";
export const NEWPW = "Harbour-lights-2031";

function databaseUrl() {
  let url = process.env.DATABASE_URL;
  if (!url && existsSync(".env")) url = /^DATABASE_URL="?([^"\n]+)"?/m.exec(readFileSync(".env", "utf8"))?.[1];
  if (!url) throw new Error("Set DATABASE_URL (or run from the repository root with a .env)");
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url) && process.env.E2E_ALLOW_REMOTE_DB !== "yes") throw new Error("Refusing to run against a database that is not local.");
  return url.split("?")[0];
}
const DB = databaseUrl();
export const sql = (q) => execFileSync("psql", [DB, "-Atc", q]).toString().trim();
export const results = [];
export async function launch() { return chromium.launch(); }
export async function session(b, email, pw = PW) {
  // Each browser gets its own client address, as real visitors do behind the hosting platform;
  // otherwise every test session shares one sign-in throttle bucket.
  const ctx = await b.newContext({ viewport: { width: 1360, height: 950 }, extraHTTPHeaders: { "x-real-ip": `198.51.100.${Math.floor(Math.random() * 250) + 1}` } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push("PAGEERROR " + e.message.slice(0, 160)));
  p.on("response", (r) => { if (r.status() >= 500) p.errs.push(`HTTP ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  if (email) {
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await p.fill('input[name="email"]', email); await p.fill('input[name="password"]', pw);
    await p.click('button[type="submit"]'); await p.waitForURL((u) => !/login/.test(u.pathname), { timeout: 30000 });
  }
  return p;
}
export async function step(name, p, fn) {
  if (p) p.errs.length = 0;
  try {
    const note = await fn();
    const errs = p ? [...p.errs] : [];
    if (errs.length) { results.push({ name, ok: false, why: errs.join("; ") }); console.log(`FAIL ${name} :: ${errs.join("; ")}`); }
    else { results.push({ name, ok: true }); console.log(`PASS ${name}${note ? " — " + note : ""}`); }
  } catch (e) {
    const file = `${DIR}/fail-${name.replace(/[^a-z0-9]+/gi, "-").slice(0, 50)}.png`;
    if (p) await p.screenshot({ path: file }).catch(() => {});
    const extra = p ? [...p.errs].join("; ") : "";
    results.push({ name, ok: false, why: e.message.split("\n")[0].slice(0, 220) });
    console.log(`FAIL ${name} :: ${e.message.split("\n")[0].slice(0, 220)} ${extra} @ ${p ? new URL(p.url()).pathname : ""}`);
    if (p) await p.keyboard.press("Escape").catch(() => {});
  }
}
export const assert = (c, m) => { if (!c) throw new Error("assert: " + m); };
export const dialog = (p) => p.locator('[role="dialog"]:visible').last();
export async function submitIn(scope, label) { const btn = scope.getByRole("button", { name: label }).last(); await btn.scrollIntoViewIfNeeded(); await btn.click(); }
export function summary() { const bad = results.filter((r) => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} passed`); for (const r of bad) console.log(" ✗", r.name, "::", r.why); }
