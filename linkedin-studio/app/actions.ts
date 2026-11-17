"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readArchive, type ArchiveConnection, type ArchiveShare } from "@/lib/archive";
import { draftAudience, matchEngagers, type Icp } from "@/lib/people";
import { aiAnswer, localAnswer, type CopilotAnswer } from "@/lib/copilot";
import { signals as agentSignals } from "@/lib/agent";
import * as ai from "@/lib/ai";
import { aiReady } from "@/lib/env";
import { importExport } from "@/lib/importer";
import { activityIdFrom } from "@/lib/linkedin-export";
import { canPublish, disconnect, getToken, publishPost } from "@/lib/linkedin-api";
import * as db from "@/lib/notion";
import { recomputeRanks, runSync } from "@/lib/sync";
import { titleFrom } from "@/lib/text";
import type { Metrics, Ratings, Status } from "@/lib/types";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

function refresh(id?: string) {
  revalidatePath("/");
  revalidatePath("/posts");
  if (id) revalidatePath(`/posts/${id}`);
}

// ── posts ────────────────────────────────────────────────────────────

export interface DraftInput {
  id?: string;
  text: string;
  title?: string;
  status?: Status;
  pillar?: string | null;
  format?: string | null;
  hookType?: string | null;
  tags?: string[];
  ratings?: Partial<Ratings>;
  aiScore?: number | null;
  aiNotes?: string;
  plannedFor?: string | null;
}

