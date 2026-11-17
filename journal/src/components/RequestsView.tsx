"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAction } from "@/app/actions";
import { STATUSES, isOverdue, loggedAt, type Entry, type Ref, type Status } from "@/lib/schema";
import { daysBetween, shortDate, todayLocal } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { Chip, PageHeader } from "./ui";
import { ChaseButton } from "./work";

const COLUMNS: Status[] = ["Open", "In progress", "Waiting on others", "Done"];

function RequestCard({ entry, people }: { entry: Entry; people: Ref[] }) {
  const router = useRouter();
  const mounted = useMounted();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(entry.status === "Inbox" || !entry.status ? "Open" : entry.status);
  const today = todayLocal();
  const ppl = entry.peopleIds.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean);
  const overdue = mounted && isOverdue(entry, today);

  function move(next: Status) {
    setStatus(next);
    start(async () => {
      await updateAction(entry.id, { status: next });
      router.refresh();
    });
  }

  return (
    <div className={`card p-3 ${pending ? "opacity-60" : ""}`}>
      <Link href={`/entry/${entry.id}`} className="block text-sm leading-snug hover:text-accent-fg">
        {entry.title}
      </Link>
      <div className="mt-2 flex flex-wrap gap-1">
        {entry.direction && <Chip tone={entry.direction.startsWith("Incoming") ? "accent" : "plain"}>{entry.direction.startsWith("Incoming") ? "← to me" : entry.direction.startsWith("Upward") ? "↑ management" : entry.direction.startsWith("Outgoing") ? "→ from me" : "internal"}</Chip>}
        {entry.waitingOn && <Chip tone="warn">Waiting: {entry.waitingOn}</Chip>}
        {entry.chaseCount > 0 && <Chip>chased {entry.chaseCount}×</Chip>}
        {ppl.map((p) => (
          <Chip key={p}>@{p}</Chip>
        ))}
        {entry.priority?.startsWith("P1") && <Chip tone="danger">Urgent</Chip>}
        {entry.due && mounted && <Chip tone={overdue ? "danger" : "plain"}>{overdue ? "overdue " : "due "}{shortDate(entry.due, today)}</Chip>}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[0.7rem] text-ink-3" suppressHydrationWarning>
          {mounted && status !== "Done" && status !== "Dropped" ? `${daysBetween(loggedAt(entry))}d open` : ""}
        </span>
        <span className="flex items-center gap-1.5">
        {status !== "Done" && status !== "Dropped" && <ChaseButton entry={entry} compact />}
        <select aria-label="Status" className="rounded-md bg-surface-2 px-1.5 py-1 text-xs text-ink-2" value={status} onChange={(e) => move(e.target.value as Status)}>
          {STATUSES.filter((s) => s !== "Inbox").map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        </span>
      </div>
    </div>
  );
}

export function RequestsView({ entries, people }: { entries: Entry[]; people: Ref[] }) {
  const [dir, setDir] = useState<"all" | "in" | "out" | "up">("all");
  const [who, setWho] = useState("");
  const requests = useMemo(
    () =>
      entries
        .filter((e) => e.type === "Request" && e.status !== "Dropped")
        .filter((e) => dir === "all" || (dir === "in" ? e.direction?.startsWith("Incoming") : dir === "up" ? e.direction?.startsWith("Upward") || e.waitingOn === "Management" : e.direction?.startsWith("Outgoing")))
        .filter((e) => !who || e.peopleIds.includes(who))
        .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")),
    [entries, dir, who],
  );
  const column = (s: Status) =>
    requests.filter((e) => (s === "Open" ? !e.status || e.status === "Open" || e.status === "Inbox" : e.status === s)).slice(0, s === "Done" ? 12 : undefined);

  return (
    <div>
      <PageHeader
        title="Requests"
        subtitle="What people asked of you, and what you are waiting on from them."
        actions={
          <div className="flex gap-2">
            <select className="field w-auto" value={dir} onChange={(e) => setDir(e.target.value as typeof dir)} aria-label="Direction">
              <option value="all">Both directions</option>
              <option value="in">Asked of me</option>
              <option value="out">I asked</option>
              <option value="up">To management</option>
            </select>
            <select className="field w-auto" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Person">
              <option value="">Anyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {COLUMNS.map((s) => {
          const list = column(s);
          return (
            <section key={s} className="w-72 shrink-0 snap-start md:w-auto">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-2">
                {s} <span className="font-normal text-ink-3">{list.length}</span>
              </h2>
              <div className="space-y-2">
                {list.map((e) => (
                  <RequestCard key={e.id} entry={e} people={people} />
                ))}
                {!list.length && <div className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-ink-3">Nothing here</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
