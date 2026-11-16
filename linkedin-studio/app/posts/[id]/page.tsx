import Link from "next/link";
import { notFound } from "next/navigation";
import { archive } from "@/app/actions";
import { MetricsForm, RatingPanel, StatusPanel } from "@/components/post-panels";
import { fmt, fmtDate, Kpi, LineChart, SetupNeeded, StatusBadge, TierBadge } from "@/components/ui";
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

  return (
    <>
      <div className="page-head">
        <div style={{ maxWidth: 720 }}>
          <div className="row small" style={{ marginBottom: 6 }}>
            <Link href="/posts">← Posts</Link>
            <StatusBadge status={post.status} />
            <TierBadge post={post} total={total} />
          </div>
          <h1>{post.title}</h1>
          <p className="muted small">
            {[post.pillar, post.format, post.hookType].filter(Boolean).join(" · ") || "No pillar or format yet"} · Published {fmtDate(post.publishedAt)}
            {post.metricsSource ? ` · numbers from ${post.metricsSource.toLowerCase()}, ${fmtDate(post.lastSynced)}` : ""}
          </p>
        </div>
        <div className="row">
          <Link className="btn" href={`/write?id=${post.id}`}>Edit text</Link>
          {post.linkedinUrl ? <a className="btn" href={post.linkedinUrl} target="_blank" rel="noreferrer">Open on LinkedIn</a> : null}
          <a className="btn" href={post.url} target="_blank" rel="noreferrer">Open in Notion</a>
          <form action={archiveThis}><button className="btn ghost">Archive</button></form>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Kpi label="Rank" value={post.rank ? `#${post.rank}` : "–"} sub={total ? `of ${total} ranked posts` : undefined} />
        <Kpi label="Performance score" value={fmt(post.performanceScore)} sub="0–100 vs your own posts" />
        <Kpi label="Impressions" value={fmt(m.impressions)} sub={m.membersReached ? `${fmt(m.membersReached)} people reached` : undefined} />
        <Kpi label="Engagement rate" value={post.engagementRate != null ? `${post.engagementRate}%` : "–"} sub={`${fmt(totalEngagements(m) || null)} engagements`} />
      </div>

      <div className="split">
        <div className="stack">
          <div className="panel">
            <h2>Post</h2>
            {post.text ? (
              <div className="preview">{post.text}</div>
            ) : (
              <p className="small muted">
                No text yet. <Link href={`/write?id=${post.id}`}>Paste it in</Link> so the writing assistant can learn from this post.
              </p>
            )}
          </div>
          <div className="panel">
            <h2>Breakdown</h2>
            <div className="grid g4">
              {(
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
              ).map(([label, v]) => (
                <div key={label} className="kpi">
                  <div className="label">{label}</div>
                  <div className="value" style={{ fontSize: 20 }}>{fmt(v)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2>Impressions over time</h2>
            <LineChart points={snaps.map((s) => ({ x: s.capturedAt.slice(0, 10), y: s.impressions }))} label="Impressions per snapshot" />
            <p className="small faint">{snaps.length} snapshot{snaps.length === 1 ? "" : "s"} from sync, imports and manual updates.</p>
          </div>
          {post.aiNotes ? (
            <div className="panel">
              <h2>Assistant notes {post.aiScore != null ? <span className="badge">AI score {post.aiScore}</span> : null}</h2>
              <div className="preview small">{post.aiNotes}</div>
            </div>
          ) : null}
        </div>
        <div className="stack">
          <RatingPanel post={post} />
          <StatusPanel post={post} />
          <MetricsForm post={post} />
        </div>
      </div>
    </>
  );
}
