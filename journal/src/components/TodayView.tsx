"use client";

import Link from "next/link";
import { isClosed, isOverdue, loggedAt, type Entry, type Project, type Ref } from "@/lib/schema";
import { chaseStats } from "@/lib/planning";
import { PriorityList } from "./PlanView";
import { Section } from "./work";
import { localDate } from "@/lib/insights";
import { todayLocal } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { CaptureBox } from "./CaptureBox";
import { EntryCard } from "./EntryCard";
import { Empty, Stat } from "./ui";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function TodayView({ entries, people, projects, tags }: { entries: Entry[]; people: Ref[]; projects: Project[]; tags: string[] }) {
  const mounted = useMounted();
  const today = todayLocal();

  const todays = mounted ? entries.filter((e) => localDate(loggedAt(e)) === today) : [];
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
      <div>
        <h1 className="text-metal text-[2rem] leading-tight" suppressHydrationWarning>
          {mounted ? (
            <>
              {greeting()}
            </>
          ) : (
            "Hello"
          )}
        </h1>
        <p className="mt-0.5 text-sm text-ink-3" suppressHydrationWarning>
          {mounted ? new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) : " "}
        </p>
      </div>

      <CaptureBox people={people} projects={projects} tags={tags} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Link href="/review"><Stat label="To review" value={inbox.length} tone={inbox.length ? "accent" : undefined} /></Link>
        <Stat label="Captured today" value={todays.length} />
        <Link href="/plan?view=day"><Stat label="To chase" value={chaseCount} tone={chaseCount ? "accent" : undefined} /></Link>
        <Link href="/timeline?filter=overdue"><Stat label="Overdue" value={overdue} tone={overdue ? "danger" : undefined} /></Link>
      </div>

      {mounted && (
        <Section
          title={isMonday ? "Your Monday brief" : "This week's focus"}
          sub={isMonday ? "The week's priorities, ranked. Also saved to Notion at 9am." : "Top priorities this week, ranked by urgency, chasing, impact and project risk"}
          action={<Link href="/plan?view=week" className="text-xs text-accent-fg hover:underline">Full week →</Link>}
          className={isMonday ? "glow-focus" : ""}
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
