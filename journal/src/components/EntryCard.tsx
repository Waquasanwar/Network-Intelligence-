"use client";

import Link from "next/link";
import { isOverdue, loggedAt, type Entry, type Ref } from "@/lib/schema";
import { shortDate, time, todayLocal } from "@/lib/format";
import { Chip, TypeBadge } from "./ui";

export function EntryCard({ entry, people, projects, showDate }: { entry: Entry; people: Ref[]; projects: Ref[]; showDate?: boolean }) {
  const today = todayLocal();
  const names = (ids: string[], refs: Ref[]) => ids.map((id) => refs.find((r) => r.id === id)?.name).filter(Boolean) as string[];
  const ppl = names(entry.peopleIds, people);
  const prj = names(entry.projectIds, projects);
  const overdue = isOverdue(entry, today);
  const when = loggedAt(entry);

  return (
    <Link
      href={`/entry/${entry.id}`}
      className="group flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2 focus-visible:bg-surface-2"
    >
      <div className="num w-16 shrink-0 pt-0.5 text-right text-[0.72rem] whitespace-nowrap text-ink-3" suppressHydrationWarning>
        {showDate ? shortDate(when.slice(0, 10)) : time(when)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-[0.925rem] leading-snug text-ink">{entry.title}</span>
          {!entry.reviewed && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" title="Not reviewed yet" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <TypeBadge type={entry.type} short />
          {entry.status && entry.status !== "Inbox" && entry.status !== "Done" && <Chip>{entry.status}</Chip>}
          {entry.priority && (entry.priority.startsWith("P1") || entry.priority.startsWith("P2")) && (
            <Chip tone="warn">{entry.priority.split(" ")[0]}</Chip>
          )}
          {entry.due && (
            <Chip tone={overdue ? "danger" : "plain"}>
              {overdue ? "overdue · " : "due "}
              {shortDate(entry.due, today)}
            </Chip>
          )}
          {prj.map((p) => (
            <Chip key={p} tone="accent">
              {p}
            </Chip>
          ))}
          {ppl.map((p) => (
            <Chip key={p}>@{p}</Chip>
          ))}
          {entry.tags.map((t) => (
            <span key={t} className="text-xs text-ink-3">
              #{t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
