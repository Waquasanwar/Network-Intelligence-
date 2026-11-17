"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Entry, Ref } from "@/lib/schema";
import { computeInsights, filterPeriod } from "@/lib/insights";
import { useMounted } from "@/lib/use-mounted";
import { Stat } from "./ui";

const PERIODS = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
  { label: "All time", days: null },
] as const;

const axis = { stroke: "var(--ink-3)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" },
  labelStyle: { color: "var(--ink)", fontWeight: 600 },
  itemStyle: { color: "var(--ink-2)" },
  cursor: { fill: "var(--surface-2)" },
};

// Legend keeps stack order and plain ink text; the swatch carries identity.
const legendProps = {
  iconType: "circle" as const,
  iconSize: 8,
  itemSorter: null,
  wrapperStyle: { fontSize: 11 },
  formatter: (value: string) => <span style={{ color: "var(--ink-2)" }}>{value}</span>,
};

// Energy is ordinal (one hue, strong to light); sentiment is diverging (two hues, grey midpoint).
const ENERGY_COLOR: Record<string, string> = { High: "var(--seq-strong)", OK: "var(--seq-mid)", Low: "var(--seq-light)", "Not set": "var(--line)" };
const SENTIMENT_COLOR: Record<string, string> = { Positive: "var(--pos)", Neutral: "var(--mid)", Negative: "var(--neg)", "Not set": "var(--line)" };

function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      <h2 className="font-display text-[1.05rem]">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Ranked({ rows, href }: { rows: Array<{ name: string; count: number }>; href?: (name: string) => string | undefined }) {
  if (!rows.length) return <p className="text-xs text-ink-3">Nothing yet.</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const link = href?.(r.name);
        const label = <span className="truncate text-ink">{r.name}</span>;
        return (
          <li key={r.name} className="grid grid-cols-[minmax(0,8rem)_1fr_2rem] items-center gap-2 text-sm">
            {link ? <Link href={link} className="truncate hover:text-accent-fg">{label}</Link> : label}
            <span className="h-2 rounded-full bg-surface-2">
              <span className="block h-2 rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: "var(--series-1)" }} />
            </span>
            <span className="text-right text-xs tabular-nums text-ink-2">{r.count}</span>
          </li>
        );
      })}
    </ul>
  );
}

const order = (series: string[], keys: string[]) => keys.filter((k) => series.includes(k));

export function PatternsView({ entries, people, projects }: { entries: Entry[]; people: Ref[]; projects: Ref[] }) {
  const mounted = useMounted();
  const [days, setDays] = useState<number | null>(90);
  const ins = useMemo(() => (mounted ? computeInsights(filterPeriod(entries, days), people, projects) : null), [mounted, entries, days, people, projects]);

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-3">When you capture, what, with whom, and how it feels.</p>
      {
        <div role="group" aria-label="Period" className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
          {PERIODS.map((p) => (
            <button key={p.label} aria-pressed={days === p.days} onClick={() => setDays(p.days)} className={`rounded-md px-2.5 py-1 ${days === p.days ? "bg-accent text-accent-ink" : "text-ink-2"}`}>
              {p.label}
            </button>
          ))}
        </div>
      }
    </div>
  );

  if (!ins) return header;
  if (!ins.total)
    return (
      <div>
        {header}
        <div className="card p-8 text-center text-sm text-ink-3">No entries in this period yet.</div>
      </div>
    );

  const weekRows = ins.perWeek.rows.map((r) => ({
    week: new Date(`${r.week}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    Entries: Object.entries(r).reduce((s, [k, v]) => (k === "week" ? s : s + (v as number)), 0),
  }));
  const dayRows = ins.byWeekday.rows
    .map((r) => ({ day: r.day, Entries: Object.entries(r).reduce((s, [k, v]) => (k === "day" ? s : s + (v as number)), 0) }))
    .filter((r) => r.Entries > 0 || !["Sat", "Sun"].includes(r.day as string));
  const energySeries = order(ins.byTime.series, ["High", "OK", "Low", "Not set"]);
  const sentimentSeries = order(ins.sentimentByCategory.series, ["Positive", "Neutral", "Negative", "Not set"]);
  const personId = (name: string) => people.find((p) => p.name === name)?.id;
  const projectId = (name: string) => projects.find((p) => p.name === name)?.id;

  return (
    <div className="space-y-4">
      {header}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Entries" value={ins.total} />
        <Stat label="Working-day streak" value={ins.streak} tone="accent" />
        <Stat label="Avg days to close a request" value={ins.turnaround === null ? "–" : ins.turnaround.toFixed(1)} />
        <Stat label="Overdue" value={ins.overdue} tone={ins.overdue ? "danger" : undefined} />
      </div>

      {ins.observations.length > 0 && (
        <Panel title="What stands out">
          <ul className="space-y-1.5 text-sm text-ink-2">
            {ins.observations.map((o) => (
              <li key={o} className="flex gap-2">
                <span aria-hidden className="text-accent-fg">→</span>
                {o}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Entries per week" sub="How much you capture over time">
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={weekRows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="week" {...axis} interval="preserveStartEnd" />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="Entries" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="By weekday" sub="Which days carry the load">
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={dayRows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="day" {...axis} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="Entries" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Time of day and energy" sub="When you capture, and how you felt then">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={ins.byTime.rows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="block" {...axis} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend {...legendProps} />
                {energySeries.map((s, i) => (
                  <Bar key={s} dataKey={s} stackId="e" fill={ENERGY_COLOR[s]} stroke="var(--surface)" strokeWidth={2} radius={i === energySeries.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={44} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Sentiment by category" sub="Which areas feel good and which drain you">
          <div style={{ height: Math.max(180, ins.sentimentByCategory.rows.length * 30 + 50) }}>
            <ResponsiveContainer>
              <BarChart data={ins.sentimentByCategory.rows} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="var(--grid)" />
                <XAxis type="number" {...axis} allowDecimals={false} />
                <YAxis type="category" dataKey="category" {...axis} width={104} />
                <Tooltip {...tooltipStyle} />
                <Legend {...legendProps} />
                {sentimentSeries.map((s, i) => (
                  <Bar key={s} dataKey={s} stackId="s" fill={SENTIMENT_COLOR[s]} stroke="var(--surface)" strokeWidth={2} radius={i === sentimentSeries.length - 1 ? [0, 4, 4, 0] : 0} maxBarSize={18} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel title="What you log">
          <Ranked rows={ins.typeMix.sort((a, b) => b.count - a.count)} />
        </Panel>
        <Panel title="Top tags">
          <Ranked rows={ins.topTags} href={(n) => `/timeline?tag=${encodeURIComponent(n)}`} />
        </Panel>
        <Panel title="Most mentioned people">
          <Ranked rows={ins.topPeople} href={(n) => (personId(n) ? `/timeline?person=${personId(n)}` : undefined)} />
        </Panel>
        <Panel title="Projects getting attention">
          <Ranked rows={ins.topProjects} href={(n) => (projectId(n) ? `/timeline?project=${projectId(n)}` : undefined)} />
        </Panel>
        <Panel title="Who asks you for things">
          <Ranked rows={ins.requestsByPerson} />
        </Panel>
        <Panel title="Decisions to revisit" sub="Over a month old, no outcome yet">
          {ins.toRevisit.length ? (
            <ul className="space-y-1.5 text-sm">
              {ins.toRevisit.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Link href={`/entry/${e.id}`} className="hover:text-accent-fg">
                    {e.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-3">None. Every older decision has an outcome.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
