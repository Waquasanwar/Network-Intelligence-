import Link from "next/link";
import { AreaChart } from "@/components/area-chart";
import { Legend, Scatter, TrendColumns } from "@/components/coach-charts";
import { scoreTrend, splitWinners, trendDelta, winnersVsRest } from "@/lib/coach";
import { Icon } from "@/components/icons";
import { AdaptiveStack, Greeting } from "@/components/adaptive";
import { AskButton } from "@/components/ask-button";
import { Constellation } from "@/components/constellation";
import { LivePill, Ticker, TimeAgo } from "@/components/live";
import { signals as agentSignals, type Signal } from "@/lib/agent";
import { PulseLine } from "@/components/pulse-line";
import { postingPulse, recentActivity } from "@/lib/activity";
import { Dumbbell, ScoreRing, Sparkline } from "@/components/mini-charts";
import { Card, CardLink, Chip, PageHeader, SectionTitle } from "@/components/kit";
import { Bars, Empty, fmt, fmtDate, SetupNeeded, TierBadge } from "@/components/ui";
import { notionReady } from "@/lib/env";
import { nextMoves, type Move } from "@/lib/insights";
import { getIcp, listDaily, listPeople, listPosts } from "@/lib/notion";
import { avg, calibration, groupBy, lengthBucket, WEEKDAYS, weekdayOf, type GroupInsight } from "@/lib/scoring";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const compact = (v: number | null) => (v == null ? "–" : v.toLocaleString("en-GB", { notation: v >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }));

function toBars(rows: GroupInsight[]) {
  return rows.slice(0, 6).map((r) => ({
    key: r.key,
    count: r.count,
    value: r.avgScore,
    tip: `${r.count} post${r.count === 1 ? "" : "s"} · ${r.avgImpressions.toLocaleString("en-GB")} avg impressions${r.avgEngagementRate != null ? ` · ${r.avgEngagementRate}% eng.` : ""}`,
  }));
}

function HeroDelta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="delta flat">No earlier period yet</span>;
  const dir = pct > 1 ? "up" : pct < -1 ? "down" : "flat";
  return (
    <span className={`delta ${dir}`}>
      {dir === "up" ? "↑" : dir === "down" ? "↓" : "•"} {Math.abs(pct)}% vs previous 30 days
    </span>
  );
}

function MoveIcon({ m }: { m: Move }) {
  const I = { trend: Icon.trend, calendar: Icon.calendar, target: Icon.target, clock: Icon.clock, ruler: Icon.ruler, pen: Icon.pen, spark: Icon.spark }[m.icon];
  return <span className="icon"><I /></span>;
}

function Insight({ title, rows, empty }: { title: string; rows: GroupInsight[]; empty: string }) {
  return (
    <Card title={title} description="Average score, 0–100">
      {rows.length ? <Bars rows={toBars(rows)} /> : <p className="small faint">{empty}</p>}
    </Card>
  );
}

