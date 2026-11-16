/**
 * In-memory stand-in for the Notion API, so the end-to-end tests never touch a real workspace.
 * Implements just what the app uses: data source queries (with the filters it sends), page create,
 * update and retrieve. POST /__reset clears everything.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
const PORT = Number(process.env.MOCK_NOTION_PORT ?? 4999);
const pages = new Map(); // id -> {ds, properties, created_time}
const rt = (arr) => (arr ?? []).map((t) => ({ type: "text", text: t.text, plain_text: t.text.content, annotations: {} }));
function toResp(props, prev = {}) {
  const out = { ...prev };
  for (const [k, v] of Object.entries(props)) {
    if ("title" in v) out[k] = { type: "title", title: rt(v.title) };
    else if ("rich_text" in v) out[k] = { type: "rich_text", rich_text: rt(v.rich_text) };
    else if ("number" in v) out[k] = { type: "number", number: v.number };
    else if ("select" in v) out[k] = { type: "select", select: v.select ? { name: v.select.name } : null };
    else if ("multi_select" in v) out[k] = { type: "multi_select", multi_select: v.multi_select };
    else if ("date" in v) out[k] = { type: "date", date: v.date };
    else if ("url" in v) out[k] = { type: "url", url: v.url };
    else if ("relation" in v) out[k] = { type: "relation", relation: v.relation };
    else if ("checkbox" in v) out[k] = { type: "checkbox", checkbox: v.checkbox };
    else if ("email" in v) out[k] = { type: "email", email: v.email };
  }
  return out;
}
const pageObj = (id, p) => ({ object: "page", id, created_time: p.created_time, last_edited_time: p.created_time, url: `https://notion.so/${id.replace(/-/g, "")}`, parent: { type: "data_source_id", data_source_id: p.ds }, properties: p.properties, in_trash: !!p.trash, archived: false, icon: null, cover: null, created_by: { object: "user", id: "u" }, last_edited_by: { object: "user", id: "u" }, public_url: null, is_locked: false });
function matches(p, f) {
  if (!f) return true;
  const prop = p.properties[f.property];
  if (f.relation?.contains) return prop?.relation?.some((r) => r.id === f.relation.contains);
  if (f.title?.equals != null) return (prop?.title ?? []).map((t) => t.plain_text).join("") === f.title.equals;
  if (f.date?.on_or_after) return (prop?.date?.start ?? "") >= f.date.on_or_after;
  return true;
}
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const json = body ? JSON.parse(body) : {};
  const send = (o, s = 200) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (req.url === "/__reset") { pages.clear(); return send({ ok: true }); }
  const url = req.url.replace(/^\/v1/, "");
  let m;
  if ((m = url.match(/^\/data_sources\/([^/]+)\/query/))) {
    let rows = [...pages.entries()].filter(([, p]) => p.ds === m[1] && !p.trash && matches(p, json.filter));
    rows.sort((a, b) => b[1].created_time.localeCompare(a[1].created_time));
    return send({ object: "list", results: rows.map(([id, p]) => pageObj(id, p)), has_more: false, next_cursor: null, type: "page_or_data_source", page_or_data_source: {} });
  }
  if (url === "/pages" && req.method === "POST") {
    const id = randomUUID();
    const p = { ds: json.parent.data_source_id, properties: toResp(json.properties), created_time: new Date(Date.now() + pages.size).toISOString() };
    pages.set(id, p); return send(pageObj(id, p));
  }
  if ((m = url.match(/^\/pages\/([^/?]+)/))) {
    const p = pages.get(m[1]); if (!p) return send({ object: "error", status: 404, code: "object_not_found", message: "nope" }, 404);
    if (req.method === "PATCH") { p.properties = toResp(json.properties ?? {}, p.properties); if (json.in_trash) p.trash = true; }
    return send(pageObj(m[1], p));
  }
  send({ object: "error", status: 400, code: "invalid_request", message: `mock: ${req.method} ${url}` }, 400);
}).listen(PORT, () => console.log(`mock notion on ${PORT}`));
