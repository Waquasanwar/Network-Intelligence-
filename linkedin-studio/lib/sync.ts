/** The scheduled job: pull metrics from LinkedIn, snapshot them, then re-rank every post. */
import { canReadAnalytics, fetchAccountDaily, fetchFollowerCount, fetchPostAnalytics, getToken } from "./linkedin-api";
import { addSnapshot, listPosts, upsertDaily, writePostMetrics, writeRanking } from "./notion";
import { engagementRate, scorePosts } from "./scoring";
import type { Post } from "./types";

export interface SyncReport {
  connected: boolean;
  analytics: boolean;
  postsUpdated: number;
  snapshots: number;
  daysUpserted: number;
  ranked: number;
  errors: string[];
}

/** Recomputes scores and ranks from whatever metrics are in Notion (API, import or typed in). */
export async function recomputeRanks(posts?: Post[]): Promise<number> {
  const all = posts ?? (await listPosts());
  const scored = new Map(scorePosts(all.filter((p) => p.status === "Published")).map((s) => [s.id, s]));
  let changed = 0;
  for (const p of all) {
    const s = scored.get(p.id);
    const next = s
      ? { performanceScore: s.performanceScore, engagementRate: s.engagementRate, rank: s.rank }
      : { performanceScore: null, engagementRate: engagementRate(p.metrics), rank: null };
    if (next.performanceScore === p.performanceScore && next.rank === p.rank && next.engagementRate === p.engagementRate) continue;
    await writeRanking(p.id, next);
    changed++;
  }
  return changed;
}

export async function runSync(): Promise<SyncReport> {
  const report: SyncReport = { connected: false, analytics: false, postsUpdated: 0, snapshots: 0, daysUpserted: 0, ranked: 0, errors: [] };
  const token = await getToken().catch((e: Error) => {
    report.errors.push(e.message);
    return null;
  });
  report.connected = Boolean(token);
  report.analytics = canReadAnalytics(token);

  if (token && report.analytics) {
    const posts = await listPosts();
    const now = new Date();
    for (const p of posts) {
      if (p.status !== "Published" || !p.linkedinUrn) continue;
      const { metrics, errors } = await fetchPostAnalytics(token, p.linkedinUrn);
      if (errors.length) report.errors.push(`${p.title}: ${errors.join(", ")}`);
      if (Object.keys(metrics).length === 0) continue;
      const m = {
        impressions: metrics.IMPRESSION,
        membersReached: metrics.MEMBERS_REACHED,
        reactions: metrics.REACTION,
        comments: metrics.COMMENT,
        reposts: metrics.RESHARE,
      };
      await writePostMetrics(p.id, m, "API");
      report.postsUpdated++;
      const hours = p.publishedAt ? Math.round((now.getTime() - new Date(p.publishedAt).getTime()) / 36e5) : null;
      await addSnapshot(p.id, `${p.title.slice(0, 60)} · ${now.toISOString().slice(0, 10)}`, {
        capturedAt: now.toISOString(),
        hoursSincePublish: hours,
        impressions: m.impressions ?? null,
        membersReached: m.membersReached ?? null,
        reactions: m.reactions ?? null,
        comments: m.comments ?? null,
        reposts: m.reposts ?? null,
        saves: null,
        sends: null,
        source: "API",
      });
      report.snapshots++;
    }

    const end = new Date();
    const start = new Date(end.getTime() - 7 * 864e5);
    const { days, errors } = await fetchAccountDaily(token, start, end);
    if (errors.length) report.errors.push(`Account daily: ${errors.join(", ")}`);
    const followers = await fetchFollowerCount(token);
    const today = end.toISOString().slice(0, 10);
    const rows: Parameters<typeof upsertDaily>[0] = [...days.entries()].map(([day, d]) => ({
      day,
      source: "API" as const,
      impressions: d.IMPRESSION,
      membersReached: d.MEMBERS_REACHED,
      engagements: (d.REACTION ?? 0) + (d.COMMENT ?? 0) + (d.RESHARE ?? 0) || undefined,
    }));
    if (followers != null) {
      const row = rows.find((x) => x.day === today);
      if (row) row.totalFollowers = followers;
      else rows.push({ day: today, source: "API", totalFollowers: followers });
    }
    const r = await upsertDaily(rows);
    report.daysUpserted = r.created + r.updated;
  }

  report.ranked = await recomputeRanks();
  return report;
}
