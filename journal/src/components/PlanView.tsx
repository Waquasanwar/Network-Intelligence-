"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { publishBriefAction } from "@/app/actions";
import { isClosed, loggedAt, type Entry, type Project, type Ref } from "@/lib/schema";
import { addDays, chaseStats, monthGrid, priorities, toDate, weekDays, weeklyBrief, ymd } from "@/lib/planning";
import { localDate } from "@/lib/insights";
import { todayLocal } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { Tabs } from "./InsightsTabs";
import { ChaseButton, EmptyRow, Kpi, Section, WorkRow } from "./work";
import { Chip, PageHeader, TypeDot } from "./ui";

type View = "day" | "week" | "month";

const fmt = (d: string, o: Intl.DateTimeFormatOptions) => toDate(d).toLocaleDateString("en-GB", o);

function PriorityList({ entries, projects, people, today, limit = 10 }: { entries: Entry[]; projects: Project[]; people: Ref[]; today: string; limit?: number }) {
  const list = priorities(entries, projects, today).slice(0, limit);
  if (!list.length) return <EmptyRow>Nothing pressing. A good week to get ahead.</EmptyRow>;
  return (
    <ol className="divide-y divide-line">
      {list.map((p, i) => (
        <li key={p.entry.id} className="flex items-center gap-3 px-3 py-2.5">
          <span className={`num grid size-7 shrink-0 place-items-center rounded-md text-xs ${i < 3 ? "bg-accent-soft text-accent-fg ring-1 ring-accent/30" : "bg-surface-2 text-ink-3"}`}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <Link href={`/entry/${p.entry.id}`} className="flex items-center gap-2 text-sm text-ink hover:text-accent-fg">
              <TypeDot type={p.entry.type} />
              <span className="truncate">{p.entry.title}</span>
            </Link>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.reasons.map((r) => (
                <Chip key={r} tone={/Overdue|Stuck|Urgent/.test(r) ? "danger" : /Chase|Due today|at risk/.test(r) ? "warn" : "plain"}>
                  {r}
                </Chip>
              ))}
              {projects.filter((pr) => p.entry.projectIds.includes(pr.id) && !p.reasons.some((r) => r.startsWith(pr.name))).map((pr) => (
                <Chip key={pr.id} tone="accent">{pr.name}</Chip>
              ))}
            </div>
          </div>
          {(p.entry.waitingOn || p.entry.status === "Waiting on others") && <ChaseButton entry={p.entry} compact />}
        </li>
      ))}
    </ol>
  );
}

function DayView({ entries, projects, people, today }: { entries: Entry[]; projects: Project[]; people: Ref[]; today: string }) {
  const doToday = entries
    .filter((e) => !isClosed(e) && e.due && e.due.slice(0, 10) <= today)
    .sort((a, b) => a.due!.localeCompare(b.due!));
  const follow = entries.filter((e) => !isClosed(e) && e.followUp && e.followUp.slice(0, 10) <= today);
  const chase = chaseStats(entries, today).dueNow;
  const soon = entries
    .filter((e) => !isClosed(e) && e.due && e.due.slice(0, 10) > today && e.due.slice(0, 10) <= addDays(today, 3))
    .sort((a, b) => a.due!.localeCompare(b.due!));
  const logged = entries.filter((e) => localDate(loggedAt(e)) === today);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Kpi label="Due or overdue" value={doToday.length} tone={doToday.length ? "danger" : "ok"} />
        <Kpi label="To chase" value={chase.length} tone={chase.length ? "warn" : "ok"} />
        <Kpi label="Follow-ups" value={follow.length} />
        <Kpi label="Logged today" value={logged.length} tone="accent" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Do today" sub="Due today or already overdue">
          <div className="divide-y divide-line">
            {doToday.map((e) => <WorkRow key={e.id} entry={e} today={today} projects={projects} people={people} />)}
            {!doToday.length && <EmptyRow>Nothing due today.</EmptyRow>}
          </div>
        </Section>
        <Section title="Chase today" sub="Waiting and quiet for 3+ working days">
          <div className="divide-y divide-line">
            {chase.slice(0, 8).map((e) => <WorkRow key={e.id} entry={e} today={today} projects={projects} people={people} right={<ChaseButton entry={e} compact />} />)}
            {!chase.length && <EmptyRow>No chasing needed today.</EmptyRow>}
          </div>
        </Section>
        <Section title="Follow up" sub="Follow-up dates that have arrived">
          <div className="divide-y divide-line">
            {follow.map((e) => <WorkRow key={e.id} entry={e} today={today} projects={projects} people={people} right={<ChaseButton entry={e} compact />} />)}
            {!follow.length && <EmptyRow>No follow-ups due.</EmptyRow>}
          </div>
        </Section>
        <Section title="Coming up" sub="Due in the next three days">
          <div className="divide-y divide-line">
            {soon.map((e) => <WorkRow key={e.id} entry={e} today={today} projects={projects} people={people} />)}
            {!soon.length && <EmptyRow>Clear for the next three days.</EmptyRow>}
          </div>
        </Section>
      </div>
    </div>
  );
}

