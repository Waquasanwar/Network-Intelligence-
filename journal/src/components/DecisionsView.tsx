"use client";

import Link from "next/link";
import { useState } from "react";
import { loggedAt, type Entry, type Ref } from "@/lib/schema";
import { daysBetween, shortDate } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { Chip, Empty, PageHeader } from "./ui";

export function DecisionsView({ entries, people, projects }: { entries: Entry[]; people: Ref[]; projects: Ref[] }) {
  const mounted = useMounted();
  const [show, setShow] = useState<"all" | "revisit">("all");
  const decisions = entries.filter((e) => e.type === "Decision").sort((a, b) => loggedAt(b).localeCompare(loggedAt(a)));
  const revisit = (e: Entry) => !e.outcome && daysBetween(loggedAt(e)) >= 30;
  const list = show === "revisit" ? decisions.filter(revisit) : decisions;
  const nm = (ids: string[], refs: Ref[]) => ids.map((id) => refs.find((r) => r.id === id)?.name).filter(Boolean) as string[];

  return (
    <div>
      <PageHeader
        title="Decision log"
        subtitle="What you decided, why, and how it turned out."
        actions={
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
            {(["all", "revisit"] as const).map((k) => (
              <button key={k} aria-pressed={show === k} onClick={() => setShow(k)} className={`rounded-md px-2.5 py-1 ${show === k ? "bg-accent text-accent-ink" : "text-ink-2"}`}>
                {k === "all" ? `All (${decisions.length})` : `To revisit (${mounted ? decisions.filter(revisit).length : "…"})`}
              </button>
            ))}
          </div>
        }
      />
      {!list.length ? (
        <Empty>{show === "revisit" ? "No decisions waiting on an outcome." : "No decisions logged yet. Start a capture with d: to log one."}</Empty>
      ) : (
        <ol className="relative space-y-3 border-l border-line pl-5">
          {list.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute top-4 -left-[1.6rem] size-2.5 rounded-full border-2 border-bg bg-violet-500" aria-hidden />
              <Link href={`/entry/${e.id}`} className="card block p-4 hover:border-accent">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  <span suppressHydrationWarning>{mounted ? shortDate(loggedAt(e).slice(0, 10)) : ""}</span>
                  {e.number && <span>DEC-{e.number}</span>}
                  {e.impact && <Chip tone={e.impact === "High" ? "danger" : "plain"}>{e.impact} impact</Chip>}
                  {nm(e.projectIds, projects).map((p) => (
                    <Chip key={p} tone="accent">{p}</Chip>
                  ))}
                  {nm(e.peopleIds, people).map((p) => (
                    <Chip key={p}>@{p}</Chip>
                  ))}
                  {mounted && revisit(e) && <Chip tone="warn">Record the outcome</Chip>}
                </div>
                <h3 className="mt-1.5 font-medium leading-snug">{e.title}</h3>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-ink-3">Why</dt>
                    <dd className="text-ink-2">{e.rationale || <span className="text-ink-3">Not recorded</span>}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">Alternatives</dt>
                    <dd className="text-ink-2">{e.alternatives || <span className="text-ink-3">Not recorded</span>}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">Outcome</dt>
                    <dd className="text-ink-2">{e.outcome || <span className="text-ink-3">Not yet</span>}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
