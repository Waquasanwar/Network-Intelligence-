/**
 * Notion is the database. Every read and write in the app goes through here.
 * Property names match lib/schema.ts; rename a column in Notion and you rename it here too.
 */
import { Client, isFullPage } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { env } from "./env";
import { engagementRate, scorePosts } from "./scoring";
import { classifyFunction, classifySeniority, EMPTY_ICP, type Func, type Icp, type Person, type Seniority } from "./people";
import type { ArchiveConnection } from "./archive";
import type { DailyMetric, MetricSource, Metrics, Post, Ratings, Snapshot, Status, SwipeItem } from "./types";

let client: Client | null = null;
export function notion(): Client {
  if (!env.notionToken()) throw new Error("NOTION_TOKEN is not set. See .env.example.");
  // NOTION_BASE_URL is only for pointing tests at a mock server.
  client ??= new Client({ auth: env.notionToken(), ...(process.env.NOTION_BASE_URL ? { baseUrl: process.env.NOTION_BASE_URL } : {}) });
  return client;
}

// ── property readers ─────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type Props = Record<string, any>;
const plain = (rt: { plain_text: string }[] | undefined) => (rt ?? []).map((t) => t.plain_text).join("");
const r = {
  title: (p: Props, k: string) => plain(p[k]?.title),
  text: (p: Props, k: string) => plain(p[k]?.rich_text),
  num: (p: Props, k: string): number | null => (typeof p[k]?.number === "number" ? p[k].number : null),
  select: (p: Props, k: string): string | null => p[k]?.select?.name ?? null,
  multi: (p: Props, k: string): string[] => (p[k]?.multi_select ?? []).map((o: { name: string }) => o.name),
  date: (p: Props, k: string): string | null => p[k]?.date?.start ?? null,
  url: (p: Props, k: string): string | null => p[k]?.url ?? null,
  relation: (p: Props, k: string): string | null => p[k]?.relation?.[0]?.id ?? null,
};

// ── property writers ─────────────────────────────────────────────────

/** Notion caps each rich-text segment at 2,000 characters, so long posts are split. */
export function richText(s: string) {
  const chunks: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < s.length; i += 2000) chunks.push({ type: "text", text: { content: s.slice(i, i + 2000) } });
  return chunks;
}
const w = {
  title: (s: string) => ({ title: richText(s.slice(0, 2000)) }),
  text: (s: string) => ({ rich_text: richText(s) }),
  num: (v: number | null | undefined) => ({ number: v ?? null }),
  select: (v: string | null | undefined) => ({ select: v ? { name: v.replace(/,/g, " ") } : null }),
  multi: (vs: string[]) => ({ multi_select: vs.map((name) => ({ name: name.replace(/,/g, " ") })) }),
  date: (v: string | null | undefined) => ({ date: v ? { start: v } : null }),
  url: (v: string | null | undefined) => ({ url: v || null }),
  relation: (id: string) => ({ relation: [{ id }] }),
};

async function queryAll(dataSourceId: string, body: Record<string, unknown> = {}): Promise<PageObjectResponse[]> {
  const out: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion().dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
      ...body,
    } as Parameters<Client["dataSources"]["query"]>[0]);
    for (const p of res.results) if (p.object === "page" && isFullPage(p)) out.push(p);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

async function createPage(dataSourceId: string, properties: Props) {
  const page = await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties,
  } as Parameters<Client["pages"]["create"]>[0]);
  return page.id;
}

async function updatePage(pageId: string, properties: Props) {
  await notion().pages.update({ page_id: pageId, properties } as Parameters<Client["pages"]["update"]>[0]);
}

// ── posts ────────────────────────────────────────────────────────────

