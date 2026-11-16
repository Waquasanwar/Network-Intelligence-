import Link from "next/link";
import { Empty, fmt, fmtDate, SetupNeeded, StatusBadge, TierBadge } from "@/components/ui";
import { notionReady } from "@/lib/env";
import { listPosts } from "@/lib/notion";
import { STATUSES, type Post } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS: Record<string, [string, (a: Post, b: Post) => number]> = {
  recent: ["Newest", (a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt)],
  rank: ["Rank", (a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9)],
  impressions: ["Impressions", (a, b) => (b.metrics.impressions ?? -1) - (a.metrics.impressions ?? -1)],
  engagement: ["Engagement rate", (a, b) => (b.engagementRate ?? -1) - (a.engagementRate ?? -1)],
  gut: ["Your gut score", (a, b) => (b.ratings.gut ?? -1) - (a.ratings.gut ?? -1)],
  ai: ["AI score", (a, b) => (b.aiScore ?? -1) - (a.aiScore ?? -1)],
};

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ status?: string; sort?: string; q?: string }> }) {
  if (!notionReady()) return <SetupNeeded />;
  const { status = "all", sort = "recent", q = "" } = await searchParams;
  const all = await listPosts();
  const scoredCount = all.filter((p) => p.rank != null).length;
  let posts = status === "all" ? all.filter((p) => p.status !== "Archived") : all.filter((p) => p.status === status);
  if (q) {
    const needle = q.toLowerCase();
    posts = posts.filter((p) => `${p.title} ${p.text} ${p.tags.join(" ")} ${p.pillar ?? ""}`.toLowerCase().includes(needle));
  }
  posts = [...posts].sort((SORTS[sort] ?? SORTS.recent)[1]);
  const link = (o: Record<string, string>) => `/posts?${new URLSearchParams({ status, sort, ...(q ? { q } : {}), ...o })}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Posts</h1>
          <p className="muted">Every idea, draft and published post. Lives in your Notion &ldquo;LinkedIn Posts&rdquo; database.</p>
        </div>
        <Link className="btn primary" href="/write">New post</Link>
      </div>
      <div className="tabs">
        {["all", ...STATUSES].map((s) => (
          <Link key={s} href={link({ status: s })} className={status === s ? "active" : ""}>
            {s === "all" ? "All" : s} <span className="faint">{s === "all" ? all.filter((p) => p.status !== "Archived").length : all.filter((p) => p.status === s).length}</span>
          </Link>
        ))}
      </div>
      <form className="row" style={{ marginBottom: 14 }}>
        <input type="hidden" name="status" value={status} />
        <input name="q" defaultValue={q} placeholder="Search text, tags, pillar" style={{ maxWidth: 320 }} />
        <select name="sort" defaultValue={sort} style={{ maxWidth: 200 }}>
          {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>Sort: {label}</option>)}
        </select>
        <button className="btn">Apply</button>
      </form>
      <div className="panel" style={{ padding: 0 }}>
        {posts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Status</th>
                  <th className="num">Rank</th>
                  <th className="num">Score</th>
                  <th className="num">Impr.</th>
                  <th className="num">Eng.</th>
                  <th className="num">Gut</th>
                  <th className="num">AI</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td style={{ maxWidth: 380 }}>
                      <Link href={p.status === "Published" ? `/posts/${p.id}` : `/write?id=${p.id}`} className="clamp">{p.title || "Untitled"}</Link>
                      <div className="row small" style={{ marginTop: 2 }}>
                        <TierBadge post={p} total={scoredCount} />
                        <span className="faint">{[p.pillar, p.format, p.hookType].filter(Boolean).join(" · ")}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="num">{p.rank ?? "–"}</td>
                    <td className="num">{p.performanceScore ?? "–"}</td>
                    <td className="num">{fmt(p.metrics.impressions, { notation: "compact" })}</td>
                    <td className="num">{p.engagementRate != null ? `${p.engagementRate}%` : "–"}</td>
                    <td className="num">{p.ratings.gut ?? "–"}</td>
                    <td className="num">{p.aiScore ?? "–"}</td>
                    <td className="small muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(p.publishedAt ?? p.plannedFor ?? p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Nothing here yet.</Empty>
        )}
      </div>
    </>
  );
}
