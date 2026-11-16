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

export function Bars({ rows, value, label }: { rows: { key: string; count: number }[]; value: (r: never) => number; label: (r: never) => string }) {
  const vals = rows.map((r) => value(r as never));
  const max = Math.max(1, ...vals);
  return (
    <div>
      {rows.map((r, i) => (
        <div className="bar-row" key={r.key}>
          <div className="clamp" title={r.key}>
            {r.key} <span className="faint">· {r.count}</span>
          </div>
          <div className="bar-track">
            <div className="bar" style={{ width: `${(vals[i] / max) * 100}%` }} />
          </div>
          <div className="num" style={{ textAlign: "right" }}>
            {label(r as never)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Small dependency-free line chart. */
export function LineChart({ points, height = 140, label }: { points: { x: string; y: number | null }[]; height?: number; label?: string }) {
  const pts = points.filter((p) => p.y != null) as { x: string; y: number }[];
  if (pts.length < 2) return <div className="empty small">Not enough data for a chart yet.</div>;
  const W = 600;
  const pad = { l: 40, r: 8, t: 10, b: 22 };
  const max = Math.max(...pts.map((p) => p.y)) || 1;
  const sx = (i: number) => pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const area = `${d} L${sx(pts.length - 1)},${height - pad.b} L${sx(0)},${height - pad.b} Z`;
  const ticks = [0, Math.round(pts.length / 2), pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={label}>
      <line x1={pad.l} x2={W - pad.r} y1={sy(max)} y2={sy(max)} stroke="var(--line)" />
      <line x1={pad.l} x2={W - pad.r} y1={sy(0)} y2={sy(0)} stroke="var(--line)" />
      <text x={pad.l - 6} y={sy(max) + 4} textAnchor="end">{fmt(max, { notation: "compact" })}</text>
      <text x={pad.l - 6} y={sy(0) + 4} textAnchor="end">0</text>
      <path d={area} fill="var(--accent)" opacity="0.1" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {ticks.map((i) => (
        <text key={i} x={sx(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}>
          {pts[i].x.slice(5)}
        </text>
      ))}
    </svg>
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
