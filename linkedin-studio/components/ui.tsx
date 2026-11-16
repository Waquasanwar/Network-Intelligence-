import Link from "next/link";
import { tierFor } from "@/lib/scoring";
import type { Post } from "@/lib/types";

export const fmt = (v: number | null | undefined, opts: Intl.NumberFormatOptions = {}) =>
  v == null || !Number.isFinite(v) ? "–" : v.toLocaleString("en-GB", { maximumFractionDigits: 1, ...opts });

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–";

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function TierBadge({ post, total }: { post: Post; total: number }) {
  const tier = tierFor(post.performanceScore, post.rank, total);
  if (!tier) return null;
  return <span className={`badge ${tier.split(" ")[0]}`}>{tier}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

/** Horizontal bars for one measure. The leader is drawn in the second series hue and every bar has a hover tooltip. */
export function Bars({ rows, max = 100, hideCount = false }: { rows: { key: string; count: number; value: number; tip: string }[]; max?: number; hideCount?: boolean }) {
  const top = Math.max(max, ...rows.map((r) => r.value)) || 1;
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div className="bar-row" key={r.key} data-tip={r.tip}>
          <div className="name" title={r.key}>
            {r.key} {hideCount ? null : <span className="faint">· {r.count}</span>}
          </div>
          <div className="bar-track">
            <div className={`bar ${i === 0 && !hideCount ? "lead" : ""}`} style={{ width: `${(r.value / top) * 100}%` }} />
          </div>
          <div className="val">{r.value.toLocaleString("en-GB")}</div>
        </div>
      ))}
    </div>
  );
}

export function SetupNeeded() {
  return (
    <div className="panel stack" style={{ maxWidth: 640 }}>
      <h1>Connect Notion to get started</h1>
      <p className="muted">LinkedIn Studio keeps every draft, rating and metric in your Notion workspace. It needs two things:</p>
      <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
        <li>
          Create an internal integration at <a href="https://www.notion.so/my-integrations">notion.so/my-integrations</a> and put its secret in{" "}
          <code>NOTION_TOKEN</code>.
        </li>
        <li>
          Make a page in Notion (e.g. &ldquo;LinkedIn Studio&rdquo;), share it with the integration, and put its ID in <code>NOTION_PARENT_PAGE_ID</code>.
        </li>
        <li>
          Run <code>npm run setup:notion</code>. It creates the databases and saves their IDs to <code>.env</code>. Restart the app.
        </li>
      </ol>
      <p className="small">
        <Link href="/connect">See everything you can connect →</Link>
      </p>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