function WeekView({ entries, projects, people, today }: { entries: Entry[]; projects: Project[]; people: Ref[]; today: string }) {
  const days = weekDays(today);
  const brief = useMemo(() => weeklyBrief(entries, projects, people, today), [entries, projects, people, today]);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const isMonday = toDate(today).getDay() === 1;
  const closedThisWeek = entries.filter((e) => isClosed(e) && e.lastEdited.slice(0, 10) >= days[0]).length;

  return (
    <div className="space-y-4">
      <div className={`card flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${isMonday ? "flagged" : ""}`}>
        <div>
          <p className="text-sm font-semibold text-ink">{isMonday ? "Monday brief" : "This week's brief"} · {fmt(days[0], { day: "numeric", month: "short" })} – {fmt(days[6], { day: "numeric", month: "short" })}</p>
          <p className="text-xs text-ink-3">Arrives in Notion automatically every Monday at 9am. Save a copy now if you want it today.</p>
        </div>
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await publishBriefAction();
              setSaved(r.ok ? (r.data?.url ?? "#") : r.error);
            })
          }
        >
          {pending ? "Saving…" : "Save brief to Notion"}
        </button>
        {saved && (
          <p className="w-full text-xs text-ok">
            {saved.startsWith("http") ? <a href={saved} target="_blank" rel="noreferrer" className="underline">Saved. Open in Notion ↗</a> : saved === "#" ? "Saved (demo mode keeps it in memory)." : saved}
          </p>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const due = entries.filter((e) => e.due && e.due.slice(0, 10) === d && !isClosed(e));
          const logged = entries.filter((e) => localDate(loggedAt(e)) === d).length;
          const isToday = d === today;
          return (
            <div key={d} className={`card min-h-28 p-2 ${isToday ? "ring-1 ring-accent/60" : ""} ${d < today ? "opacity-70" : ""}`}>
              <div className="flex items-baseline justify-between">
                <span className={`text-xs font-medium ${isToday ? "text-accent-fg" : "text-ink-2"}`}>{fmt(d, { weekday: "short" })}</span>
                <span className="num text-[0.68rem] text-ink-3">{fmt(d, { day: "numeric" })}</span>
              </div>
              <div className="mt-1.5 space-y-1">
                {due.slice(0, 3).map((e) => (
                  <Link key={e.id} href={`/entry/${e.id}`} className="flex items-center gap-1 truncate rounded bg-surface-2 px-1.5 py-0.5 text-[0.7rem] text-ink-2 hover:text-ink" title={e.title}>
                    <TypeDot type={e.type} />
                    <span className="truncate">{e.title}</span>
                  </Link>
                ))}
                {due.length > 3 && <span className="text-[0.68rem] text-ink-3">+{due.length - 3} more</span>}
              </div>
              {logged > 0 && <div className="num mt-1 text-[0.65rem] text-ink-3">{logged} logged</div>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Priorities this week" sub={`Ranked by urgency, overdue, chasing, impact and project risk · ${closedThisWeek} closed so far`}>
          <PriorityList entries={entries} projects={projects} people={people} today={today} />
        </Section>
        <div className="space-y-4">
          {brief.sections.slice(3).map((s) => (
            <Section key={s.heading} title={s.heading}>
              {s.items.length ? (
                <ul className="divide-y divide-line">
                  {s.items.slice(0, 6).map((i) => (
                    <li key={i} className="px-4 py-2 text-sm text-ink-2">{i}</li>
                  ))}
                </ul>
              ) : (
                <EmptyRow>Nothing here.</EmptyRow>
              )}
            </Section>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthView({ entries, today }: { entries: Entry[]; today: string }) {
  const [anchor, setAnchor] = useState(today);
  const grid = monthGrid(anchor);
  const month = toDate(anchor).getMonth();
  const monthStart = ymd(new Date(toDate(anchor).getFullYear(), month, 1, 12));
  const monthEnd = ymd(new Date(toDate(anchor).getFullYear(), month + 1, 0, 12));
  const inMonth = (d: string) => d >= monthStart && d <= monthEnd;
  const logged = entries.filter((e) => inMonth(localDate(loggedAt(e))));
  const closed = entries.filter((e) => isClosed(e) && inMonth(e.lastEdited.slice(0, 10)));
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(localDate(loggedAt(e)), (counts.get(localDate(loggedAt(e))) ?? 0) + 1);
  const max = Math.max(1, ...grid.map((d) => counts.get(d) ?? 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{fmt(anchor, { month: "long", year: "numeric" })}</h2>
        <div className="flex gap-1.5">
          <button className="btn px-2.5" onClick={() => setAnchor(addDays(monthStart, -1))} aria-label="Previous month">←</button>
          <button className="btn" onClick={() => setAnchor(today)}>This month</button>
          <button className="btn px-2.5" onClick={() => setAnchor(addDays(monthEnd, 1))} aria-label="Next month">→</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Kpi label="Logged" value={logged.length} />
        <Kpi label="Closed" value={closed.length} tone="ok" />
        <Kpi label="Decisions" value={logged.filter((e) => e.type === "Decision").length} tone="accent" />
        <Kpi label="New asks" value={logged.filter((e) => ["Request", "Purchase Request", "Service Request", "Question"].includes(e.type ?? "")).length} />
      </div>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line text-center text-[0.7rem] font-medium tracking-wide text-ink-3 uppercase">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-line">
          {grid.map((d) => {
            const due = entries.filter((e) => e.due && e.due.slice(0, 10) === d && !isClosed(e));
            const c = counts.get(d) ?? 0;
            return (
              <div key={d} className={`min-h-24 bg-surface p-1.5 ${inMonth(d) ? "" : "opacity-40"}`} style={c ? { backgroundImage: `linear-gradient(color-mix(in oklab, var(--accent) ${Math.round((c / max) * 22)}%, transparent), color-mix(in oklab, var(--accent) ${Math.round((c / max) * 22)}%, transparent))` } : undefined}>
                <div className="flex items-center justify-between">
                  <span className={`num text-xs ${d === today ? "rounded bg-accent px-1 text-accent-ink" : "text-ink-2"}`}>{fmt(d, { day: "numeric" })}</span>
                  {c > 0 && <span className="num text-[0.65rem] text-ink-3">{c}</span>}
                </div>
                <div className="mt-1 space-y-0.5">
                  {due.slice(0, 2).map((e) => (
                    <Link key={e.id} href={`/entry/${e.id}`} className="flex items-center gap-1 truncate text-[0.68rem] text-ink-2 hover:text-ink" title={e.title}>
                      <TypeDot type={e.type} />
                      <span className="truncate">{e.title}</span>
                    </Link>
                  ))}
                  {due.length > 2 && <span className="text-[0.65rem] text-ink-3">+{due.length - 2}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-ink-3">Shading shows how much you logged each day; items listed are due that day.</p>
    </div>
  );
}

export function PlanView({ entries, projects, people }: { entries: Entry[]; projects: Project[]; people: Ref[] }) {
  const params = useSearchParams();
  const mounted = useMounted();
  const [view, setView] = useState<View>((params.get("view") as View) || "week");
  const today = todayLocal();
  return (
    <div>
      <PageHeader
        title="Plan"
        subtitle={mounted ? fmt(today, { weekday: "long", day: "numeric", month: "long" }) : " "}
        actions={<Tabs label="Plan view" value={view} onChange={setView} options={[["day", "Day"], ["week", "Week"], ["month", "Month"]]} />}
      />
      {mounted && view === "day" && <DayView entries={entries} projects={projects} people={people} today={today} />}
      {mounted && view === "week" && <WeekView entries={entries} projects={projects} people={people} today={today} />}
      {mounted && view === "month" && <MonthView entries={entries} today={today} />}
    </div>
  );
}

export { PriorityList };
