/**
 * Parsers for the spreadsheets LinkedIn lets you download:
 *
 * 1. Creator analytics export: linkedin.com/analytics/creator/content -> Export.
 *    Sheets: DISCOVERY, ENGAGEMENT, TOP POSTS, FOLLOWERS, DEMOGRAPHICS.
 * 2. Single-post export: open a post's analytics -> Export.
 *    Sheet PERFORMANCE holds label/value rows (Impressions, Reactions, Saves, ...).
 *
 * LinkedIn changes headers now and then, so everything here matches labels loosely
 * and looks for header rows instead of assuming fixed positions.
 */
import type { Metrics } from "./types";
import { emptyMetrics } from "./types";

export type Cell = string | number | Date | null;
export type Sheet = { name: string; rows: Cell[][] };

export interface DailyRow {
  day: string; // YYYY-MM-DD
  impressions?: number;
  engagements?: number;
  newFollowers?: number;
}

export interface TopPostRow {
  url: string;
  activityId: string | null;
  publishedOn: string | null;
  engagements?: number;
  impressions?: number;
}

export interface CreatorExport {
  kind: "creator";
  period: { start: string | null; end: string | null };
  totals: { impressions: number | null; membersReached: number | null };
  daily: DailyRow[];
  topPosts: TopPostRow[];
  totalFollowers: { count: number; asOf: string | null } | null;
  demographics: { category: string; value: string; percent: number | null }[];
}

export interface SinglePostExport {
  kind: "post";
  url: string | null;
  activityId: string | null;
  publishedOn: string | null;
  metrics: Metrics;
  demographics: { category: string; value: string; percent: number | null }[];
}

export type ParsedExport = CreatorExport | SinglePostExport;

// ── helpers ──────────────────────────────────────────────────────────

