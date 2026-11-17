"use client";

import Link from "next/link";
import { isClosed, isOverdue, loggedAt, type Entry, type Project, type Ref } from "@/lib/schema";
import { chaseStats, weekStartOf } from "@/lib/planning";
import { PriorityList } from "./PlanView";
import { Section } from "./work";
import { localDate } from "@/lib/insights";
import { todayLocal } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { CaptureBox } from "./CaptureBox";
import { EntryCard } from "./EntryCard";
import { Empty, Stat } from "./ui";

/** ISO week number, as printed on planners and in most offices. */
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

export function TodayView({ entries, people, projects, tags }: { entries: Entry[]; people: Ref[]; projects: Project[]; tags: string[] }) {
  const mounted = useMounted();
  const today = todayLocal();

  const todays = mounted ? entries.filter((e) => localDate(loggedAt(e)) === today) : [];
  const monday = weekStartOf(today);
  const week = {
    logged: entries.filter((e) => localDate(loggedAt(e)) >= monday).length,
    closed: entries.filter((e) => isClosed(e) && e.lastEdited.slice(0, 10) >= monday).length,
    decisions: entries.filter((e) => e.type === "Decision" && localDate(loggedAt(e)) >= monday).length,
  };
  const inbox = entries.filter((e) => !e.reviewed);
  const soon = new Date(`${today}T12:00:00`);
  soon.setDate(soon.getDate() + 3);
  const soonStr = soon.toISOString().slice(0, 10);
  const attention = mounted
    ? entries
        .filter((e) => !isClosed(e) && ((e.due && e.due.slice(0, 10) <= soonStr) || (e.followUp && e.followUp.slice(0, 10) <= today)))
        .sort((a, b) => (a.due ?? a.followUp ?? "").localeCompare(b.due ?? b.followUp ?? ""))
    : [];
  const overdue = mounted ? entries.filter((e) => isOverdue(e, today)).length : 0;
  const chaseCount = mounted ? chaseStats(entries, today).dueNow.length : 0;
  const isMonday = mounted && new Date().getDay() === 1;

  return (
    <div className="space-y-6">
      <header className="cover flex flex-wrap items-end justify-between gap-x-8 gap-y-5 px-6 py-6 pl-16 md:px-8 md:pl-[4.25rem]" suppressHydrationWarning>
        <div>
          <p className="label">{mounted ? `Week ${isoWeek(new Date())} · ${new Date().toLocaleDateString("en-GB", { weekday: "long" })}` : "Today"}</p>
          <h1 className="mt-1.5 text-[2.6rem] leading-none text-white md:text-[3rem]">{mounted ? new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : " "}</h1>
          <p className="mt-2 text-sm text-white/75">{mounted ? new Date().getFullYear() : ""} · Work journal</p>
        </div>
        {mounted && (
          <div>
          <p className="label mb-2">This week</p>
          <dl className="flex gap-4">
            {[
              ["Logged", week.logged],
              ["Closed", week.closed],
              ["Decisions", week.decisions],
            ].map(([k, v]) => (
              <div key={k as string} className="cover-stat">
                <dd className="num text-[1.6rem] leading-none text-white">{v}</dd>
                <dt className="label mt-1.5">{k}</dt>
              </div>
            ))}
          </dl>
          </div>
        )}
      </header>

      <CaptureBox people={people} projects={projects} tags={tags} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Link href="/review"><Stat label="To review" value={inbox.length} hue="#e09a12" /></Link>
        <Stat label="Captured today" value={todays.length} hue="#0f9a86" />
        <Link href="/plan?view=day"><Stat label="To chase" value={chaseCount} hue="#7b52e8" /></Link>
        <Link href="/timeline?filter=overdue"><Stat label="Overdue" value={overdue} hue={overdue ? "var(--danger)" : "var(--ok)"} /></Link>
      </div>

      {mounted && (
        <Section
          title={isMonday ? "Your Monday brief" : "This week's focus"}
          sub={isMonday ? "The week's priorities, ranked. Also saved to Notion at 9am." : "Top priorities this week, ranked by urgency, chasing, impact and project risk"}
          action={<Link href="/plan?view=week" className="text-xs text-accent-fg hover:underline">Full week →</Link>}
          className={isMonday ? "flagged" : ""}
        >
          <PriorityList entries={entries} projects={projects} people={people} today={today} limit={5} />
        </Section>
      )}

      {attention.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-2">Needs attention</h2>
          <div className="card divide-y divide-line py-1">
            {attention.slice(0, 8).map((e) => (
              <EntryCard key={e.id} entry={e} people={people} projects={projects} showDate />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-2">Today&apos;s log</h2>
        {!mounted ? null : todays.length ? (
          <div className="card divide-y divide-line py-1">
            {todays.map((e) => (
              <EntryCard key={e.id} entry={e} people={people} projects={projects} />
            ))}
          </div>
        ) : (
          <Empty>Nothing yet today. Capture the first thing on your mind; it only takes a line.</Empty>
        )}
      </section>
    </div>
  );
}
