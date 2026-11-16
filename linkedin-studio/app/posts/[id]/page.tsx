import Link from "next/link";
import { AreaChart } from "@/components/area-chart";
import { notFound } from "next/navigation";
import { archive } from "@/app/actions";
import { Diverging } from "@/components/mini-charts";
import { MetricsForm, RatingPanel, StatusPanel } from "@/components/post-panels";
import { vsTypical } from "@/lib/coach";
import { Icon } from "@/components/icons";
import { Card, Chip, PageHeader, StatCard } from "@/components/kit";
import { Bars, fmt, fmtDate, SetupNeeded, StatusBadge, TierBadge } from "@/components/ui";
import { notionReady } from "@/lib/env";
import { getPost, listPosts, listSnapshots } from "@/lib/notion";
import { totalEngagements } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  if (!notionReady()) return <SetupNeeded />;
  const { id } = await params;
  const [post, all, snaps] = await Promise.all([getPost(id), listPosts(), listSnapshots(id)]);
  if (!post) notFound();
  const total = all.filter((p) => p.rank != null).length;
  const m = post.metrics;
  const archiveThis = archive.bind(null, post.id);
  const vs = vsTypical(post, all);
  const best = [...vs].sort((a, b) => b.pct - a.pct)[0];
  const worst = [...vs].sort((a, b) => a.pct - b.pct)[0];

  const vsOf = (k: string) => vs.find((r) => r.key === k)?.pct ?? null;
  const mix = (
    [
      ["Reactions", m.reactions],
      ["Comments", m.comments],
      ["Reposts", m.reposts],
      ["Saves", m.saves],
      ["Sends", m.sends],
      ["Profile views", m.profileViews],
      ["Followers gained", m.followersGained],
      ["Link clicks", m.linkClicks],
    ] as const
  ).filter(([, v]) => v != null) as [string, number][];
  const mixMax = Math.max(1, ...mix.map(([, v]) => v));

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/posts">Posts</Link>}
        meta={<><StatusBadge status={post.status} /><TierBadge post={post} total={total} /></>}
        title={post.title}
        description={
          <>
            {[post.pillar, post.format, post.hookType].filter(Boolean).join(" · ") || "No pillar or format yet"} · Published {fmtDate(post.publishedAt)}
            {post.metricsSource ? ` · numbers from ${post.metricsSource.toLowerCase()}, ${fmtDate(post.lastSynced)}` : ""}
          </>
        }
        actions={
          <>
            <form action={archiveThis}><button className="btn ghost">Archive</button></form>
            <a className="btn" href={post.url} target="_blank" rel="noreferrer">Open in Notion</a>
            {post.linkedinUrl ? <a className="btn" href={post.linkedinUrl} target="_blank" rel="noreferrer">Open on LinkedIn</a> : null}
            <Link className="btn primary" href={`/write?id=${post.id}`}><Icon.pen /> Edit text</Link>
          </>
        }
      />

      <div className="stats-row">
        <StatCard label="Rank" value={post.rank ? `#${post.rank}` : "–"} sub={total ? `of ${total} ranked posts` : "Not ranked yet"} />
        <StatCard label="Performance score" value={fmt(post.performanceScore)} sub="0–100, against your own posts" />
        <StatCard label="Impressions" value={fmt(m.impressions)} delta={vs.length ? { pct: vsOf("impressions") } : undefined} sub={m.membersReached ? `${fmt(m.membersReached)} people reached` : undefined} />
        <StatCard label="Engagement rate" value={post.engagementRate != null ? `${post.engagementRate}%` : "–"} delta={vs.length ? { pct: vsOf("er") } : undefined} sub={`${fmt(totalEngagements(m) || null)} engagements`} />
      </div>
      {vs.length ? <p className="small faint" style={{ margin: "-6px 0 16px" }}>Arrows compare this post with your typical post.</p> : null}

      <div className="split">
        <div className="stack" style={{ gap: "var(--gap)" }}>
          <Card title="Post" description={post.text ? `${post.text.trim().length.toLocaleString("en-GB")} characters` : undefined}>
            {post.text ? (
              <div className="preview">{post.text}</div>
            ) : (
              <p className="small muted">
                No text yet. <Link href={`/write?id=${post.id}`}>Paste it in</Link> so the writing assistant can learn from this post.
              </p>
            )}
          </Card>
          {vs.length ? (
            <Card
              title="Versus your typical post"
              description="Against the median of your other posts. Hover a bar for the raw numbers."
              takeaway={
                <>
                  {best && best.pct > 0 ? <><b>Strongest: {best.label.toLowerCase()}</b> (+{best.pct}%). </> : null}
                  {worst && worst.pct < 0 ? <><b>Weakest: {worst.label.toLowerCase()}</b> ({worst.pct}%). Fix that first next time.</> : <>No weak spots against your typical post.</>}
                </>
              }
            >
              <Diverging rows={vs} />
            </Card>
          ) : null}
          <Card title="Engagement mix" description="What people did after seeing this post.">
            {mix.length ? (
              <Bars rows={mix.map(([k, v]) => ({ key: k, count: 0, value: v, tip: `${v.toLocaleString("en-GB")} ${k.toLowerCase()}` }))} max={mixMax} hideCount />
            ) : (
              <p className="small faint">No numbers yet. Add them on the right or import this post&rsquo;s export.</p>
            )}
          </Card>
          <Card title="Impressions over time" description={`${snaps.length} snapshot${snaps.length === 1 ? "" : "s"} from sync, imports and manual updates.`}>
            <AreaChart points={snaps.map((s) => ({ x: s.capturedAt.slice(0, 10), y: s.impressions }))} label="Impressions per snapshot" unit="impressions" />
          </Card>
          {post.aiNotes ? (
            <Card title="Assistant notes" action={post.aiScore != null ? <Chip>AI score {post.aiScore}</Chip> : null}>
              <div className="preview small">{post.aiNotes}</div>
            </Card>
          ) : null}
        </div>
        <div className="stack" style={{ gap: "var(--gap)" }}>
          <RatingPanel post={post} />
          <StatusPanel post={post} />
          <MetricsForm post={post} />
        </div>
      </div>
    </>
  );
}
