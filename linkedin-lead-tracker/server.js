// LinkedIn Lead Tracker — standalone server. No dependencies: `node server.js`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import * as store from "./lib/store.js";
import { toCsv } from "./lib/csv.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4300);
const HOST = process.env.HOST ?? "127.0.0.1";
const DATA_FILE = process.env.DATA_FILE ?? join(ROOT, "data", "leads.json");
const APP_PASSWORD = process.env.APP_PASSWORD ?? "";
const MAX_BODY = 15 * 1024 * 1024;

const db = new store.FileStore(DATA_FILE);
await db.load();

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json" };

function send(res, status, body, type = "application/json") {
  const payload = type === "application/json" ? JSON.stringify(body) : body;
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(payload);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new store.ValidationError("Upload too large (15 MB max)");
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new store.ValidationError("Body must be JSON"); }
}

// Optional password for when the app is deployed somewhere other than your own machine.
function authorised(req) {
  if (!APP_PASSWORD) return true;
  const m = /^Basic (.+)$/.exec(req.headers.authorization ?? "");
  if (!m) return false;
  const pass = Buffer.from(m[1], "base64").toString("utf8").split(":").slice(1).join(":");
  const a = Buffer.from(pass);
  const b = Buffer.from(APP_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function serveStatic(res, urlPath) {
  const map = urlPath === "/" ? "/public/index.html" : urlPath.startsWith("/lib/") ? urlPath : `/public${urlPath}`;
  // lib/store.js uses Node APIs and is server-only.
  if (map === "/lib/store.js") return send(res, 404, "Not found", "text/plain");
  const file = normalize(join(ROOT, map));
  if (!file.startsWith(join(ROOT, "public")) && !file.startsWith(join(ROOT, "lib"))) return send(res, 404, "Not found", "text/plain");
  try {
    send(res, 200, await readFile(file), MIME[extname(file)] ?? "application/octet-stream");
  } catch {
    send(res, 404, "Not found", "text/plain");
  }
}

async function api(req, res, path) {
  const s = db.state;
  const parts = path.split("/").filter(Boolean).slice(1); // drop "api"
  const [resource, id, sub, subId] = parts;
  const m = req.method;
  const write = async (status, body) => { await db.flush(); send(res, status, body); };

  if (resource === "state" && m === "GET") return send(res, 200, s);

  if (resource === "leads") {
    if (!id && m === "POST") return write(201, store.createLead(s, await readJson(req)));
    if (id && !sub && m === "PATCH") {
      const lead = store.updateLead(s, id, await readJson(req));
      return lead ? write(200, lead) : send(res, 404, { error: "Lead not found" });
    }
    if (id && !sub && m === "DELETE") return store.deleteLead(s, id) ? write(200, { ok: true }) : send(res, 404, { error: "Lead not found" });
    if (id && sub === "activities" && !subId && m === "POST") {
      const lead = store.addActivity(s, id, await readJson(req));
      return lead ? write(201, lead) : send(res, 404, { error: "Lead not found" });
    }
    if (id && sub === "activities" && subId && m === "DELETE") {
      const lead = store.deleteActivity(s, id, subId);
      return lead ? write(200, lead) : send(res, 404, { error: "Lead not found" });
    }
  }

  if (resource === "import" && m === "POST") return write(200, store.importCsv(s, await readJson(req)));
  if (resource === "settings" && m === "PUT") return write(200, store.saveSettings(s, await readJson(req)));
  if (resource === "followers" && !id && m === "POST") return write(201, store.logFollowers(s, await readJson(req)));
  if (resource === "followers" && id && m === "DELETE") { store.deleteFollowerEntry(s, id); return write(200, { ok: true }); }

  if (resource === "export.csv" && m === "GET") {
    res.setHeader("Content-Disposition", `attachment; filename="linkedin-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    return send(res, 200, toCsv(store.exportRows(s)), "text/csv; charset=utf-8");
  }
  if (resource === "backup" && m === "GET") {
    res.setHeader("Content-Disposition", `attachment; filename="lead-tracker-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    return send(res, 200, s);
  }
  if (resource === "restore" && m === "POST") {
    db.replace(await readJson(req));
    return write(200, db.state);
  }

  send(res, 404, { error: "Unknown endpoint" });
}

const server = createServer(async (req, res) => {
  try {
    if (!authorised(req)) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Lead Tracker"' });
      return res.end("Password required");
    }
    const path = new URL(req.url, "http://x").pathname;
    if (path.startsWith("/api/")) return await api(req, res, path);
    if (req.method !== "GET") return send(res, 405, "Method not allowed", "text/plain");
    return await serveStatic(res, path);
  } catch (err) {
    if (err instanceof store.ValidationError) return send(res, 400, { error: err.message });
    console.error(err);
    send(res, 500, { error: "Something went wrong" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`LinkedIn Lead Tracker running at http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`Data file: ${DATA_FILE}${APP_PASSWORD ? " (password protected)" : ""}`);
});
