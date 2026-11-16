import { ImportForm, LogDayForm, SyncButton } from "@/components/metrics-tools";
import { fmt, Kpi, LineChart, SetupNeeded } from "@/components/ui";
import { notionReady } from "@/lib/env";
import { canReadAnalytics, getToken } from "@/lib/linkedin-api";
import { listDaily } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  if (!notionReady()) return <SetupNeeded />;
  const since = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
  const [daily, token] = await Promise.all([listDaily(since), getToken().catch(() => null)]);
  const analytics = canReadAnalytics(token);
  const latest = (k: "totalFollowers" | "profileViews" | "searchAppearances") => [...daily].reverse().find((d) => d[k] != null)?.[k] ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Metrics</h1>
          <p className="muted">Account-level numbers by day. Stored in your Notion &ldquo;LinkedIn Daily Metrics&rdquo; database.</p>
        </div>
        <SyncButton disabled={!analytics} />
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Kpi label="Followers" value={fmt(latest("totalFollowers"))} />
        <Kpi label="Profile viewers" value={fmt(latest("profileViews"))} sub="Latest logged, past 90 days" />
        <Kpi label="Search appearances" value={fmt(latest("searchAppearances"))} sub="Latest logged, past 7 days" />
        <Kpi label="Days of data" value={fmt(daily.length)} sub="Last 180 days" />
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <h2>Impressions per day</h2>
          <LineChart points={daily.map((d) => ({ x: d.day, y: d.impressions }))} />
        </div>
        <div className="panel">
          <h2>Engagements per day</h2>
          <LineChart points={daily.map((d) => ({ x: d.day, y: d.engagements }))} />
        </div>
        <div className="panel">
          <h2>New followers per day</h2>
          <LineChart points={daily.map((d) => ({ x: d.day, y: d.newFollowers }))} />
        </div>
        <div className="panel">
          <h2>Total followers</h2>
          <LineChart points={daily.map((d) => ({ x: d.day, y: d.totalFollowers }))} />
        </div>
      </div>

      <div className="grid g2">
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>Import from LinkedIn</h2>
          <p className="small muted">Works today, no API approval needed. Two kinds of file:</p>
          <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <strong>Account export</strong>: on LinkedIn, go to <em>Analytics &amp; tools → Post impressions</em> (or{" "}
              <a href="https://www.linkedin.com/analytics/creator/content/" target="_blank" rel="noreferrer">linkedin.com/analytics/creator/content</a>), pick a date range (up to 365 days), then <em>Export</em>. Gives daily impressions,
              engagements, new followers, your top 50 posts and audience demographics.
            </li>
            <li>
              <strong>Single-post export</strong>: open any of your posts → <em>View analytics</em> → <em>Export</em>. Gives that post&rsquo;s impressions, reach,
              reactions, comments, reposts, saves, sends, profile views and followers gained.
            </li>
          </ol>
          <ImportForm />
        </div>
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>Log what no export includes</h2>
          <p className="small muted">
            LinkedIn shows these on your profile dashboard but offers no API or export for them on personal profiles. Log them weekly; it takes 20 seconds.
          </p>
          <LogDayForm />
        </div>
      </div>
    </>
  );
}
