import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const result = await build({
  entryPoints: [path.join(here, "src/app.ts")],
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  write: false,
  alias: { "@": path.join(root, "src") },
  logLevel: "warning",
  define: { "process.env.AVAILABILITY_STALE_DAYS": "\"45\"", "process.env.NODE_ENV": "\"production\"" },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = readFileSync(path.join(here, "template.html"), "utf8").replace("/*APP*/", () => js);
mkdirSync(path.join(here, "dist"), { recursive: true });
writeFileSync(path.join(here, "dist/index.html"), html);
console.log(`prototype/dist/index.html: ${(html.length / 1024).toFixed(0)} KB (js ${(js.length / 1024).toFixed(0)} KB)`);
