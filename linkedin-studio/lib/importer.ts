/** Applies a parsed LinkedIn export to Notion: daily totals, post metrics, snapshots, then re-ranks. */
import { activityIdFrom, parseWorkbook } from "./linkedin-export";
import { addAudience, addSnapshot, createPost, listPosts, upsertDaily, writePostMetrics } from "./notion";
import { recomputeRanks } from "./sync";
import type { Metrics, Post } from "./types";

export interface ImportResult {
  kind: "creator" | "post";
  summary: string[];
}

function indexByActivity(posts: Post[]) {
  const map = new Map<string, Post>();
  for (const p of posts) {
    const id = activityIdFrom(p.linkedinUrn) ?? activityIdFrom(p.linkedinUrl);
    if (id) map.set(id, p);
  }
  return map;
}

async function findOrCreate(index: Map<string, Post>, activityId: string | null, url: string | null, publishedOn: string | null) {
  const existing = activityId ? index.get(activityId) : undefined;
  if (existing) return { id: existing.id, title: existing.title, created: false };
  const title = `Imported post${publishedOn ? ` · ${publishedOn}` : ""}`;
  const id = await createPost({
    title,
    status: "Published",
    linkedinUrl: url,
    linkedinUrn: activityId ? `urn:li:activity:${activityId}` : null,
    publishedAt: publishedOn,
    text: "",
  });
  return { id, title, created: true };
}

export async function importExport(buf: ArrayBuffer): Promise<ImportResult> {
  const parsed = await parseWorkbook(buf);
  const posts = await listPosts();
  const index = indexByActivity(posts);
  const now = new Date().toISOString();
  const summary: string[] = [];

  if (parsed.kind === "creator") {
    const rows: Parameters<typeof upsertDaily>[0] = parsed.daily.map((d) => ({
      day: d.day,
      source: "Import" as const,
      impressions: d.impressions,
      engagements: d.engagements,
      newFollowers: d.newFollowers,
    }));
    if (parsed.totalFollowers?.asOf) {
      const day = parsed.totalFollowers.asOf;
      const row = rows.find((r) => r.day === day);
      if (row) row.totalFollowers = parsed.totalFollowers.count;
      else rows.push({ day, source: "Import", totalFollowers: parsed.totalFollowers.count });
    }
    const d = await upsertDaily(rows);
    summary.push(`${d.created} new and ${d.updated} updated days of account metrics.`);

    let matched = 0;
    let created = 0;
    for (const tp of parsed.topPosts) {
      const target = await findOrCreate(index, tp.activityId, tp.url, tp.publishedOn);
      if (target.created) created++;
      else matched++;
      const m: Partial<Metrics> = { impressions: tp.impressions ?? null, engagements: tp.engagements ?? null };
      await writePostMetrics(target.id, m, "Import");
    }
    summary.push(
      `${parsed.topPosts.length} top posts: ${matched} matched to your library, ${created} added as "Imported post" (open them to paste the text and rate them).`,
    );
    const today = now.slice(0, 10);
    const n = await addAudience(parsed.demographics.map((d) => ({ ...d, scope: "Account" as const, postId: null, capturedOn: parsed.period.end ?? today })));
    if (n) summary.push(`${n} audience demographic rows saved (job titles, seniority, industries, locations, companies).`);
    if (parsed.totals.impressions != null)
      summary.push(`Period ${parsed.period.start ?? "?"} to ${parsed.period.end ?? "?"}: ${parsed.totals.impressions.toLocaleString()} impressions, ${parsed.totals.membersReached?.toLocaleString() ?? "?"} members reached.`);
  } else {
    const target = await findOrCreate(index, parsed.activityId, parsed.url, parsed.publishedOn);
    await writePostMetrics(target.id, parsed.metrics, "Import");
    const published = posts.find((p) => p.id === target.id)?.publishedAt ?? parsed.publishedOn;
    await addSnapshot(target.id, `${target.title.slice(0, 60)} · import ${now.slice(0, 10)}`, {
      capturedAt: now,
      hoursSincePublish: published ? Math.round((Date.now() - new Date(published).getTime()) / 36e5) : null,
      impressions: parsed.metrics.impressions,
      membersReached: parsed.metrics.membersReached,
      reactions: parsed.metrics.reactions,
      comments: parsed.metrics.comments,
      reposts: parsed.metrics.reposts,
      saves: parsed.metrics.saves,
      sends: parsed.metrics.sends,
      source: "Import",
    });
    const n = await addAudience(parsed.demographics.map((d) => ({ ...d, scope: "Post" as const, postId: target.id, capturedOn: now.slice(0, 10) })));
    if (n) summary.push(`${n} viewer demographic rows saved for this post.`);
    summary.push(`${target.created ? "Added" : "Updated"} "${target.title}" with ${parsed.metrics.impressions?.toLocaleString() ?? "?"} impressions.`);
  }

  const ranked = await recomputeRanks();
  summary.push(`Re-ranked ${ranked} posts.`);
  return { kind: parsed.kind, summary };
}