export async function saveDraft(input: DraftInput): Promise<Result<{ id: string }>> {
  try {
    const fields = { ...input, title: input.title?.trim() || titleFrom(input.text) };
    delete fields.id;
    let id = input.id;
    if (id) await db.updatePost(id, fields);
    else id = await db.createPost({ status: "Drafting", ...fields });
    refresh(id);
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

export async function ratePost(id: string, ratings: Partial<Ratings>): Promise<Result> {
  try {
    await db.updatePost(id, { ratings });
    refresh(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function setStatus(id: string, status: Status): Promise<Result> {
  try {
    await db.updatePost(id, { status });
    refresh(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

/** For posts you published by hand: paste the link and we can match analytics to it. */
export async function markPublished(id: string, url: string, publishedAt: string): Promise<Result> {
  try {
    const activity = activityIdFrom(url);
    await db.updatePost(id, {
      status: "Published",
      linkedinUrl: url || null,
      linkedinUrn: activity ? `urn:li:activity:${activity}` : null,
      publishedAt: publishedAt || new Date().toISOString(),
    });
    refresh(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function publishNow(id: string): Promise<Result<{ url: string }>> {
  try {
    const post = await db.getPost(id);
    if (!post?.text.trim()) throw new Error("This post has no text yet.");
    const token = await getToken();
    if (!canPublish(token)) throw new Error("Connect LinkedIn (with the w_member_social permission) on the Connect page first.");
    const { urn, url } = await publishPost(token!, post.text);
    await db.updatePost(id, { status: "Published", linkedinUrn: urn, linkedinUrl: url, publishedAt: new Date().toISOString() });
    refresh(id);
    return { ok: true, data: { url } };
  } catch (e) {
    return fail(e);
  }
}

export async function saveManualMetrics(id: string, m: Partial<Metrics>): Promise<Result> {
  try {
    const post = await db.getPost(id);
    await db.writePostMetrics(id, m, "Manual");
    const now = new Date().toISOString();
    await db.addSnapshot(id, `${(post?.title ?? "Post").slice(0, 60)} · manual ${now.slice(0, 10)}`, {
      capturedAt: now,
      hoursSincePublish: post?.publishedAt ? Math.round((Date.now() - new Date(post.publishedAt).getTime()) / 36e5) : null,
      impressions: m.impressions ?? null,
      membersReached: m.membersReached ?? null,
      reactions: m.reactions ?? null,
      comments: m.comments ?? null,
      reposts: m.reposts ?? null,
      saves: m.saves ?? null,
      sends: m.sends ?? null,
      source: "Manual",
    });
    await recomputeRanks();
    refresh(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function archive(id: string) {
  await db.archivePost(id);
  refresh(id);
  redirect("/posts");
}

// ── writing assistant ────────────────────────────────────────────────

async function context() {
  if (!aiReady()) throw new Error("Add ANTHROPIC_API_KEY to turn on the writing assistant.");
  const [posts, swipe, audience, icp] = await Promise.all([db.listPosts(), db.listSwipe().catch(() => []), db.listAudience().catch(() => []), db.getIcp()]);
  const last = audience.filter((a) => a.scope === "Account").map((a) => a.capturedOn).sort().pop();
  const top = (c: string) => audience.filter((a) => a.scope === "Account" && a.capturedOn === last && a.category === c).sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0)).slice(0, 5).map((a) => `${a.value} ${a.percent ?? "?"}%`).join(", ");
  const note = [
    last ? `Viewers by job title: ${top("Job titles")}` : "",
    last ? `Viewers by seniority: ${top("Seniority")}` : "",
    last ? `Viewers by industry: ${top("Industries")}` : "",
    icp.functions.length || icp.seniorities.length ? `People they want to reach: ${[...icp.functions, ...icp.seniorities, ...icp.titleKeywords].join(", ")}` : "",
  ].filter(Boolean).join("\n");
  return ai.buildContext(posts, swipe, note);
}

export async function aiCritique(text: string): Promise<Result<ai.Critique>> {
  try {
    return { ok: true, data: await ai.critique(text, await context()) };
  } catch (e) {
    return fail(e);
  }
}

export async function aiHooks(text: string) {
  try {
    return { ok: true as const, data: await ai.hooks(text, await context()) };
  } catch (e) {
    return fail(e);
  }
}

export async function aiRewrite(text: string, instruction: string) {
  try {
    return { ok: true as const, data: await ai.rewrite(text, instruction, await context()) };
  } catch (e) {
    return fail(e);
  }
}

export async function aiIdeas(topic: string) {
  try {
    return { ok: true as const, data: await ai.ideas(topic, await context()) };
  } catch (e) {
    return fail(e);
  }
}

// ── swipe file ───────────────────────────────────────────────────────

export async function addSwipe(form: FormData): Promise<Result> {
  try {
    const text = String(form.get("text") ?? "").trim();
    if (!text) throw new Error("Paste the post text.");
    await db.createSwipe({
      title: String(form.get("title") ?? "").trim() || titleFrom(text),
      author: String(form.get("author") ?? "").trim(),
      url: String(form.get("url") ?? "").trim() || null,
      text,
      whyItWorks: String(form.get("why") ?? "").trim(),
      hookType: String(form.get("hookType") ?? "") || null,
      tags: String(form.get("tags") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      rating: Number(form.get("rating")) || null,
    });
    revalidatePath("/swipe");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function rateSwipe(id: string, rating: number) {
  await db.rateSwipe(id, rating);
  revalidatePath("/swipe");
}

// ── metrics ──────────────────────────────────────────────────────────

export async function importFile(form: FormData): Promise<Result<{ summary: string[] }>> {
  try {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose an .xlsx file exported from LinkedIn.");
    const res = await importExport(await file.arrayBuffer());
    refresh();
    revalidatePath("/metrics");
    return { ok: true, data: { summary: res.summary } };
  } catch (e) {
    return fail(e);
  }
}

export async function logDay(form: FormData): Promise<Result> {
  try {
    const day = String(form.get("day") ?? "") || new Date().toISOString().slice(0, 10);
    const num = (k: string) => {
      const v = String(form.get(k) ?? "").replace(/,/g, "").trim();
      return v === "" ? undefined : Number(v);
    };
    await db.upsertDaily([
      {
        day,
        source: "Manual",
        profileViews: num("profileViews"),
        searchAppearances: num("searchAppearances"),
        totalFollowers: num("totalFollowers"),
      },
    ]);
    revalidatePath("/metrics");
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function syncNow() {
  try {
    const r = await runSync();
    refresh();
    revalidatePath("/metrics");
    return { ok: true as const, data: r };
  } catch (e) {
    return fail(e);
  }
}

export async function disconnectLinkedIn() {
  await disconnect();
  revalidatePath("/connect");
}

// ── network & audience ───────────────────────────────────────────────


export async function parseArchive(form: FormData) {
  try {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose LinkedIn's data download (.zip) or Connections.csv / Shares.csv.");
    const a = await readArchive(file.name, await file.arrayBuffer());
    return { ok: true as const, data: { connections: a.connections, shares: a.shares, invitations: a.invitations.length, files: a.files } };
  } catch (e) {
    return fail(e);
  }
}

export async function importPeopleChunk(conns: ArchiveConnection[]) {
  try {
    const r = await db.upsertPeople(conns, 0, conns.length);
    return { ok: true as const, data: { created: r.created, updated: r.updated, unchanged: r.unchanged } };
  } catch (e) {
    return fail(e);
  }
}

/** Adds posts from Shares.csv that aren't in your library yet, so they can be rated and learned from. */
export async function importSharesChunk(shares: ArchiveShare[]) {
  try {
    const posts = await db.listPosts();
    const known = new Set(posts.map((p) => activityIdFrom(p.linkedinUrn) ?? activityIdFrom(p.linkedinUrl)).filter(Boolean));
    const knownText = new Set(posts.map((p) => p.text.trim().slice(0, 120)).filter(Boolean));
    let created = 0;
    for (const s of shares) {
      const id = activityIdFrom(s.link ? decodeURIComponent(s.link) : null);
      if ((id && known.has(id)) || knownText.has(s.text.trim().slice(0, 120))) continue;
      await db.createPost({
        title: titleFrom(s.text),
        status: "Published",
        text: s.text,
        publishedAt: s.date,
        linkedinUrl: s.link,
        linkedinUrn: id ? `urn:li:share:${id}` : null,
      });
      created++;
    }
    refresh();
    return { ok: true as const, data: { created } };
  } catch (e) {
    return fail(e);
  }
}

export async function saveIcpAction(icp: Icp): Promise<Result> {
  try {
    await db.saveIcp(icp);
    revalidatePath("/network");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function setPerson(id: string, patch: { watch?: boolean; leadStatus?: string | null }) {
  await db.updatePerson(id, patch);
  revalidatePath("/network");
}

/** Paste the comments or reactions list from a post; connections named in it are marked as engaged. */
export async function logEngagers(postId: string, pasted: string) {
  try {
    const [post, people] = await Promise.all([db.getPost(postId), db.listPeople()]);
    if (!post) throw new Error("Post not found.");
    if (!people.length) throw new Error("Import your connections on the Network page first.");
    const found = matchEngagers(pasted, people);
    await db.recordEngagement(found, post.title, new Date().toISOString().slice(0, 10));
    revalidatePath("/network");
    revalidatePath(`/posts/${postId}`);
    return { ok: true as const, data: { matched: found.map((p) => p.name) } };
  } catch (e) {
    return fail(e);
  }
}

export async function audienceForDraft(text: string) {
  try {
    const people = await db.listPeople();
    const r = draftAudience(text, people, 10);
    return {
      ok: true as const,
      data: {
        total: people.length,
        matches: r.matches,
        segments: r.segments.filter((g) => g.people > 0).slice(0, 4),
        keywords: r.keywords.slice(0, 6),
        top: r.top.map((t) => ({ id: t.person.id, name: t.person.name, position: t.person.position, company: t.person.company, url: t.person.url, why: t.why.join(" · ") })),
      },
    };
  } catch (e) {
    return fail(e);
  }
}

// ── copilot ──────────────────────────────────────────────────────────


async function copilotData() {
  const [posts, daily, people, icp] = await Promise.all([
    db.listPosts(),
    db.listDaily(new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10)).catch(() => []),
    db.listPeople().catch(() => []),
    db.getIcp(),
  ]);
  return { posts, daily, people, icp };
}

/** What the ⌘K bar needs to search instantly in the browser, plus today's signals as suggestions. */
export async function copilotIndex() {
  try {
    const d = await copilotData();
    return {
      ok: true as const,
      data: {
        posts: d.posts.filter((p) => p.status !== "Archived").map((p) => ({ id: p.id, title: p.title, status: p.status, rank: p.rank })),
        people: d.people.slice(0, 5000).map((p) => ({ id: p.id, name: p.name, sub: [p.position, p.company].filter(Boolean).join(" · "), url: p.url })),
        signals: agentSignals(d).slice(0, 4).map((s) => ({ title: s.title, href: s.action?.href ?? "/" })),
        ai: aiReady(),
      },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function askCopilot(question: string, history: { role: "user" | "assistant"; content: string }[]): Promise<Result<CopilotAnswer>> {
  try {
    const d = await copilotData();
    const local = localAnswer(question, d);
    if (local && !aiReady()) return { ok: true, data: local };
    if (aiReady()) {
      // Local answers are instant and exact; Claude handles everything else and follow-ups.
      if (local && history.length === 0) return { ok: true, data: local };
      return { ok: true, data: await aiAnswer(question, history, d) };
    }
    return {
      ok: true,
      data: {
        source: "local",
        text: "I can answer questions about your leads, best posts, best day to post, this week’s reach, what to do today, and who a draft is for. Add ANTHROPIC_API_KEY to ask anything else.",
      },
    };
  } catch (e) {
    return fail(e);
  }
}
