/** Runs every journey in order and exits non-zero if any step failed. */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// Order matters: later journeys use people and requirements the earlier ones create.
const suites = ["owner", "network", "roles", "privacy", "money", "misc", "standard", "clutter"];
let failed = 0;
for (const s of suites) {
  console.log(`\n=== ${s} ===`);
  const r = spawnSync(process.execPath, [join(here, `${s}.mjs`)], { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });
  process.stdout.write(r.stdout);
  if (r.status !== 0 || /^FAIL /m.test(r.stdout)) failed++;
}
console.log(failed ? `\n${failed} of ${suites.length} journeys had failures` : `\nAll ${suites.length} journeys passed`);
process.exit(failed ? 1 : 0);
