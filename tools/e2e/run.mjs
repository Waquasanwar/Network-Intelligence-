/** Runs every journey in order and exits non-zero if any step failed. */
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// Order matters: later journeys use people and requirements the earlier ones create.
const suites = ["release", "owner", "network", "roles", "privacy", "money", "misc", "standard", "community", "clutter", "security"];

// Everything is closed until the owner releases it. The release journey checks that with every
// switch off; the rest run with everything released (earnings stays off: the community journey
// switches it on and off itself). The owner's own choices are put back at the end.
let db = process.env.DATABASE_URL;
if (!db && existsSync(".env")) db = /^DATABASE_URL="?([^"\n]+)"?/m.exec(readFileSync(".env", "utf8"))?.[1];
const q = (sql) => execFileSync("psql", [db.split("?")[0], "-Atc", sql]).toString().trim();
const tenant = q(`select "tenantId" from "User" where email='waqas@networkintelligence.local'`);
const saved = q(`select coalesce(features::text, '{}') from "Tenant" where id='${tenant}'`);
const RELEASED = JSON.stringify({ memberArea: true, memberScreening: true, readAloud: true, memberReferrals: true, communityBoard: true, memberConnections: true, memberPhotos: true, clientPortal: true, agencyPortal: true, publicApplications: true });
let failed = 0;
process.on("exit", () => q(`update "Tenant" set features='${saved.replace(/'/g, "''")}'::jsonb where id='${tenant}'`));
for (const s of suites) {
  if (s === "owner") q(`update "Tenant" set features='${RELEASED}'::jsonb where id='${tenant}'`);
  console.log(`\n=== ${s} ===`);
  const r = spawnSync(process.execPath, [join(here, `${s}.mjs`)], { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });
  process.stdout.write(r.stdout);
  if (r.status !== 0 || /^FAIL /m.test(r.stdout)) failed++;
}
console.log(failed ? `\n${failed} of ${suites.length} journeys had failures` : `\nAll ${suites.length} journeys passed`);
process.exit(failed ? 1 : 0);
