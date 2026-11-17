/**
 * The proactive agent: reads your posts, daily metrics and network, and returns what deserves your
 * attention right now, most important first, each with one concrete next step. Pure; no I/O.
 */
import type { DailyMetric, Post } from "./types";
import { scoreLead, type Icp, type Person } from "./people";
import { groupBy, weekdayOf, WEEKDAYS } from "./scoring";

export interface Signal {
  id: string;
  priority: number; // higher first
  tone: "good" | "warn" | "info";
  icon: "clock" | "calendar" | "target" | "trend" | "users" | "pen" | "spark" | "chart";
  title: string;
  detail: string;
  action?: { label: string; href: string };
}

const DAY = 864e5;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

export function signals(input: { posts: Post[]; daily: DailyMetric[]; people: Person[]; icp: Icp; now?: number }): Signal[] {
  const now = input.now ?? Date.now();
  const live = input.posts.filter((p) => p.status !== "Archived");
  const published = live.filter((p) => p.status === "Published");
  const ready = live.filter((p) => p.status === "Ready" || p.status === "Scheduled");
  const drafts = live.filter((p) => p.status === "Drafting");
  const out: Signal[] = [];

  // 1. Warm, on-profile leads who engaged this week: the highest-value thing you can do today.
  const warm = input.people
    .filter((p) => p.lastEngaged && now - new Date(p.lastEngaged).getTime() < 7 * DAY)
    .map((p) => scoreLead(p, input.icp, now))
    .filter((l) => l.fit >= 50)
    .sort((a, b) => b.score - a.score);
  if (warm.length)
    out.push({
      id: "warm-leads",
      priority: 100,
      tone: "good",
      icon: "users",
      title: `${warm.length} target lead${warm.length === 1 ? "" : "s"} engaged this week`,
      detail: `${warm.slice(0, 3).map((l) => l.person.name).join(", ")}${warm.length > 3 ? " and others" : ""}. Message them while your post is fresh.`,
      action: { label: "See leads", href: "/network" },
    });

  // 2. Cadence.
  const last = published.map((p) => p.publishedAt).filter(Boolean).sort().pop();
  const since = last ? Math.floor((now - new Date(last).getTime()) / DAY) : null;
  const today = WEEKDAYS[new Date(now).getDay()];
  const days = groupBy(published.filter((p) => p.performanceScore != null), (p) => weekdayOf(p.publishedAt));
  const bestDay = days.length >= 2 ? days[0] : null;
  if (bestDay && bestDay.key === today)
    out.push({
      id: "best-day",
      priority: 90,
      tone: "good",
      icon: "calendar",
      title: `${today} is your best day to post`,
      detail: ready.length ? `You have ${ready.length} ready. Post one today.` : `Your ${today} posts average ${bestDay.avgScore}. Nothing is ready yet: draft something short.`,
      action: { label: ready.length ? "Open ready posts" : "Write now", href: ready.length ? "/posts?status=Ready" : "/write" },
    });
  if (since != null && since >= 7)
    out.push({
      id: "cadence",
      priority: 85,
      tone: "warn",
      icon: "clock",
      title: `${since} days since your last post`,
      detail: "Reach decays when you go quiet. One short post keeps you in feeds.",
      action: { label: "Write a post", href: "/write" },
    });

  // 3. Your latest post is doing well: work it.
  const fresh = published.filter((p) => p.publishedAt && now - new Date(p.publishedAt).getTime() < 4 * DAY && p.rank != null && p.rank <= 3);
  for (const p of fresh.slice(0, 1))
    out.push({
      id: `hot-${p.id}`,
      priority: 80,
      tone: "good",
      icon: "spark",
      title: `“${p.title.slice(0, 50)}${p.title.length > 50 ? "…" : ""}” is your #${p.rank}`,
      detail: "Reply to every comment today and log who engaged so they show up as warm leads.",
      action: { label: "Open post", href: `/posts/${p.id}` },
    });

  // 4. Reach this week vs last week.
  const wk = input.daily.filter((d) => d.day > isoDay(now - 7 * DAY));
  const prev = input.daily.filter((d) => d.day > isoDay(now - 14 * DAY) && d.day <= isoDay(now - 7 * DAY));
  const a = sum(wk.map((d) => d.impressions));
  const b = sum(prev.map((d) => d.impressions));
  if (a && b) {
    const pct = Math.round(((a - b) / b) * 100);
    if (pct <= -20)
      out.push({ id: "reach-dip", priority: 70, tone: "warn", icon: "chart", title: `Reach is down ${Math.abs(pct)}% this week`, detail: "Usually a cadence or hook problem. Reuse the hook style of your top post.", action: { label: "See metrics", href: "/metrics?range=30" } });
    else if (pct >= 20)
      out.push({ id: "reach-up", priority: 60, tone: "good", icon: "trend", title: `Reach is up ${pct}% this week`, detail: "Follow up while people are paying attention: a second post on the same theme.", action: { label: "Write a follow-up", href: "/write" } });
  }

  // 5. Housekeeping that improves the data.
  const missing = published.filter((p) => p.metrics.impressions == null && p.publishedAt && now - new Date(p.publishedAt).getTime() > 2 * DAY);
  if (missing.length)
    out.push({ id: "missing-numbers", priority: 40, tone: "info", icon: "chart", title: `${missing.length} post${missing.length === 1 ? " has" : "s have"} no numbers yet`, detail: "Rankings and coaching only learn from posts with numbers. Import an export or type them in.", action: { label: "Import analytics", href: "/metrics" } });
  const unrated = [...drafts, ...ready].filter((p) => p.ratings.gut == null);
  if (unrated.length)
    out.push({ id: "unrated", priority: 35, tone: "info", icon: "pen", title: `Rate ${unrated.length} draft${unrated.length === 1 ? "" : "s"} before posting`, detail: "Your gut score is how the app learns whether you can spot a winner.", action: { label: "Open drafts", href: "/posts?status=Drafting" } });
  if (!input.people.length)
    out.push({ id: "no-network", priority: 30, tone: "info", icon: "users", title: "Import your network", detail: "Unlocks leads, ‘who will care’ while you write, and audience vs network.", action: { label: "Import", href: "/network" } });
  if (input.people.length && !input.icp.functions.length && !input.icp.seniorities.length)
    out.push({ id: "no-icp", priority: 30, tone: "info", icon: "target", title: "Set your target profile", detail: "Tell the app who you want to reach so it can rank your leads.", action: { label: "Set profile", href: "/network" } });

  return out.sort((x, y) => y.priority - x.priority);
}
