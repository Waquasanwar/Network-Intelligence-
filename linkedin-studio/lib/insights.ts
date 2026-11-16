/** Plain-language "what to do next", computed from your own numbers. */
import { avg, calibration, groupBy, lengthBucket, weekdayOf } from "./scoring";
import type { Post } from "./types";

export interface Move {
  id: string;
  tone: "good" | "warn" | "info";
  icon: "trend" | "calendar" | "target" | "clock" | "ruler" | "pen" | "spark";
  title: string;
  detail: string;
}

const DAY = 864e5;

export function nextMoves(posts: Post[], now = Date.now()): Move[] {
  const live = posts.filter((p) => p.status !== "Archived");
  const published = live.filter((p) => p.status === "Published");
  const scored = published.filter((p) => p.performanceScore != null);
  const baseline = Math.round(avg(scored.map((p) => p.performanceScore!)));
  const moves: Move[] = [];

  // Cadence first: nothing else matters if you stop posting.
  const last = published.map((p) => p.publishedAt).filter(Boolean).sort().pop();
  const ready = live.filter((p) => p.status === "Ready" || p.status === "Scheduled").length;
  if (last) {
    const days = Math.floor((now - new Date(last).getTime()) / DAY);
    if (days >= 7)
      moves.push({
        id: "cadence",
        tone: "warn",
        icon: "clock",
        title: `${days} days since your last post`,
        detail: ready ? `You have ${ready} ready to go. Post one today.` : "Nothing is ready. Draft something short today.",
      });
  }
  if (!ready && live.some((p) => p.status === "Drafting"))
    moves.push({ id: "pipeline", tone: "info", icon: "pen", title: "No posts ready to go", detail: "Finish one draft and mark it ready so you're never starting from blank." });

  const best = (key: (p: Post) => string | null) => {
    const g = groupBy(scored, key).filter((x) => x.count >= 1);
    return g.length >= 2 ? g[0] : null;
  };
  const confidence = (n: number) => (n >= 3 ? "" : ` Early signal: ${n} post${n === 1 ? "" : "s"} so far.`);

  const hook = best((p) => p.hookType);
  if (hook && hook.avgScore > baseline)
    moves.push({
      id: "hook",
      tone: "good",
      icon: "target",
      title: `${hook.key} hooks are your strongest`,
      detail: `They score ${hook.avgScore} on average against your ${baseline}. Open your next post with one.${confidence(hook.count)}`,
    });

  const pillar = best((p) => p.pillar);
  if (pillar && pillar.avgScore > baseline)
    moves.push({
      id: "pillar",
      tone: "good",
      icon: "trend",
      title: `Write more "${pillar.key}"`,
      detail: `Your best topic: ${pillar.avgScore} average score, ${pillar.avgImpressions.toLocaleString("en-GB")} impressions per post.${confidence(pillar.count)}`,
    });

  const day = best((p) => weekdayOf(p.publishedAt));
  if (day && day.avgScore > baseline)
    moves.push({
      id: "day",
      tone: "info",
      icon: "calendar",
      title: `${day.key}s work best for you`,
      detail: `Posts that go out on a ${day.key} average ${day.avgScore}.${confidence(day.count)}`,
    });

  const len = best((p) => lengthBucket(p.text));
  if (len && len.avgScore > baseline)
    moves.push({ id: "length", tone: "info", icon: "ruler", title: `${len.key.split(" (")[0]} posts win`, detail: `${len.key} average ${len.avgScore}.${confidence(len.count)}` });

  const cal = calibration(published);
  if (cal.gut != null && cal.gut >= 0.5)
    moves.push({ id: "gut", tone: "good", icon: "spark", title: "Trust your gut", detail: `Your gut score tracks real results closely (r = ${cal.gut}). If it feels like a 4, rework it.` });
  else if (cal.gut != null && cal.gut < 0.2)
    moves.push({ id: "gut", tone: "warn", icon: "spark", title: "Your gut is off", detail: `Gut scores barely predict results (r = ${cal.gut}). Lean on the data and the assistant's score.` });

  if (!scored.length)
    moves.push({ id: "start", tone: "info", icon: "trend", title: "Import your LinkedIn analytics", detail: "Ranks and patterns appear as soon as some posts have numbers." });

  return moves.slice(0, 4);
}
