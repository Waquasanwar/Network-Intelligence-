/** A feed of what happened recently, derived from timestamps already in Notion. */
import type { Post } from "./types";

export interface ActivityEvent {
  id: string;
  at: string;
  kind: "published" | "metrics" | "draft";
  text: string;
  postId: string;
}

export function recentActivity(posts: Post[], limit = 6): ActivityEvent[] {
  const ev: ActivityEvent[] = [];
  for (const p of posts) {
    if (p.status === "Archived") continue;
    const title = p.title.length > 54 ? `${p.title.slice(0, 53)}…` : p.title;
    if (p.publishedAt) ev.push({ id: `${p.id}:pub`, at: p.publishedAt, kind: "published", text: `Published “${title}”`, postId: p.id });
    if (p.lastSynced && p.metrics.impressions != null)
      ev.push({
        id: `${p.id}:m`,
        at: p.lastSynced,
        kind: "metrics",
        text: `${p.metrics.impressions.toLocaleString("en-GB")} impressions on “${title}”${p.metricsSource ? ` · ${p.metricsSource.toLowerCase()}` : ""}`,
        postId: p.id,
      });
    if (p.status !== "Published") ev.push({ id: `${p.id}:d`, at: p.createdAt, kind: "draft", text: `${p.status === "Idea" ? "New idea" : "Drafted"} “${title}”`, postId: p.id });
  }
  return ev.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Days in the window with a post, and each one's score: the "heartbeat" of your posting. */
export function postingPulse(posts: Post[], days = 30, now = Date.now()) {
  const start = new Date(now - (days - 1) * 864e5).toISOString().slice(0, 10);
  const beats = posts
    .filter((p) => p.status === "Published" && p.publishedAt && p.publishedAt.slice(0, 10) >= start)
    .map((p) => ({
      day: p.publishedAt!.slice(0, 10),
      index: Math.round((new Date(p.publishedAt!.slice(0, 10)).getTime() - new Date(start).getTime()) / 864e5),
      score: p.performanceScore,
      title: p.title,
    }))
    .sort((a, b) => a.index - b.index);
  const gaps = beats.slice(1).map((b, i) => b.index - beats[i].index);
  const avgGap = gaps.length ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10 : null;
  return { days, start, beats, avgGap };
}
