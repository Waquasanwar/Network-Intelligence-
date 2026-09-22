/**
 * Small time series for the widgets: twelve monthly points, built from real dates in the network
 * rather than decoration. A sparkline that does not come from the data is a lie, so everything
 * here takes actual ISO dates and counts them.
 *
 * Shared by the Next.js app and the browser prototype. No I/O.
 */

export type Point = { label: string; value: number };

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The last `n` month buckets, oldest first, ending with the month `now` falls in. */
export function monthBuckets(n = 12, now = new Date()): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push({ key: monthKey(m), label: MONTHS[m.getUTCMonth()] });
  }
  return out;
}

/** How many of these things happened in each of the last n months. */
export function monthly(dates: (string | Date | null | undefined)[], n = 12, now = new Date()): Point[] {
  const buckets = monthBuckets(n, now);
  const counts = new Map(buckets.map((b) => [b.key, 0]));
  for (const d of dates) {
    if (!d) continue;
    const dt = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) continue;
    const k = monthKey(dt);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return buckets.map((b) => ({ label: b.label, value: counts.get(b.key) ?? 0 }));
}

/** The same, but as a running total — the shape of "how big is the network" over time. */
export function cumulative(dates: (string | Date | null | undefined)[], n = 12, now = new Date()): Point[] {
  const per = monthly(dates, n, now);
  // Anything older than the window is already in the network, so the line starts where it really is.
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1), 1)).getTime();
  let running = dates.filter((d) => { if (!d) return false; const t = (typeof d === "string" ? new Date(d) : d).getTime(); return !Number.isNaN(t) && t < cutoff; }).length;
  return per.map((p) => { running += p.value; return { label: p.label, value: running }; });
}

/** Sum of a value per month — fees invoiced, say — rather than a count of events. */
export function monthlySum(rows: { date: string | Date | null | undefined; value: number }[], n = 12, now = new Date()): Point[] {
  const buckets = monthBuckets(n, now);
  const totals = new Map(buckets.map((b) => [b.key, 0]));
  for (const r of rows) {
    if (!r.date) continue;
    const dt = typeof r.date === "string" ? new Date(r.date) : r.date;
    if (Number.isNaN(dt.getTime())) continue;
    const k = monthKey(dt);
    if (totals.has(k)) totals.set(k, (totals.get(k) ?? 0) + r.value);
  }
  return buckets.map((b) => ({ label: b.label, value: totals.get(b.key) ?? 0 }));
}

/** The change over the last full month, for a stat tile's delta. Null when there is nothing to compare. */
export function lastChange(points: Point[]): { delta: number; label: string } | null {
  if (points.length < 2) return null;
  const a = points[points.length - 2].value;
  const b = points[points.length - 1].value;
  if (a === b) return null;
  return { delta: b - a, label: "vs last month" };
}

/** A compact form for a figure: 1,284 · 12.9K · 4.2M. Money keeps its symbol outside. */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
  return n.toLocaleString("en-GB");
}

/** Points as the `d` of an SVG path, fitted to a box. Flat series sit on the midline, not the floor. */
export function sparkPath(points: Point[], w: number, h: number, pad = 2): string {
  if (points.length === 0) return "";
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals); const max = Math.max(...vals);
  const span = max - min;
  const x = (i: number) => (points.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (points.length - 1));
  const y = (v: number) => (span === 0 ? h / 2 : h - pad - ((v - min) / span) * (h - pad * 2));
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
}
