import Link from "next/link";
import { AreaChart } from "@/components/area-chart";
import { Legend } from "@/components/coach-charts";
import { Card, Chip, PageHeader, SectionTitle, StatCard } from "@/components/kit";
import { ArchiveImport, EngagerLogger, IcpForm, PersonControls } from "@/components/network-tools";
import { Bars, Empty, SetupNeeded } from "@/components/ui";
import { env, notionReady } from "@/lib/env";
import { getIcp, listAudience, listPeople, listPosts, type AudienceRow } from "@/lib/notion";
import { FUNCTIONS, networkStats, rankLeads, scoreLead, SENIORITIES, type Lead } from "@/lib/people";

export const dynamic = "force-dynamic";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

/** LinkedIn's audience seniority labels mapped onto ours so the two can be compared. */
const LI_SENIORITY: Record<string, string> = {
  owner: "Founder / Owner", partner: "Director / Head", cxo: "C-suite", vp: "VP", director: "Director / Head",
  manager: "Manager / Lead", senior: "Senior IC", entry: "IC", training: "Student / Early", unpaid: "Student / Early",
};

function latestAccount(rows: AudienceRow[]) {
  const acc = rows.filter((r) => r.scope === "Account");
  const last = acc.map((r) => r.capturedOn).sort().pop();
  return { date: last ?? null, rows: acc.filter((r) => r.capturedOn === last) };
}

function LeadRow({ l }: { l: Lead }) {
  const p = l.person;
  return (
    <div className="person">
      <span className="avatar" aria-hidden>{initials(p.name)}</span>
      <div className="who">
        <b>{p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.name}</a> : p.name}</b>
        <span>{[p.position, p.company].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="meters">
        <div className="meter" title={`Fit ${l.fit}/100`}><span>Fit</span><i><span style={{ width: `${l.fit}%` }} /></i></div>
        <div className="meter warm" title={`Warmth ${l.warmth}/100`}><span>Warm</span><i><span style={{ width: `${l.warmth}%` }} /></i></div>
      </div>
      <div className="score" aria-label={`Lead score ${l.score}`}>{l.score}</div>
      <div className="why">
        <b>{l.action}</b>
        {l.reasons.slice(0, 3).join(" · ") || p.seniority}
      </div>
      <PersonControls id={p.id} watch={p.watch} status={p.leadStatus} />
    </div>
  );
}

