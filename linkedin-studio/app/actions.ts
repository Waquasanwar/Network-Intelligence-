"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  const [posts, swipe] = await Promise.all([db.listPosts(), db.listSwipe().catch(() => [])]);
  return ai.buildContext(posts, swipe);
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
