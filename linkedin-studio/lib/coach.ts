/** Numbers that tell you how to get better, not just how you did. Pure functions; no I/O. */
import { stats } from "./text";
import type { Metrics, Post } from "./types";

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const per1k = (v: number | null, imp: number | null) => (v != null && imp ? (v / imp) * 1000 : null);

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function scoredPosts(posts: Post[]) {
  return posts.filter((p) => p.status === "Published" && p.performanceScore != null);
}

/** Your top quarter by score (at least one post), once you have 4+ scored posts. */
export function splitWinners(posts: Post[]) {
  const s = scoredPosts(posts).sort((a, b) => b.performanceScore! - a.performanceScore!);
  if (s.length < 4) return null;
  const k = Math.max(1, Math.round(s.length / 4));
  return { winners: s.slice(0, k), rest: s.slice(k) };
}

export interface CompareRow {
  key: string;
  label: string;
  winners: number;
  rest: number;
  ratio: number | null;
  format: "rate" | "int" | "chars";
  hint: string;
}

/** What your best posts do differently: per-1,000-impression rates and craft features. */
export function winnersVsRest(posts: Post[]): CompareRow[] {
  const split = splitWinners(posts);
  if (!split) return [];
  const defs: { key: string; label: string; format: CompareRow["format"]; hint: string; get: (p: Post) => number | null }[] = [
    { key: "comments", label: "Comments per 1k views", format: "rate", hint: "Ask a real question; reply to every comment in the first hour.", get: (p) => per1k(n(p.metrics.comments), n(p.metrics.impressions)) },
    { key: "saves", label: "Saves per 1k views", format: "rate", hint: "Saves come from posts people want to come back to: frameworks, lists, how-tos.", get: (p) => per1k(n(p.metrics.saves), n(p.metrics.impressions)) },
    { key: "reposts", label: "Reposts per 1k views", format: "rate", hint: "Reposts come from opinions people want to be seen agreeing with.", get: (p) => per1k(n(p.metrics.reposts), n(p.metrics.impressions)) },
    { key: "reactions", label: "Reactions per 1k views", format: "rate", hint: "The easiest signal; a strong first line moves this most.", get: (p) => per1k(n(p.metrics.reactions), n(p.metrics.impressions)) },
    { key: "followers", label: "Followers gained per post", format: "int", hint: "Followers come from posts that show your expertise, not just your opinion.", get: (p) => n(p.metrics.followersGained) },
    { key: "length", label: "Length (characters)", format: "chars", hint: "Match the length of your winners.", get: (p) => (p.text.trim() ? stats(p.text).chars : null) },
  ];
  const rows: CompareRow[] = [];
  for (const d of defs) {
    const w = split.winners.map(d.get).filter((v): v is number => v != null);
    const r = split.rest.map(d.get).filter((v): v is number => v != null);
    const mw = mean(w);
    const mr = mean(r);
    if (mw == null || mr == null) continue;
    rows.push({ key: d.key, label: d.label, winners: mw, rest: mr, ratio: mr > 0 ? mw / mr : null, format: d.format, hint: d.hint });
  }
  return rows;
}

export interface TrendPoint {
  id: string;
  title: string;
  day: string;
  score: number;
  rolling: number;
  winner: boolean;
}

/** Scores in publishing order with a rolling average: are you getting better? */
export function scoreTrend(posts: Post[], window = 3): TrendPoint[] {
  const split = splitWinners(posts);
  const winners = new Set(split?.winners.map((p) => p.id) ?? []);
  const s = scoredPosts(posts)
    .filter((p) => p.publishedAt)
    .sort((a, b) => a.publishedAt!.localeCompare(b.publishedAt!));
  return s.map((p, i) => {
    const slice = s.slice(Math.max(0, i - window + 1), i + 1).map((x) => x.performanceScore!);
    return {
      id: p.id,
      title: p.title,
      day: p.publishedAt!.slice(0, 10),
      score: p.performanceScore!,
      rolling: Math.round(slice.reduce((a, b) => a + b, 0) / slice.length),
      winner: winners.has(p.id),
    };
  });
}

/** Change in the rolling average from your first few posts to your latest few. */
export function trendDelta(points: TrendPoint[]): number | null {
  if (points.length < 4) return null;
  const k = Math.min(3, Math.floor(points.length / 2));
  const first = mean(points.slice(0, k).map((p) => p.score))!;
  const last = mean(points.slice(-k).map((p) => p.score))!;
  return Math.round(last - first);
}

export interface VsRow {
  key: keyof Metrics | "er";
  label: string;
  value: number;
  typical: number;
  pct: number;
}

/** How one post compares with your typical (median) post on each signal. */
export function vsTypical(post: Post, posts: Post[]): VsRow[] {
  const others = scoredPosts(posts).filter((p) => p.id !== post.id);
  if (others.length < 2) return [];
  const imp = n(post.metrics.impressions);
  const defs: { key: VsRow["key"]; label: string; get: (p: Post) => number | null }[] = [
    { key: "impressions", label: "Impressions", get: (p) => n(p.metrics.impressions) },
    { key: "er", label: "Engagement rate", get: (p) => p.engagementRate },
    { key: "comments", label: "Comments / 1k", get: (p) => per1k(n(p.metrics.comments), n(p.metrics.impressions)) },
    { key: "saves", label: "Saves / 1k", get: (p) => per1k(n(p.metrics.saves), n(p.metrics.impressions)) },
    { key: "reposts", label: "Reposts / 1k", get: (p) => per1k(n(p.metrics.reposts), n(p.metrics.impressions)) },
    { key: "followersGained", label: "Followers gained", get: (p) => n(p.metrics.followersGained) },
    { key: "profileViews", label: "Profile views", get: (p) => n(p.metrics.profileViews) },
  ];
  const rows: VsRow[] = [];
  for (const d of defs) {
    const v = d.get(post);
    const typical = median(others.map(d.get).filter((x): x is number => x != null));
    if (v == null || typical == null || typical === 0 || (d.key !== "impressions" && !imp)) continue;
    rows.push({ key: d.key, label: d.label, value: v, typical, pct: Math.round(((v - typical) / typical) * 100) });
  }
  return rows;
}