function toPost(page: PageObjectResponse): Post {
  const p = page.properties as Props;
  const metrics: Metrics = {
    impressions: r.num(p, "Impressions"),
    membersReached: r.num(p, "Members reached"),
    reactions: r.num(p, "Reactions"),
    comments: r.num(p, "Comments"),
    reposts: r.num(p, "Reposts"),
    saves: r.num(p, "Saves"),
    sends: r.num(p, "Sends"),
    profileViews: r.num(p, "Profile views"),
    followersGained: r.num(p, "Followers gained"),
    linkClicks: r.num(p, "Link clicks"),
    engagements: r.num(p, "Engagements"),
  };
  const er = r.num(p, "Engagement rate");
  return {
    id: page.id,
    url: page.url,
    title: r.title(p, "Title"),
    status: (r.select(p, "Status") ?? "Idea") as Status,
    text: r.text(p, "Text"),
    pillar: r.select(p, "Pillar"),
    format: r.select(p, "Format"),
    hookType: r.select(p, "Hook type"),
    tags: r.multi(p, "Tags"),
    ratings: {
      hook: r.num(p, "Rating: hook"),
      clarity: r.num(p, "Rating: clarity"),
      value: r.num(p, "Rating: value"),
      voice: r.num(p, "Rating: voice"),
      gut: r.num(p, "Gut score"),
    },
    aiScore: r.num(p, "AI score"),
    aiNotes: r.text(p, "AI notes"),
    plannedFor: r.date(p, "Planned for"),
    publishedAt: r.date(p, "Published at"),
    linkedinUrl: r.url(p, "LinkedIn URL") ?? (r.text(p, "LinkedIn URN") ? `https://www.linkedin.com/feed/update/${r.text(p, "LinkedIn URN")}/` : null),
    linkedinUrn: r.text(p, "LinkedIn URN") || null,
    metrics,
    // Stored as a Notion percent (0.042 shows as 4.2%); the app works in percentage points.
    engagementRate: er == null ? null : Math.round(er * 10000) / 100,
    performanceScore: r.num(p, "Performance score"),
    rank: r.num(p, "Rank"),
    metricsSource: r.select(p, "Metrics source") as MetricSource | null,
    lastSynced: r.date(p, "Last synced"),
    createdAt: page.created_time,
  };
}

export async function listPosts(): Promise<Post[]> {
  const pages = await queryAll(env.ds.posts(), {
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });
  return withLiveScores(pages.map(toPost));
}

/**
 * Scores and ranks are always recomputed from the metrics on read, so a post whose numbers were
 * typed straight into Notion ranks immediately, without waiting for a sync or import.
 */
export function withLiveScores(posts: Post[]): Post[] {
  const scored = new Map(scorePosts(posts.filter((p) => p.status === "Published")).map((s) => [s.id, s]));
  return posts.map((p) => {
    const s = scored.get(p.id);
    return s
      ? { ...p, performanceScore: s.performanceScore, rank: s.rank, engagementRate: s.engagementRate }
      : { ...p, performanceScore: null, rank: null, engagementRate: engagementRate(p.metrics) };
  });
}

export async function getPost(id: string): Promise<Post | null> {
  try {
    const page = await notion().pages.retrieve({ page_id: id });
    return isFullPage(page) ? toPost(page) : null;
  } catch {
    return null;
  }
}

export interface PostInput {
  title?: string;
  status?: Status;
  text?: string;
  pillar?: string | null;
  format?: string | null;
  hookType?: string | null;
  tags?: string[];
  ratings?: Partial<Ratings>;
  aiScore?: number | null;
  aiNotes?: string;
  plannedFor?: string | null;
  publishedAt?: string | null;
  linkedinUrl?: string | null;
  linkedinUrn?: string | null;
}