export default async function NetworkPage() {
  if (!notionReady()) return <SetupNeeded />;
  const configured = Boolean(env.ds.connections() && env.ds.audience());
  const [people, audience, icp, posts] = await Promise.all([listPeople(), listAudience(), getIcp(), listPosts()]);
  const stats = networkStats(people);
  const leads = rankLeads(people, icp, 15);
  const fitCount = people.filter((p) => scoreLead(p, icp).fit >= 50).length;
  const watch = people.filter((p) => p.watch);
  const acc = latestAccount(audience);
  const byCat = (c: string) => acc.rows.filter((r) => r.category === c && r.percent != null).sort((a, b) => b.percent! - a.percent!).slice(0, 7);
  const published = posts.filter((p) => p.status === "Published").slice(0, 40);

  // audience vs network, by seniority
  const audSen = new Map<string, number>();
  for (const r of byCat("Seniority")) {
    const k = LI_SENIORITY[r.value.toLowerCase().split(/\s/)[0]] ?? r.value;
    audSen.set(k, (audSen.get(k) ?? 0) + (r.percent ?? 0));
  }
  const netSen = new Map(stats.seniority.map((s) => [s.key, stats.total ? (s.count / stats.total) * 100 : 0]));
  const compare = SENIORITIES.filter((s) => s !== "Unknown")
    .map((s) => ({ key: s, aud: Math.round(audSen.get(s) ?? 0), net: Math.round(netSen.get(s) ?? 0) }))
    .filter((r) => r.aud || r.net);
  const cmax = Math.max(1, ...compare.flatMap((r) => [r.aud, r.net]));
  const gap = [...compare].filter((r) => r.aud && r.net).sort((a, b) => b.aud / b.net - a.aud / a.net)[0];

  return (
    <div className="reveal">
      <PageHeader
        eyebrow="Network"
        title="Audience & network"
        description="Who sees your posts, who you know, and who to talk to next. Built from your own LinkedIn data, stored in Notion."
        actions={
          <>
            <a className="btn" href="/api/network/export?type=people">Export network CSV</a>
            <a className="btn primary" href="/api/network/export?type=leads">Export leads CSV</a>
          </>
        }
      />
      {!configured ? (
        <div className="notice" style={{ marginBottom: 16 }}>
          Run <code>npm run setup:notion</code> once more to add the Network and Audience databases, then restart the app.
        </div>
      ) : null}

      <div className="stats-row">
        <StatCard label="Connections" value={stats.total.toLocaleString("en-GB")} sub={`+${stats.last90.toLocaleString("en-GB")} in 90 days`} spark={stats.perMonth.slice(-12).map((m) => m.y)} />
        <StatCard label="Engaged with your posts" value={stats.engaged.toLocaleString("en-GB")} sub={stats.total ? `${Math.round((stats.engaged / stats.total) * 100)}% of your network` : "Log engagers below"} />
        <StatCard label="Fit your target profile" value={fitCount.toLocaleString("en-GB")} sub={icp.functions.length || icp.seniorities.length ? "Fit score 50+" : "Set your profile below"} />
        <StatCard label="Reachable by email" value={stats.withEmail.toLocaleString("en-GB")} sub="Shared their email with connections" />
      </div>

      <SectionTitle eyebrow="Audience" title="Who sees your posts vs who you know" note={acc.date ? `Audience from LinkedIn's export of ${acc.date}.` : "Import an account analytics export on the Metrics page to fill in your audience."} />
      <div className="grid g2">
        <Card
          title="Seniority: audience vs network"
          description="Share of people who view your posts against share of your connections."
          takeaway={
            gap ? (
              <><b>{gap.key}</b> make up {gap.aud}% of your viewers but only {gap.net}% of your network. Connect with more of them: they already read you.</>
            ) : (
              <>Import both your connections and an account analytics export to compare.</>
            )
          }
        >
          <Legend items={[{ label: "Audience (viewers)", color: "var(--coral-mark)" }, { label: "Your network", color: "var(--series)" }]} />
          {compare.length ? (
            compare.map((r) => (
              <div className="compare-row" key={r.key} data-tip={`${r.key}: ${r.aud}% of viewers, ${r.net}% of connections`}>
                <span>{r.key}</span>
                <span className="compare-bars">
                  <i className="aud" style={{ width: `${(r.aud / cmax) * 100}%` }} />
                  <i className="net" style={{ width: `${(r.net / cmax) * 100}%` }} />
                </span>
                <span className="v"><b>{r.aud}%</b> vs {r.net}%</span>
              </div>
            ))
          ) : (
            <Empty>No data yet.</Empty>
          )}
        </Card>
        <Card title="Network growth" description="New connections per month, last 24 months.">
          <AreaChart points={stats.perMonth} label="New connections per month" unit="new connections" />
        </Card>
        {(["Job titles", "Industries", "Companies", "Locations"] as const).map((c) => (
          <Card key={c} className="powder" title={`Viewers by ${c.toLowerCase()}`} description="Top values from LinkedIn’s audience demographics.">
            {byCat(c).length ? (
              <Bars rows={byCat(c).map((r) => ({ key: r.value, count: 0, value: Math.round(r.percent!), tip: `${r.percent}% of your viewers` }))} max={Math.max(...byCat(c).map((r) => r.percent!))} hideCount />
            ) : (
              <p className="small faint">Import an account analytics export to see this.</p>
            )}
          </Card>
        ))}
        <Card title="Your network by function" description="Classified from each connection’s job title.">
          {stats.functions.length ? <Bars rows={stats.functions.slice(0, 8).map((f) => ({ key: f.key, count: 0, value: f.count, tip: `${f.count} connections` }))} max={stats.functions[0].count} hideCount /> : <p className="small faint">Import your connections below.</p>}
        </Card>
        <Card title="Top companies in your network" description="Where you know the most people. Good targets for a company-specific post.">
          {stats.companies.length ? <Bars rows={stats.companies.slice(0, 8).map((f) => ({ key: f.key, count: 0, value: f.count, tip: `${f.count} connections` }))} max={stats.companies[0].count} hideCount /> : <p className="small faint">Import your connections below.</p>}
        </Card>
      </div>

      <SectionTitle eyebrow="Leads" title="Who to talk to next" note="Score = 60% fit with your target profile + 40% warmth (engagement, recency, watchlist)." />
      <div className="split">
        <Card flush title="Top leads in your network" description={`Top ${leads.length}. Click a name to open their profile; export the CSV for everyone.`} action={<Chip tone="neutral">{people.length.toLocaleString("en-GB")} scored</Chip>}>
          {leads.length ? <div className="people">{leads.map((l) => <LeadRow key={l.person.id} l={l} />)}</div> : <Empty>Import your connections below to see leads.</Empty>}
        </Card>
        <div className="stack" style={{ gap: "var(--gap)" }}>
          <Card accent title="Your target profile" description="Who you want to reach or sell to. Leads are scored against it.">
            <IcpForm icp={icp} functions={FUNCTIONS} seniorities={SENIORITIES} />
          </Card>
          <Card title="Log who engaged" description="LinkedIn doesn’t share who reacts or comments. Paste them here and they become warm leads.">
            {published.length ? <EngagerLogger posts={published.map((p) => ({ id: p.id, title: p.title }))} /> : <p className="small faint">Publish or import a post first.</p>}
          </Card>
        </div>
      </div>

      <SectionTitle eyebrow="Activity" title="What your network is doing" note="LinkedIn offers no feed API, so this is your shortcut list: one click to each person’s latest posts." />
      <div className="grid g2">
        <Card title={`Watchlist · ${watch.length}`} description="Star people in the leads list to follow what they post. Comment early on their posts to warm them up.">
          {watch.length ? (
            <div className="people">
              {watch.slice(0, 20).map((p) => (
                <div key={p.id} className="person compact">
                  <span className="avatar" aria-hidden>{initials(p.name)}</span>
                  <div className="who"><b>{p.name}</b><span>{[p.position, p.company].filter(Boolean).join(" · ")}</span></div>
                  <span className="ctrl">{p.url ? <a className="btn small" href={`${p.url}/recent-activity/all/`} target="_blank" rel="noreferrer">Latest posts</a> : null}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="small faint">No one yet. Use ☆ on a lead to add them.</p>
          )}
        </Card>
        <Card className="powder" title="Import your LinkedIn data" description="Settings & Privacy → Data privacy → Get a copy of your data. Upload the ZIP (or Connections.csv / Shares.csv).">
          <ul className="small steps">
            <li><b>Connections.csv:</b> everyone in your network with company, title, date connected and email where shared.</li>
            <li><b>Shares.csv:</b> every post you have written, added to your library so you can rate and learn from them.</li>
            <li>Messages are never read. Nothing leaves your Notion and this app.</li>
          </ul>
          <ArchiveImport />
          <p className="small faint" style={{ marginTop: 10 }}>Re-import monthly to pick up new connections and job changes. <Link href="/metrics">Analytics exports go on the Metrics page.</Link></p>
        </Card>
      </div>
    </div>
  );
}
