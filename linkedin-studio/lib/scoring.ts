import type { Metrics, Post } from "./types";

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Interactions that LinkedIn counts as engagement. */
export function totalEngagements(m: Metrics): number {
  const sum = n(m.reactions) + n(m.comments) + n(m.reposts) + n(m.saves) + n(m.sends);
  return sum > 0 ? sum : n(m.engagements);
}

/**
 * Engagements weighted by effort: a comment, save or send says more than a like,
 * and a repost carries the post to a new audience.
 */
export function weightedEngagements(m: Metrics): number {
  const w = n(m.reactions) + 2 * n(m.comments) + 3 * n(m.reposts) + 2 * n(m.saves) + 2 * n(m.sends);
  // Only a total is known: assume a typical mix (mostly reactions, some comments).
  return w > 0 ? w : n(m.engagements) * 1.3;
}

/** Engagement rate as a percentage of impressions, or null without impressions. */
export function engagementRate(m: Metrics): number | null {
  const imp = n(m.impressions);
  if (imp <= 0) return null;
  return round((totalEngagements(m) / imp) * 100, 2);
}

/** Percentile rank (0..1) of `value` within `values`, ties counted half. */
export function percentile(values: number[], value: number): number {
  if (values.length <= 1) return 0.5;
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return (below + 0.5 * (equal - 1)) / (values.length - 1);
}

export interface ScoredPost {
  id: string;
  performanceScore: number;
  engagementRate: number | null;
  rank: number;
}

/**
 * Score every published post 0-100 against your own history, then rank them.
 *
 * - 45% quality: weighted engagements per 1,000 impressions
 * - 35% reach: impressions
 * - 20% pull: profile views + followers gained from the post
 *
 * The pull weight is shared out to the other two when no post has that data yet.
 */
export function scorePosts(posts: Pick<Post, "id" | "metrics">[]): ScoredPost[] {
  const eligible = posts.filter((p) => n(p.metrics.impressions) > 0);
  if (eligible.length === 0) return [];

  const quality = eligible.map((p) => (weightedEngagements(p.metrics) / n(p.metrics.impressions)) * 1000);
  const reach = eligible.map((p) => n(p.metrics.impressions));
  const pull = eligible.map((p) => n(p.metrics.profileViews) + n(p.metrics.followersGained));
  const hasPull = pull.some((v) => v > 0);
  const w = hasPull ? { q: 0.45, r: 0.35, p: 0.2 } : { q: 0.55, r: 0.45, p: 0 };

  const scored = eligible.map((p, i) => {
    const s = w.q * percentile(quality, quality[i]) + w.r * percentile(reach, reach[i]) + w.p * percentile(pull, pull[i]);
    return { id: p.id, performanceScore: Math.round(s * 100), engagementRate: engagementRate(p.metrics), rank: 0 };
  });

  scored.sort((a, b) => b.performanceScore - a.performanceScore || n(b.engagementRate) - n(a.engagementRate));
  scored.forEach((s, i) => (s.rank = i + 1));
  return scored;
}

export type Tier = "Breakout" | "Strong" | "Solid" | "Below par";

export function tierFor(score: number | null, rank: number | null, total: number): Tier | null {
  if (score == null) return null;
  if (rank != null && total >= 10 && rank <= Math.max(1, Math.round(total * 0.1))) return "Breakout";
  if (score >= 70) return "Strong";
  if (score >= 40) return "Solid";
  return "Below par";
}

export interface GroupInsight {
  key: string;
  count: number;
  avgScore: number;
  avgImpressions: number;
  avgEngagementRate: number | null;
}

/** Average performance by some attribute (pillar, format, weekday, ...). */
export function groupBy(posts: Post[], keyOf: (p: Post) => string | null): GroupInsight[] {
  const groups = new Map<string, Post[]>();
  for (const p of posts) {
    if (p.performanceScore == null) continue;
    const k = keyOf(p);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups.entries()]
    .map(([key, ps]) => {
      const ers = ps.map((p) => p.engagementRate).filter((v): v is number => v != null);
      return {
        key,
        count: ps.length,
        avgScore: Math.round(avg(ps.map((p) => n(p.performanceScore)))),
        avgImpressions: Math.round(avg(ps.map((p) => n(p.metrics.impressions)))),
        avgEngagementRate: ers.length ? round(avg(ers), 2) : null,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayOf(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : WEEKDAYS[d.getDay()];
}

export function lengthBucket(text: string): string | null {
  const len = text.trim().length;
  if (!len) return null;
  if (len < 600) return "Short (< 600 chars)";
  if (len < 1300) return "Medium (600–1,300)";
  return "Long (1,300+)";
}

/** Pearson correlation, or null when there are too few pairs to mean anything. */
export function correlation(pairs: [number, number][]): number | null {
  if (pairs.length < 5) return null;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = avg(xs);
  const my = avg(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return round(num / Math.sqrt(dx * dy), 2);
}

/** How well your gut rating and the AI score predicted actual performance. */
export function calibration(posts: Post[]) {
  const published = posts.filter((p) => p.performanceScore != null);
  const gut = published
    .filter((p) => p.ratings.gut != null)
    .map((p) => [p.ratings.gut!, p.performanceScore!] as [number, number]);
  const ai = published.filter((p) => p.aiScore != null).map((p) => [p.aiScore!, p.performanceScore!] as [number, number]);
  return { gut: correlation(gut), gutN: gut.length, ai: correlation(ai), aiN: ai.length };
}

export function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function round(v: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}