function postProps(input: PostInput): Props {
  const p: Props = {};
  if (input.title !== undefined) p.Title = w.title(input.title);
  if (input.status !== undefined) p.Status = w.select(input.status);
  if (input.text !== undefined) p.Text = w.text(input.text);
  if (input.pillar !== undefined) p.Pillar = w.select(input.pillar);
  if (input.format !== undefined) p.Format = w.select(input.format);
  if (input.hookType !== undefined) p["Hook type"] = w.select(input.hookType);
  if (input.tags !== undefined) p.Tags = w.multi(input.tags);
  if (input.ratings) {
    const map: Record<keyof Ratings, string> = {
      hook: "Rating: hook",
      clarity: "Rating: clarity",
      value: "Rating: value",
      voice: "Rating: voice",
      gut: "Gut score",
    };
    for (const [k, col] of Object.entries(map) as [keyof Ratings, string][])
      if (input.ratings[k] !== undefined) p[col] = w.num(input.ratings[k]);
  }
  if (input.aiScore !== undefined) p["AI score"] = w.num(input.aiScore);
  if (input.aiNotes !== undefined) p["AI notes"] = w.text(input.aiNotes);
  if (input.plannedFor !== undefined) p["Planned for"] = w.date(input.plannedFor);
  if (input.publishedAt !== undefined) p["Published at"] = w.date(input.publishedAt);
  if (input.linkedinUrl !== undefined) p["LinkedIn URL"] = w.url(input.linkedinUrl);
  if (input.linkedinUrn !== undefined) p["LinkedIn URN"] = w.text(input.linkedinUrn ?? "");
  return p;
}

export const createPost = (input: PostInput) => createPage(env.ds.posts(), postProps(input));
export const updatePost = (id: string, input: PostInput) => updatePage(id, postProps(input));
export const archivePost = (id: string) => updatePage(id, { Status: w.select("Archived") });

export async function writePostMetrics(
  id: string,
  m: Partial<Metrics>,
  source: MetricSource,
  extra: { engagementRate?: number | null; performanceScore?: number | null; rank?: number | null } = {},
) {
  const cols: Record<keyof Metrics, string> = {
    impressions: "Impressions",
    membersReached: "Members reached",
    reactions: "Reactions",
    comments: "Comments",
    reposts: "Reposts",
    saves: "Saves",
    sends: "Sends",
    profileViews: "Profile views",
    followersGained: "Followers gained",
    linkClicks: "Link clicks",
    engagements: "Engagements",
  };
  const p: Props = { "Metrics source": w.select(source), "Last synced": w.date(new Date().toISOString()) };
  for (const [k, col] of Object.entries(cols) as [keyof Metrics, string][])
    if (m[k] !== undefined && m[k] !== null) p[col] = w.num(m[k]);
  if (extra.engagementRate !== undefined)
    p["Engagement rate"] = w.num(extra.engagementRate == null ? null : extra.engagementRate / 100);
  if (extra.performanceScore !== undefined) p["Performance score"] = w.num(extra.performanceScore);
  if (extra.rank !== undefined) p.Rank = w.num(extra.rank);
  await updatePage(id, p);
}

export async function writeRanking(id: string, s: { performanceScore: number | null; engagementRate: number | null; rank: number | null }) {
  await updatePage(id, {
    "Performance score": w.num(s.performanceScore),
    "Engagement rate": w.num(s.engagementRate == null ? null : s.engagementRate / 100),
    Rank: w.num(s.rank),
  });
}

// ── metric snapshots (one row per post per pull, so you can see growth curves) ──

function toSnapshot(page: PageObjectResponse): Snapshot {
  const p = page.properties as Props;
  return {
    id: page.id,
    postId: r.relation(p, "Post"),
    capturedAt: r.date(p, "Captured at") ?? page.created_time,
    hoursSincePublish: r.num(p, "Hours since publish"),
    impressions: r.num(p, "Impressions"),
    membersReached: r.num(p, "Members reached"),
    reactions: r.num(p, "Reactions"),
    comments: r.num(p, "Comments"),
    reposts: r.num(p, "Reposts"),
    saves: r.num(p, "Saves"),
    sends: r.num(p, "Sends"),
    source: (r.select(p, "Source") ?? "Manual") as MetricSource,
  };
}

export async function listSnapshots(postId: string): Promise<Snapshot[]> {
  if (!env.ds.snapshots()) return [];
  const pages = await queryAll(env.ds.snapshots(), {
    filter: { property: "Post", relation: { contains: postId } },
    sorts: [{ property: "Captured at", direction: "ascending" }],
  });
  return pages.map(toSnapshot);
}

