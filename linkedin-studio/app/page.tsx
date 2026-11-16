import Link from "next/link";
import { Bars, Empty, fmt, fmtDate, Kpi, LineChart, SetupNeeded, TierBadge } from "@/components/ui";
import { notionReady } from "@/lib/env";
import { listDaily, listPosts } from "@/lib/notion";
import { avg, calibration, groupBy, lengthBucket, weekdayOf, type GroupInsight } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const days = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

function describeCorrelation(r: number | null, n: number) {
  if (r == null) return `Needs 5+ rated posts with metrics (you have ${n}).`;
  const strength = Math.abs(r) >= 0.5 ? "strongly" : Math.abs(r) >= 0.25 ? "somewhat" : "barely";
  return `${r > 0 ? "Predicts" : "Runs opposite to"} results ${strength} (r = ${r}, ${n} posts).`;
}

function Insight({ title, rows }: { title: string; rows: GroupInsight[] }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      {rows.length ? (
        <Bars rows={rows} value={(r: GroupInsight) => r.avgScore} label={(r: GroupInsight) => `${r.avgScore}`} />
      ) : (
        <p className="small faint">Fill this in on your posts to see a pattern.</p>
      )}
    </div>
  );
}

export default async function Dashboard() {
  if (!notionReady()) return <SetupNeeded />;
  const [posts, daily] = await Promise.all([listPosts(), listDaily(days(90))]);
  const live = posts.filter((p) => p.status !== "Archived");
  const published = live.filter((p) => p.status === "Published");
  const scored = published.filter((p) => p.performanceScore != null).sort((a, b) => a.rank! - b.rank!);
  const pipeline = ["Idea", "Drafting", "Ready", "Scheduled"].map((s) => [s, live.filter((p) => p.status === s).length] as const);

  const last30 = daily.filter((d) => d.day >= days(30));
  const prev30 = daily.filter((d) => d.day >= days(60) && d.day < days(30));
  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
  const imp30 = sum(last30.map((d) => d.impressions));
  const impPrev = sum(prev30.map((d) => d.impressions));
  const followers = [...daily].reverse().find((d) => d.totalFollowers != null)?.totalFollowers ?? null;
  const newFollowers30 = sum(last30.map((d) => d.newFollowers));
  const profileViews30 = sum(last30.map((d) => d.profileViews));
  const recent = published.filter((p) => (p.publishedAt ?? "") >= days(30));
  const er = recent.map((p) => p.engagementRate).filter((v): v is number => v != null);
  const cal = calibration(published);
  const change = impPrev > 0 ? Math.round(((imp30 - impPrev) / impPrev) * 100) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">What&rsquo;s working, what isn&rsquo;t, and what to write next.</p>
        </div>
        <Link className="btn primary" href="/write">
          New post
        </Link>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Kpi label="Impressions · 30 days" value={fmt(imp30 || null)} sub={imp30 === 0 ? "Import or sync to fill this in" : change == null ? "No earlier period to compare yet" : `${change >= 0 ? "+" : ""}${change}% vs previous 30 days`} />
        <Kpi label="Followers" value={fmt(followers)} sub={newFollowers30 ? `+${fmt(newFollowers30)} in 30 days` : "From imports, sync or your log"} />
        <Kpi label="Avg engagement · 30 days" value={er.length ? `${fmt(avg(er), { maximumFractionDigits: 2 })}%` : "–"} sub={`${recent.length} posts published`} />
        <Kpi label="Profile views · 30 days" value={fmt(profileViews30 || null)} sub="Logged on the Metrics page" />
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="row between">
            <h2>Daily impressions</h2>
            <Link className="small" href="/metrics">Metrics →</Link>
          </div>
          <LineChart points={daily.map((d) => ({ x: d.day, y: d.impressions }))} label="Daily impressions, last 90 days" />
        </div>
        <div className="panel">
          <h2>Pipeline</h2>
          <div className="grid g4">
            {pipeline.map(([s, n]) => (
              <Link key={s} href={`/posts?status=${s}`} className="kpi" style={{ color: "inherit" }}>
                <div className="label">{s}</div>
                <div className="value">{n}</div>
              </Link>
            ))}
          </div>
          <hr />
          <h3>How good are your predictions?</h3>
          <p className="small">
            <strong>Your gut score:</strong> {describeCorrelation(cal.gut, cal.gutN)}
          </p>
          <p className="small">
            <strong>AI score:</strong> {describeCorrelation(cal.ai, cal.aiN)}
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="row between">
          <h2>Top posts</h2>
          <Link className="small" href="/posts?status=Published&sort=rank">All ranked posts →</Link>
        </div>
        {scored.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Post</th>
                  <th>Published</th>
                  <th className="num">Score</th>
                  <th className="num">Impressions</th>
                  <th className="num">Engagement</th>
                  <th className="num">Comments</th>
                </tr>
              </thead>
              <tbody>
                {scored.slice(0, 8).map((p) => (
                  <tr key={p.id}>
                    <td className="num">{p.rank}</td>
                    <td>
                      <Link href={`/posts/${p.id}`} className="clamp">{p.title}</Link>
                      <div className="row small" style={{ marginTop: 2 }}>
                        <TierBadge post={p} total={scored.length} />
                        <span className="faint">{[p.pillar, p.format].filter(Boolean).join(" · ")}</span>
                      </div>
                    </td>
                    <td className="small muted">{fmtDate(p.publishedAt)}</td>
                    <td className="num"><strong>{p.performanceScore}</strong></td>
                    <td className="num">{fmt(p.metrics.impressions)}</td>
                    <td className="num">{p.engagementRate != null ? `${p.engagementRate}%` : "–"}</td>
                    <td className="num">{fmt(p.metrics.comments)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            No ranked posts yet. <Link href="/metrics">Import your LinkedIn analytics</Link> or add numbers to a published post.
          </Empty>
        )}
      </div>

      <h2 style={{ margin: "24px 0 12px" }}>What works for you</h2>
      <p className="small muted" style={{ marginTop: -6, marginBottom: 12 }}>Average performance score (0–100) by attribute. Bigger samples mean more trustworthy patterns.</p>
      <div className="grid g2">
        <Insight title="By pillar" rows={groupBy(published, (p) => p.pillar)} />
        <Insight title="By hook type" rows={groupBy(published, (p) => p.hookType)} />
        <Insight title="By format" rows={groupBy(published, (p) => p.format)} />
        <Insight title="By length" rows={groupBy(published, (p) => lengthBucket(p.text))} />
        <Insight title="By weekday" rows={groupBy(published, (p) => weekdayOf(p.publishedAt))} />
        <Insight title="By your hook rating" rows={groupBy(published, (p) => (p.ratings.hook ? `${p.ratings.hook} ★` : null))} />
      </div>
    </>
  );
}