const norm = (v: Cell) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function toNumber(v: Cell): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return null;
  const s = String(v).replace(/[,\s]/g, "").replace(/%$/, "");
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Accepts Date cells, ISO strings and LinkedIn's US-style M/D/YYYY strings. */
export function toDay(v: Cell): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    if (v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

/** Pulls the numeric post id out of any LinkedIn post URL or URN. */
export function activityIdFrom(urlOrUrn: string | null | undefined): string | null {
  if (!urlOrUrn) return null;
  const m = String(urlOrUrn).match(/(?:activity|share|ugcPost)(?::|%3A|-)(\d{15,25})/i);
  return m ? m[1] : null;
}

function sheetNamed(sheets: Sheet[], ...names: string[]): Sheet | undefined {
  const want = names.map((n) => n.toLowerCase());
  return sheets.find((s) => want.includes(s.name.trim().toLowerCase()));
}

function findHeaderRow(rows: Cell[][], mustHave: string[]): number {
  return rows.findIndex((r) => mustHave.every((h) => r.some((c) => norm(c).includes(h))));
}

/** Label/value pairs from a sheet laid out as rows of "Label | Value". */
function keyValues(rows: Cell[][]): Map<string, Cell> {
  const out = new Map<string, Cell>();
  for (const r of rows) {
    const label = norm(r[0]).replace(/:$/, "");
    if (label && !out.has(label)) out.set(label, r[1] ?? null);
  }
  return out;
}

function lookup(kv: Map<string, Cell>, ...needles: string[]): Cell {
  for (const needle of needles) {
    for (const [k, v] of kv) if (k === needle) return v;
  }
  for (const needle of needles) {
    for (const [k, v] of kv) if (k.includes(needle)) return v;
  }
  return null;
}

function demographicsFrom(sheet: Sheet | undefined) {
  if (!sheet) return [];
  const h = findHeaderRow(sheet.rows, ["value"]);
  if (h < 0) return [];
  return sheet.rows
    .slice(h + 1)
    .filter((r) => r[0] != null && r[1] != null)
    .map((r) => {
      const pct = toNumber(r[2]);
      return {
        category: String(r[0]).trim(),
        value: String(r[1]).trim(),
        // LinkedIn writes either 0.12 or "12%"
        percent: pct == null ? null : pct <= 1 && !String(r[2]).includes("%") ? Math.round(pct * 1000) / 10 : pct,
      };
    });
}

// ── creator analytics export ────────────────────────────────────────

export function parseCreatorExport(sheets: Sheet[]): CreatorExport {
  const discovery = sheetNamed(sheets, "DISCOVERY");
  const engagement = sheetNamed(sheets, "ENGAGEMENT");
  const top = sheetNamed(sheets, "TOP POSTS");
  const followers = sheetNamed(sheets, "FOLLOWERS");

  // DISCOVERY: "Overall Performance | 10/17/2025 - 11/15/2025", "Impressions | 12345", "Members reached | 6789"
  const kv = keyValues(discovery?.rows ?? []);
  const periodCell = String(lookup(kv, "overall performance") ?? "");
  const [ps, pe] = periodCell.split(/\s+-\s+/).map((s) => toDay(s));
  const totals = {
    impressions: toNumber(lookup(kv, "impressions")),
    membersReached: toNumber(lookup(kv, "members reached")),
  };

  const byDay = new Map<string, DailyRow>();
  const row = (day: string) => byDay.get(day) ?? (byDay.set(day, { day }), byDay.get(day)!);

  if (engagement) {
    const h = findHeaderRow(engagement.rows, ["date", "impressions"]);
    if (h >= 0) {
      const header = engagement.rows[h].map(norm);
      const di = header.findIndex((c) => c === "date");
      const ii = header.findIndex((c) => c.includes("impressions"));
      const ei = header.findIndex((c) => c.includes("engagement"));
      for (const r of engagement.rows.slice(h + 1)) {
        const day = toDay(r[di]);
        if (!day) continue;
        const d = row(day);
        d.impressions = toNumber(r[ii]) ?? undefined;
        if (ei >= 0) d.engagements = toNumber(r[ei]) ?? undefined;
      }
    }
  }

  let totalFollowers: CreatorExport["totalFollowers"] = null;
  if (followers) {
    for (const r of followers.rows) {
      const label = norm(r[0]);
      if (label.startsWith("total followers")) {
        const asOf = toDay(label.replace(/^total followers on\s*/, "").replace(/:$/, "")) ?? pe ?? null;
        const count = toNumber(r[1]);
        if (count != null) totalFollowers = { count, asOf };
      }
    }
    const h = findHeaderRow(followers.rows, ["date", "new followers"]);
    if (h >= 0) {
      const header = followers.rows[h].map(norm);
      const di = header.findIndex((c) => c === "date");
      const fi = header.findIndex((c) => c.includes("new followers"));
      for (const r of followers.rows.slice(h + 1)) {
        const day = toDay(r[di]);
        if (day) row(day).newFollowers = toNumber(r[fi]) ?? undefined;
      }
    }
  }

  // TOP POSTS: two side-by-side tables, one ranked by engagements and one by impressions.
  const posts = new Map<string, TopPostRow>();
  if (top) {
    const h = findHeaderRow(top.rows, ["post url"]);
    if (h >= 0) {
      const header = top.rows[h].map(norm);
      const blocks: { url: number; date: number; metric: number; key: "engagements" | "impressions" }[] = [];
      header.forEach((c, i) => {
        if (c !== "post url") return;
        const date = header.findIndex((x, j) => j > i && x.includes("publish date"));
        const metric = header.findIndex((x, j) => j > i && (x.includes("engagements") || x.includes("impressions")));
        if (metric > i) blocks.push({ url: i, date, metric, key: header[metric].includes("impressions") ? "impressions" : "engagements" });
      });
      for (const r of top.rows.slice(h + 1)) {
        for (const b of blocks) {
          const url = r[b.url] == null ? "" : String(r[b.url]).trim();
          if (!url.startsWith("http")) continue;
          const id = activityIdFrom(url) ?? url;
          const p = posts.get(id) ?? { url, activityId: activityIdFrom(url), publishedOn: toDay(r[b.date]) };
          p[b.key] = toNumber(r[b.metric]) ?? undefined;
          posts.set(id, p);
        }
      }
    }
  }

  return {
    kind: "creator",
    period: { start: ps ?? null, end: pe ?? null },
    totals,
    daily: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    topPosts: [...posts.values()],
    totalFollowers,
    demographics: demographicsFrom(sheetNamed(sheets, "DEMOGRAPHICS")),
  };
}

// ── single-post export ───────────────────────────────────────────────

export function parseSinglePostExport(sheets: Sheet[]): SinglePostExport {
  const perf = sheetNamed(sheets, "PERFORMANCE") ?? sheets[0];
  const kv = keyValues(perf?.rows ?? []);
  const num = (...labels: string[]) => toNumber(lookup(kv, ...labels));
  const url = (lookup(kv, "post url") as string | null) ?? null;

  const metrics: Metrics = {
    ...emptyMetrics(),
    impressions: num("impressions"),
    membersReached: num("members reached"),
    reactions: num("reactions"),
    comments: num("comments"),
    reposts: num("reposts"),
    saves: num("saves"),
    sends: num("sends on linkedin", "sends"),
    profileViews: num("profile viewers from this post", "profile viewers", "profile views"),
    followersGained: num("followers gained from this post", "followers gained"),
    linkClicks: num("link clicks", "clicks"),
    engagements: num("engagements"),
  };

  return {
    kind: "post",
    url: url ? String(url) : null,
    activityId: activityIdFrom(url ? String(url) : null),
    publishedOn: toDay(lookup(kv, "post date", "post publish date", "published")),
    metrics,
    demographics: demographicsFrom(sheetNamed(sheets, "TOP DEMOGRAPHICS", "DEMOGRAPHICS")),
  };
}

export function parseSheets(sheets: Sheet[]): ParsedExport {
  const names = sheets.map((s) => s.name.trim().toUpperCase());
  if (names.includes("PERFORMANCE")) return parseSinglePostExport(sheets);
  if (names.some((n) => ["DISCOVERY", "ENGAGEMENT", "TOP POSTS", "FOLLOWERS"].includes(n))) return parseCreatorExport(sheets);
  throw new Error(
    `This doesn't look like a LinkedIn analytics export (sheets: ${sheets.map((s) => s.name).join(", ") || "none"}).`,
  );
}

/** Reads an .xlsx buffer into plain rows, then parses it. */
export async function parseWorkbook(buf: ArrayBuffer | Buffer): Promise<ParsedExport> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  // exceljs' Buffer typing lags Node's; the runtime accepts both.
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const sheets: Sheet[] = wb.worksheets.map((ws) => {
    const rows: Cell[][] = [];
    ws.eachRow({ includeEmpty: true }, (r, i) => {
      const vals = (r.values as unknown[]).slice(1).map(cellValue);
      rows[i - 1] = vals;
    });
    return { name: ws.name, rows: Array.from(rows, (r) => r ?? []) };
  });
  return parseSheets(sheets);
}

function cellValue(v: unknown): Cell {
  if (v == null) return null;
  if (v instanceof Date || typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellValue(o.result);
    if ("text" in o) return String(o.text); // hyperlinks
    if ("hyperlink" in o) return String(o.hyperlink);
    if ("richText" in o && Array.isArray(o.richText)) return o.richText.map((t: { text: string }) => t.text).join("");
  }
  return String(v);
}