export async function addSnapshot(postId: string, title: string, s: Omit<Snapshot, "id" | "postId">) {
  if (!env.ds.snapshots()) return;
  await createPage(env.ds.snapshots(), {
    Name: w.title(title),
    Post: w.relation(postId),
    "Captured at": w.date(s.capturedAt),
    "Hours since publish": w.num(s.hoursSincePublish),
    Impressions: w.num(s.impressions),
    "Members reached": w.num(s.membersReached),
    Reactions: w.num(s.reactions),
    Comments: w.num(s.comments),
    Reposts: w.num(s.reposts),
    Saves: w.num(s.saves),
    Sends: w.num(s.sends),
    Source: w.select(s.source),
  });
}

// ── daily account metrics ────────────────────────────────────────────

function toDaily(page: PageObjectResponse): DailyMetric {
  const p = page.properties as Props;
  return {
    id: page.id,
    day: r.date(p, "Day") ?? r.title(p, "Name"),
    impressions: r.num(p, "Impressions"),
    membersReached: r.num(p, "Members reached"),
    engagements: r.num(p, "Engagements"),
    newFollowers: r.num(p, "New followers"),
    totalFollowers: r.num(p, "Total followers"),
    profileViews: r.num(p, "Profile views"),
    searchAppearances: r.num(p, "Search appearances"),
    source: (r.select(p, "Source") ?? "Manual") as MetricSource,
  };
}

export async function listDaily(sinceDay?: string): Promise<DailyMetric[]> {
  if (!env.ds.daily()) return [];
  const pages = await queryAll(env.ds.daily(), {
    ...(sinceDay ? { filter: { property: "Day", date: { on_or_after: sinceDay } } } : {}),
    sorts: [{ property: "Day", direction: "ascending" }],
  });
  return pages.map(toDaily).sort((a, b) => a.day.localeCompare(b.day));
}

type DailyInput = Partial<Omit<DailyMetric, "id" | "day" | "source">>;

/** Inserts or merges one row per day. Only non-null fields overwrite. */
export async function upsertDaily(rows: ({ day: string; source: MetricSource } & DailyInput)[]) {
  if (!env.ds.daily() || rows.length === 0) return { created: 0, updated: 0 };
  const days = rows.map((x) => x.day).sort();
  const existing = new Map((await listDaily(days[0])).map((d) => [d.day, d]));
  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const p: Props = { Source: w.select(row.source) };
    const cols: [keyof DailyInput, string][] = [
      ["impressions", "Impressions"],
      ["membersReached", "Members reached"],
      ["engagements", "Engagements"],
      ["newFollowers", "New followers"],
      ["totalFollowers", "Total followers"],
      ["profileViews", "Profile views"],
      ["searchAppearances", "Search appearances"],
    ];
    for (const [k, col] of cols) if (row[k] != null) p[col] = w.num(row[k]);
    const prior = existing.get(row.day);
    if (prior) {
      await updatePage(prior.id, p);
      updated++;
    } else {
      await createPage(env.ds.daily(), { Name: w.title(row.day), Day: w.date(row.day), ...p });
      created++;
    }
  }
  return { created, updated };
}

// ── swipe file ───────────────────────────────────────────────────────

function toSwipe(page: PageObjectResponse): SwipeItem {
  const p = page.properties as Props;
  return {
    id: page.id,
    title: r.title(p, "Title"),
    author: r.text(p, "Author"),
    url: r.url(p, "URL"),
    text: r.text(p, "Text"),
    whyItWorks: r.text(p, "Why it works"),
    hookType: r.select(p, "Hook type"),
    tags: r.multi(p, "Tags"),
    rating: r.num(p, "Rating"),
    createdAt: page.created_time,
  };
}

export async function listSwipe(): Promise<SwipeItem[]> {
  if (!env.ds.swipe()) return [];
  const pages = await queryAll(env.ds.swipe(), { sorts: [{ timestamp: "created_time", direction: "descending" }] });
  return pages.map(toSwipe);
}