function Weekdays({ posts }: { posts: Post[] }) {
  const rows = new Map(groupBy(posts, (p) => weekdayOf(p.publishedAt)).map((g) => [g.key, g]));
  const order = [1, 2, 3, 4, 5, 6, 0].map((i) => WEEKDAYS[i]);
  return (
    <Card title="Best day to post" description="Average score by weekday. Darker is better.">
      <div className="heat">
        {order.map((d) => {
          const g = rows.get(d);
          const v = g?.avgScore ?? null;
          const pct = v == null ? 0 : 12 + (v / 100) * 78;
          return (
            <div
              key={d}
              className="heat-cell"
              data-tip={g ? `${d}: ${g.count} post${g.count === 1 ? "" : "s"}, avg score ${v}` : `${d}: no posts yet`}
              style={{
                background: v == null ? "var(--panel-muted)" : `color-mix(in srgb, var(--series) ${pct}%, var(--panel))`,
                color: v != null && pct > 55 ? "#fff" : "var(--ink)",
              }}
            >
              <span style={{ opacity: 0.8 }}>{d.slice(0, 3)}</span>
              <b>{v ?? "–"}</b>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default async function Dashboard() {
  if (!notionReady()) return <SetupNeeded />;
  const [posts, daily, people, icp] = await Promise.all([listPosts(), listDaily(daysAgo(90)), listPeople().catch(() => []), getIcp()]);
  const today_ = agentSignals({ posts, daily, people, icp });
  const live = posts.filter((p) => p.status !== "Archived");
  const published = live.filter((p) => p.status === "Published");
  const ranked = published.filter((p) => p.performanceScore != null).sort((a, b) => a.rank! - b.rank!);
  const best = ranked[0];

  const last30 = daily.filter((d) => d.day >= daysAgo(30));
  const prev30 = daily.filter((d) => d.day >= daysAgo(60) && d.day < daysAgo(30));
  const imp30 = sum(last30.map((d) => d.impressions));
  const impPrev = sum(prev30.map((d) => d.impressions));
  const change = impPrev > 0 ? Math.round(((imp30 - impPrev) / impPrev) * 100) : null;
  const followers = [...daily].reverse().find((d) => d.totalFollowers != null)?.totalFollowers ?? null;
  const newFollowers30 = sum(last30.map((d) => d.newFollowers));
  const views = [...daily].reverse().find((d) => d.profileViews != null)?.profileViews ?? null;
  const recent = published.filter((p) => (p.publishedAt ?? "") >= daysAgo(30));
  const ers = recent.map((p) => p.engagementRate).filter((v): v is number => v != null);
  const dailyEr = last30.map((d) => (d.impressions && d.engagements != null ? (d.engagements / d.impressions) * 100 : null));
  const cal = calibration(published);
  const moves = nextMoves(posts);

  const stages = ["Idea", "Drafting", "Ready", "Scheduled"] as const;
  const counts = stages.map((s) => live.filter((p) => p.status === s).length);
  const maxStage = Math.max(1, ...counts);
  const pulse = postingPulse(posts);
  const trend = scoreTrend(posts);
  const delta = trendDelta(trend);
  const compare = winnersVsRest(posts);
  const split = splitWinners(posts);
  const winnerIds = new Set(split?.winners.map((p) => p.id) ?? []);
  const topGap = [...compare].filter((r) => r.ratio != null && r.key !== "length").sort((a, b) => b.ratio! - a.ratio!)[0];
  const reach = ranked
    .filter((p) => p.metrics.impressions && p.engagementRate != null)
    .map((p) => ({
      id: p.id,
      x: p.metrics.impressions!,
      y: p.engagementRate!,
      label: p.title,
      detail: `${p.metrics.impressions!.toLocaleString("en-GB")} impressions · ${p.engagementRate}% engagement · score ${p.performanceScore}`,
      href: `/posts/${p.id}`,
      highlight: winnerIds.has(p.id),
    }));
  const gutPts = ranked
    .filter((p) => p.ratings.gut != null)
    .map((p) => ({
      id: p.id,
      x: p.ratings.gut!,
      y: p.performanceScore!,
      label: p.title,
      detail: `You guessed ${p.ratings.gut}/10 · actual score ${p.performanceScore}`,
      href: `/posts/${p.id}`,
      highlight: winnerIds.has(p.id),
    }));
  const coachLegend = [
    { label: "Your top 25%", color: "var(--coral-mark)" },
    { label: "Other posts", color: "var(--series)" },
  ];
  const activity = recentActivity(posts);
  const updatedAt = posts.map((p) => p.lastSynced).filter((v): v is string => !!v).sort().pop() ?? null;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="reveal">
      <PageHeader
        eyebrow={<Greeting date={today} />}
        meta={<LivePill updatedAt={updatedAt} />}
        title="What’s working on LinkedIn"
        description={today_[0] ? <>Today’s focus: <b>{today_[0].title}</b>. {today_[0].detail}</> : "Your reach, your best posts and what to write next, from the numbers in Notion."}
        actions={
          <>
            <Link className="btn" href="/metrics"><Icon.upload /> Import analytics</Link>
            <Link className="btn primary" href="/write"><Icon.plus /> New post</Link>
          </>
        }
      />

      <section className="hero" aria-label="Last 30 days">
        <Constellation nodes={Math.min(90, Math.max(40, Math.round(people.length / 4)))} warm={people.filter((p) => p.engagedCount > 0).length} />
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Impressions · last 30 days</div>
          <div className="hero-figure">
            <span className="big">{imp30 ? <Ticker value={imp30} /> : "–"}</span>
            {imp30 ? <HeroDelta pct={change} /> : <span className="unit">Import or sync to see your reach</span>}
          </div>
          <p className="small" style={{ color: "var(--stage-muted)", marginBottom: 14 }}>
            {recent.length} post{recent.length === 1 ? "" : "s"} published in this period
            {best ? <> · best: &ldquo;{best.title.slice(0, 48)}{best.title.length > 48 ? "…" : ""}&rdquo;</> : null}
          </p>
          <AreaChart tone="stage" height={180} points={last30.map((d) => ({ x: d.day, y: d.impressions }))} label="Daily impressions, last 30 days" unit="impressions" />
          <div className="pulse-strip">
            <div className="row">
              <span className="hero-label"><span className="beat" aria-hidden>♥</span> Posting pulse · last 30 days</span>
              <span className="pulse-stats">
                <span><b>{pulse.beats.length}</b>posts</span>
                <span><b>{pulse.avgGap ?? "–"}</b>days apart</span>
                <span><b>{pulse.beats.length ? Math.round(avg(pulse.beats.map((b) => b.score ?? 0))) : "–"}</b>avg score</span>
              </span>
            </div>
            <PulseLine days={pulse.days} beats={pulse.beats} />
          </div>
        </div>
        <div className="hero-side">
          <div className={`hero-stat ${newFollowers30 ? "hot" : ""}`}>
            <div className="hero-label">Followers</div>
            <div className="row">
              <div>
                <div className="v">{followers != null ? <Ticker value={followers} /> : "–"}</div>
                <div className="s">{newFollowers30 ? `+${newFollowers30.toLocaleString("en-GB")} in 30 days` : "From imports or your log"}</div>
              </div>
              <Sparkline values={last30.map((d) => d.newFollowers)} color="var(--coral)" />
            </div>
          </div>
          <div className="hero-stat">
            <div className="hero-label">Engagement rate</div>
            <div className="row">
              <div>
                <div className="v">{ers.length ? `${avg(ers).toFixed(2)}%` : "–"}</div>
                <div className="s">Average across recent posts</div>
              </div>
              <Sparkline values={dailyEr} />
            </div>
          </div>
          <div className="hero-stat">
            <div className="hero-label">Profile viewers</div>
            <div className="row">
              <div>
                <div className="v">{compact(views)}</div>
                <div className="s">{views == null ? <Link href="/metrics" style={{ textDecoration: "underline" }}>Log it weekly</Link> : "Past 90 days, as logged"}</div>
              </div>
              <Sparkline values={daily.map((d) => d.profileViews)} />
            </div>
          </div>
        </div>
      </section>

      {today_.length ? (
        <section className="today" aria-label="Today">
          <div className="today-head">
            <span className="eyebrow">Today</span>
            <span className="small faint">Your agent checked your posts, metrics and network.</span>
            <AskButton />
          </div>
          <div className="today-cards">
            {today_.slice(0, 3).map((s: Signal) => (
              <article key={s.id} className={`signal ${s.tone}`}>
                <b>{s.title}</b>
                <p>{s.detail}</p>
                {s.action ? <Link className="btn small" href={s.action.href}>{s.action.label} <Icon.arrow /></Link> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <AdaptiveStack>
      <div data-section="best" className="split stretch">
        <Card title="Your best post" description={best ? `#1 of ${ranked.length} · ${fmtDate(best.publishedAt)}` : undefined} action={best ? <CardLink href={`/posts/${best.id}`}>Open</CardLink> : null}>
          {best ? (
            <div className="best">
              <div className="spotlight">
                <ScoreRing score={best.performanceScore} />
                <div style={{ minWidth: 0 }}>
                  <TierBadge post={best} total={ranked.length} />
                  <div className="quote">&ldquo;{best.title}&rdquo;</div>
                  <div className="metric-strip">
                    <span><b>{fmt(best.metrics.impressions)}</b>impressions</span>
                    <span><b>{best.engagementRate != null ? `${best.engagementRate}%` : "–"}</b>engagement</span>
                    <span><b>{fmt(best.metrics.comments)}</b>comments</span>
                    <span><b>{fmt(best.metrics.followersGained)}</b>followers gained</span>
                  </div>
                </div>
              </div>
              {best.text.trim() ? <blockquote className="excerpt">{best.text.trim().split("\n").filter(Boolean).slice(0, 4).join("\n")}</blockquote> : null}
              <div className="row" style={{ marginTop: "auto", paddingTop: 16 }}>
                <Link className="btn small" href={`/write?text=${encodeURIComponent(`Following up on my post about "${best.title.slice(0, 60)}"\n\n`)}`}>
                  <Icon.pen /> Write a follow-up
                </Link>
              </div>
            </div>
          ) : (
            <Empty>Your top post shows here once some posts have numbers. <Link href="/metrics">Import analytics</Link></Empty>
          )}
        </Card>
        <Card accent title="Your next moves" description="Worked out from your own numbers.">
          <div className="moves">
            {moves.map((m) => (
              <div key={m.id} className={`move ${m.tone}`}>
                <MoveIcon m={m} />
                <div>
                  <b>{m.title}</b>
                  <p>{m.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div data-section="improve">
      <SectionTitle eyebrow="Get better" title="Where to improve" note="Coral is your top 25% of posts, blue the rest. Click any mark to open the post." />
      <div className="grid g2">
        <Card
          title="Are you getting better?"
          description="Every post’s score in publishing order, with a 3-post average."
          action={delta != null ? <Chip tone={delta > 2 ? "up" : delta < -2 ? "down" : "neutral"}>{delta > 0 ? "↑ +" : delta < 0 ? "↓ " : ""}{delta} pts</Chip> : null}
          takeaway={
            delta == null ? (
              <>Score a few more posts to see your trend.</>
            ) : delta > 2 ? (
              <><b>You’re improving.</b> Your latest posts score {delta} points higher than your first ones. Keep doing what changed.</>
            ) : delta < -2 ? (
              <><b>You’ve slipped {Math.abs(delta)} points.</b> Reread your top posts and compare them with your last three.</>
            ) : (
              <><b>Holding steady.</b> To move up, copy one thing your top posts do differently.</>
            )
          }
        >
          <Legend items={[...coachLegend.map((l) => ({ ...l, kind: "bar" as const })), { label: "3-post average", color: "var(--ink)", kind: "line" }]} />
          <TrendColumns bars={trend} />
        </Card>
        <Card
          title="Reach vs engagement"
          description="Each dot is a post. The lines are your medians."
          takeaway={<><b>Top left</b> resonated but wasn’t seen: repost the idea with a sharper first line. <b>Bottom right</b> was seen but not felt: end with a real question or a stronger opinion.</>}
        >
          <Legend items={coachLegend} />
          <Scatter points={reach} xLabel="Impressions" yLabel="Engagement rate" yFmt="pct" quadrants={["Loved, small reach", "Hits", "Missed", "Seen, not felt"]} />
        </Card>
        <Card
          title="What your best posts do differently"
          description="Your top 25% against the rest. Hover a row for what to try."
          takeaway={topGap ? <><b>Biggest gap: {topGap.label.toLowerCase()}</b> ({topGap.ratio!.toFixed(1)}× higher on your top posts). {topGap.hint}</> : undefined}
        >
          <Legend items={coachLegend} />
          {compare.length ? <Dumbbell rows={compare} /> : <p className="small faint">Needs 4+ posts with numbers.</p>}
        </Card>
        <Card
          title="Does your gut know a winner?"
          description="Your 1–10 guess before posting against the real score."
          action={cal.gut != null ? <Chip tone={cal.gut >= 0.5 ? "up" : cal.gut < 0.2 ? "down" : "neutral"}>r = {cal.gut}</Chip> : null}
          takeaway={
            cal.gut == null ? (
              <>Give a gut score on {Math.max(0, 5 - cal.gutN)} more published posts to see this.</>
            ) : cal.gut >= 0.5 ? (
              <><b>Your instinct is reliable.</b> If a draft feels like a 5, rework it before posting.</>
            ) : (
              <><b>Your instinct is off.</b> Use the AI score and these charts, not your feeling, to pick what to post.</>
            )
          }
        >
          <Legend items={[...coachLegend, { label: "Trend", color: "var(--ink)", kind: "line" }]} />
          <Scatter points={gutPts} xLabel="Your gut score" yLabel="Actual score" xFmt="int" yMax={100} fitLine />
        </Card>
      </div>

      </div>

      <div data-section="rankings">
      <SectionTitle eyebrow="Rankings" title="Leaderboard and pipeline" />
      <div className="split">
        <Card flush title="Leaderboard" description="Every published post, ranked against your own history." action={<CardLink href="/posts?status=Published&sort=rank">All posts</CardLink>}>
          {ranked.length ? (
            ranked.slice(0, 7).map((p) => (
              <Link key={p.id} href={`/posts/${p.id}`} className="leader">
                <span className={`pos ${p.rank === 1 ? "top" : ""}`}>{p.rank}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="t">{p.title}</div>
                  <div className="m">
                    <TierBadge post={p} total={ranked.length} />
                    <span>{fmt(p.metrics.impressions)} impr.</span>
                    <span>{p.engagementRate != null ? `${p.engagementRate}% eng.` : ""}</span>
                  </div>
                </div>
                <div className="bar-track" data-tip={`Score ${p.performanceScore} of 100`}>
                  <div className={`bar ${winnerIds.has(p.id) ? "lead" : ""}`} style={{ width: `${p.performanceScore}%` }} />
                </div>
                <div className="score">{p.performanceScore}<small>/ 100</small></div>
              </Link>
            ))
          ) : (
            <Empty>No ranked posts yet.</Empty>
          )}
        </Card>
        <div className="stack" style={{ gap: "var(--gap)" }}>
          <Card title="Pipeline" description="Posts waiting to go out." action={<CardLink href="/posts">Posts</CardLink>}>
            <div className="pipeline">
              {stages.map((s, i) => (
                <Link key={s} href={`/posts?status=${s}`} className="stage-cell">
                  <div className="stage-name">{s}</div>
                  <b>{counts[i]}</b>
                  <i><span style={{ width: `${(counts[i] / maxStage) * 100}%` }} /></i>
                </Link>
              ))}
            </div>
          </Card>
          <Card title="Activity" description="Updates every 2 minutes.">
            {activity.length ? (
              <ul className="feed">
                {activity.map((e) => (
                  <li key={e.id} className={e.kind}>
                    <i aria-hidden />
                    <div style={{ minWidth: 0 }}>
                      <Link href={e.kind === "draft" ? `/write?id=${e.postId}` : `/posts/${e.postId}`}>{e.text}</Link>
                      <TimeAgo iso={e.at} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small faint">Nothing yet. Write a draft or import your analytics.</p>
            )}
          </Card>
        </div>
      </div>

      </div>

      <div data-section="patterns">
      <SectionTitle eyebrow="Patterns" title="What works for you" note="Hover a bar for post counts, impressions and engagement." />
      <div className="grid g3">
        <Insight title="Hook type" rows={groupBy(published, (p) => p.hookType)} empty="Tag hook types on your posts to see a pattern." />
        <Insight title="Pillar" rows={groupBy(published, (p) => p.pillar)} empty="Give posts a pillar to see which topics land." />
        <Insight title="Format" rows={groupBy(published, (p) => p.format)} empty="Set a format on your posts." />
        <Weekdays posts={published} />
        <Insight title="Length" rows={groupBy(published, (p) => lengthBucket(p.text))} empty="Paste post text in to compare lengths." />
        <Insight title="Your hook rating" rows={groupBy(published, (p) => (p.ratings.hook ? `${p.ratings.hook} ★` : null))} empty="Rate hooks before posting to see if you can spot a winner." />
      </div>
      </div>
      </AdaptiveStack>
    </div>
  );
}
