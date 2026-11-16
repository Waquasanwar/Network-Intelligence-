import Link from "next/link";
import { AreaChart } from "@/components/area-chart";
import { Card, PageHeader, SectionTitle, StatCard } from "@/components/kit";
import { ImportForm, LogDayForm, SyncButton } from "@/components/metrics-tools";
import { fmt, SetupNeeded } from "@/components/ui";
import { notionReady } from "@/lib/env";
import { canReadAnalytics, getToken } from "@/lib/linkedin-api";
import { listDaily } from "@/lib/notion";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90, 180] as const;
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const pct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  if (!notionReady()) return <SetupNeeded />;
  const { range: r } = await searchParams;
  const range = (RANGES as readonly number[]).includes(Number(r)) ? Number(r) : 30;
  const [all, token] = await Promise.all([listDaily(daysAgo(range * 2)), getToken().catch(() => null)]);
  const analytics = canReadAnalytics(token);
  const cur = all.filter((d) => d.day >= daysAgo(range));
  const prev = all.filter((d) => d.day < daysAgo(range));
  const latest = (k: "totalFollowers" | "profileViews" | "searchAppearances") => [...all].reverse().find((d) => d[k] != null)?.[k] ?? null;

  const imp = sum(cur.map((d) => d.impressions));
  const eng = sum(cur.map((d) => d.engagements));
  const nf = sum(cur.map((d) => d.newFollowers));
  const er = imp ? Math.round((eng / imp) * 10000) / 100 : null;
  const erPrev = sum(prev.map((d) => d.impressions)) ? sum(prev.map((d) => d.engagements)) / sum(prev.map((d) => d.impressions)) * 100 : null;
  const dailyEr = cur.map((d) => ({ x: d.day, y: d.impressions && d.engagements != null ? Math.round((d.engagements / d.impressions) * 1000) / 10 : null }));

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Metrics"
        description="Account-wide numbers by day, from imports, the daily sync and your weekly log. Stored in your Notion “LinkedIn Daily Metrics” database."
        actions={
          <>
            <nav className="segmented" aria-label="Date range">
              {RANGES.map((d) => (
                <Link key={d} href={`/metrics?range=${d}`} className={d === range ? "on" : ""} aria-current={d === range ? "true" : undefined}>
                  {d}d
                </Link>
              ))}
            </nav>
            <SyncButton disabled={!analytics} />
          </>
        }
      />

      <div className="stats-row">
        <StatCard label={`Impressions · ${range} days`} value={fmt(imp || null)} delta={{ pct: pct(imp, sum(prev.map((d) => d.impressions))) }} spark={cur.map((d) => d.impressions)} />
        <StatCard label="Engagement rate" value={er != null ? `${er}%` : "–"} delta={{ pct: er != null && erPrev ? Math.round(((er - erPrev) / erPrev) * 100) : null }} spark={dailyEr.map((p) => p.y)} />
        <StatCard label={`New followers · ${range} days`} value={fmt(nf || null)} delta={{ pct: pct(nf, sum(prev.map((d) => d.newFollowers))) }} spark={cur.map((d) => d.newFollowers)} />
        <StatCard label="Followers" value={fmt(latest("totalFollowers"))} sub={`${cur.length} days of data in range`} spark={cur.map((d) => d.totalFollowers)} />
      </div>

      <div className="grid g2">
        <Card title="Impressions per day" description="How many times your posts were shown.">
          <AreaChart points={cur.map((d) => ({ x: d.day, y: d.impressions }))} label="Impressions per day" unit="impressions" />
        </Card>
        <Card title="Engagement rate per day" description="Engagements as a share of impressions, in percent.">
          <AreaChart points={dailyEr} label="Engagement rate per day" unit="%" />
        </Card>
        <Card title="New followers per day" description="Spikes usually line up with your best posts.">
          <AreaChart points={cur.map((d) => ({ x: d.day, y: d.newFollowers }))} label="New followers per day" unit="new followers" />
        </Card>
        <Card title="Total followers" description="From imports, the sync or your weekly log.">
          <AreaChart points={cur.map((d) => ({ x: d.day, y: d.totalFollowers }))} label="Total followers" unit="followers" />
        </Card>
      </div>

      <SectionTitle eyebrow="Data in" title="Add numbers" note="Import works today with no API approval. Log the two numbers no export includes once a week." />
      <div className="grid g2">
        <Card
          title="Import from LinkedIn"
          description="Upload an .xlsx export. Posts are matched to your library by their LinkedIn link."
        >
          <ol className="small steps">
            <li>
              <b>Account export:</b> <a href="https://www.linkedin.com/analytics/creator/content/" target="_blank" rel="noreferrer">Analytics &amp; tools → Post impressions</a>, pick up to 365 days, then Export. Daily impressions, engagements, new followers and your top 50 posts.
            </li>
            <li>
              <b>Single-post export:</b> open a post → View analytics → Export. Impressions, reach, reactions, comments, reposts, saves, sends, profile views and followers gained.
            </li>
          </ol>
          <ImportForm />
        </Card>
        <Card
          title="Weekly log"
          description="LinkedIn shows these on your profile but offers no API or export for them."
          action={<span className="small faint">Viewers {fmt(latest("profileViews"))} · Search {fmt(latest("searchAppearances"))}</span>}
        >
          <LogDayForm />
        </Card>
      </div>
    </>
  );
}