export async function createSwipe(s: Omit<SwipeItem, "id" | "createdAt">) {
  return createPage(env.ds.swipe(), {
    Title: w.title(s.title),
    Author: w.text(s.author),
    URL: w.url(s.url),
    Text: w.text(s.text),
    "Why it works": w.text(s.whyItWorks),
    "Hook type": w.select(s.hookType),
    Tags: w.multi(s.tags),
    Rating: w.num(s.rating),
  });
}

export const rateSwipe = (id: string, rating: number) => updatePage(id, { Rating: w.num(rating) });

// ── config (key/value; the LinkedIn token is stored here encrypted) ──

export async function getConfig(key: string): Promise<string | null> {
  if (!env.ds.config()) return null;
  const pages = await queryAll(env.ds.config(), { filter: { property: "Key", title: { equals: key } } });
  return pages[0] ? r.text(pages[0].properties as Props, "Value") : null;
}

export async function setConfig(key: string, value: string) {
  if (!env.ds.config()) throw new Error("NOTION_CONFIG_DS is not set. Run `npm run setup:notion`.");
  const pages = await queryAll(env.ds.config(), { filter: { property: "Key", title: { equals: key } } });
  if (pages[0]) await updatePage(pages[0].id, { Value: w.text(value) });
  else await createPage(env.ds.config(), { Key: w.title(key), Value: w.text(value) });
}

export async function deleteConfig(key: string) {
  if (!env.ds.config()) return;
  const pages = await queryAll(env.ds.config(), { filter: { property: "Key", title: { equals: key } } });
  for (const p of pages) await notion().pages.update({ page_id: p.id, in_trash: true } as Parameters<Client["pages"]["update"]>[0]);
}

// ── network (connections) ────────────────────────────────────────────


// Shared on globalThis: Next.js can load this module once for pages and once for server actions,
// and both must see the same cache or a fresh import looks empty for two minutes.
const g = globalThis as unknown as { __studioPeople?: { at: number; rows: Person[] } | null };
export const clearPeopleCache = () => { g.__studioPeople = null; };

function toPerson(page: PageObjectResponse): Person {
  const p = page.properties as Props;
  const position = r.text(p, "Position");
  return {
    id: page.id,
    name: r.title(p, "Name"),
    url: r.url(p, "Profile URL"),
    email: p.Email?.email ?? null,
    company: r.text(p, "Company"),
    position,
    connectedOn: r.date(p, "Connected on"),
    seniority: (r.select(p, "Seniority") as Seniority) ?? classifySeniority(position),
    function: (r.select(p, "Function") as Func) ?? classifyFunction(position),
    engagedCount: r.num(p, "Engaged count") ?? 0,
    lastEngaged: r.date(p, "Last engaged"),
    engagedOn: r.text(p, "Engaged on"),
    watch: Boolean(p.Watch?.checkbox),
    leadStatus: r.select(p, "Lead status"),
    notes: r.text(p, "Notes"),
  };
}

/** Everyone in your network. Cached for two minutes because networks run to thousands of rows. */
export async function listPeople(): Promise<Person[]> {
  if (!env.ds.connections()) return [];
  const hit = g.__studioPeople;
  if (hit && Date.now() - hit.at < 120_000) return hit.rows;
  const rows = (await queryAll(env.ds.connections())).map(toPerson);
  g.__studioPeople = rows.length ? { at: Date.now(), rows } : null; // never cache an empty network
  return rows;
}

function personProps(c: ArchiveConnection): Props {
  return {
    Name: w.title(c.name),
    "Profile URL": w.url(c.url),
    ...(c.email ? { Email: { email: c.email } } : {}),
    Company: w.text(c.company),
    Position: w.text(c.position),
    "Connected on": w.date(c.connectedOn),
    Seniority: w.select(classifySeniority(c.position)),
    Function: w.select(classifyFunction(c.position)),
  };
}

