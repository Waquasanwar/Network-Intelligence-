/** Run the metrics sync once from the command line: npm run sync */
import { runSync } from "../lib/sync";

runSync()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.errors.length ? 2 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