/**
 * Inserts new connections and updates changed ones, `limit` at a time so each request stays short.
 * Returns how far it got; the caller loops until `done`.
 */
export async function upsertPeople(conns: ArchiveConnection[], offset: number, limit = 60) {
  const existing = new Map((await listPeople()).map((p) => [p.url ?? p.name.toLowerCase(), p]));
  let created = 0, updated = 0, unchanged = 0;
  const slice = conns.slice(offset, offset + limit);
  for (const c of slice) {
    const key = c.url ?? c.name.toLowerCase();
    const prior = existing.get(key);
    if (!prior) { await createPage(env.ds.connections(), personProps(c)); created++; }
    else if (prior.position !== c.position || prior.company !== c.company) { await updatePage(prior.id, personProps(c)); updated++; }
    else unchanged++;
  }
  clearPeopleCache();
  const next = offset + slice.length;
  return { created, updated, unchanged, next, total: conns.length, done: next >= conns.length };
}

export async function updatePerson(id: string, patch: { watch?: boolean; leadStatus?: string | null; notes?: string }) {
  const p: Props = {};
  if (patch.watch !== undefined) p.Watch = { checkbox: patch.watch };
  if (patch.leadStatus !== undefined) p["Lead status"] = w.select(patch.leadStatus);
  if (patch.notes !== undefined) p.Notes = w.text(patch.notes);
  await updatePage(id, p);
  clearPeopleCache();
}

export async function recordEngagement(people: Person[], postTitle: string, day: string) {
  for (const p of people) {
    const on = [postTitle.slice(0, 80), ...p.engagedOn.split(" | ").filter(Boolean)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 8).join(" | ");
    await updatePage(p.id, { "Engaged count": w.num(p.engagedCount + 1), "Last engaged": w.date(day), "Engaged on": w.text(on) });
  }
  clearPeopleCache();
}

export async function getIcp(): Promise<Icp> {
  try {
    const v = await getConfig("icp");
    return v ? { ...EMPTY_ICP, ...JSON.parse(v) } : EMPTY_ICP;
  } catch {
    return EMPTY_ICP;
  }
}
export const saveIcp = (icp: Icp) => setConfig("icp", JSON.stringify(icp));

// ── audience demographics ────────────────────────────────────────────

export interface AudienceRow {
  category: string;
  value: string;
  percent: number | null;
  scope: "Account" | "Post";
  postId: string | null;
  capturedOn: string;
}

export async function listAudience(): Promise<AudienceRow[]> {
  if (!env.ds.audience()) return [];
  const pages = await queryAll(env.ds.audience());
  return pages.map((page) => {
    const p = page.properties as Props;
    return {
      category: r.select(p, "Category") ?? "Other",
      value: r.text(p, "Value"),
      percent: r.num(p, "Percent"),
      scope: (r.select(p, "Scope") ?? "Account") as "Account" | "Post",
      postId: r.text(p, "Post ID") || null,
      capturedOn: r.date(p, "Captured on") ?? page.created_time.slice(0, 10),
    };
  });
}

const CATEGORY_MAP: [RegExp, string][] = [
  [/job title|title/i, "Job titles"], [/senior/i, "Seniority"], [/industr/i, "Industries"],
  [/company size|size/i, "Company size"], [/location|countr|region/i, "Locations"], [/compan/i, "Companies"],
];
export const audienceCategory = (raw: string) => CATEGORY_MAP.find(([re]) => re.test(raw))?.[1] ?? "Other";

export async function addAudience(rows: AudienceRow[]) {
  if (!env.ds.audience()) return 0;
  const list = rows;
  for (const a of list) {
    const category = audienceCategory(a.category);
    await createPage(env.ds.audience(), {
      Name: w.title(`${category} · ${a.value}`),
      Category: w.select(category),
      Value: w.text(a.value),
      Percent: w.num(a.percent),
      Scope: w.select(a.scope),
      "Post ID": w.text(a.postId ?? ""),
      "Captured on": w.date(a.capturedOn),
    });
  }
  return list.length;
}
