"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAction } from "@/app/actions";
import { STAGES, isClosed, isProcurement, type Entry, type Project, type Stage } from "@/lib/schema";
import { ageDays, isStuck, procurement, quietWorkdays } from "@/lib/planning";
import { todayLocal } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";
import { Tabs } from "./InsightsTabs";
import { ChaseButton, Kpi, money, moneyShort } from "./work";
import { Chip, PageHeader, TypeDot } from "./ui";

const BOARD: Stage[] = ["Draft", "Submitted", "Awaiting approval", "Approved", "PO raised", "Ordered", "Received"];

function Card({ e, projects, today }: { e: Entry; projects: Project[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [stage, setStage] = useState<Stage>(e.stage ?? "Submitted");
  const stuck = isStuck(e, today);
  const proj = projects.filter((p) => e.projectIds.includes(p.id));
  return (
    <div className={`card p-3 ${pending ? "opacity-60" : ""} ${stuck ? "ring-1 ring-danger/50" : ""}`}>
      <Link href={`/entry/${e.id}`} className="flex items-start gap-2 text-sm leading-snug text-ink hover:text-accent-fg">
        <TypeDot type={e.type} className="mt-1.5 size-1.5" />
        <span>{e.title}</span>
      </Link>
      <div className="mt-2 flex flex-wrap gap-1">
        {e.reference && <Chip>{e.reference}</Chip>}
        {e.amount ? <Chip tone="accent">{money(e.amount)}</Chip> : null}
        {proj.map((p) => <Chip key={p.id}>{p.name}</Chip>)}
        {stuck && <Chip tone="danger">stuck</Chip>}
      </div>
      <div className="num mt-2 text-[0.68rem] text-ink-3">
        {ageDays(e, today)}d old · {quietWorkdays(e, today)}d quiet{e.chaseCount ? ` · chased ${e.chaseCount}×` : ""}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <select
          aria-label="Stage"
          className="min-w-0 flex-1 rounded-md bg-surface-2 px-1.5 py-1 text-xs text-ink-2"
          value={stage}
          onChange={(ev) => {
            const next = ev.target.value as Stage;
            setStage(next);
            start(async () => {
              await updateAction(e.id, { stage: next, status: next === "Received" || next === "Closed" ? "Done" : next === "Rejected" ? "Dropped" : "Waiting on others" });
              router.refresh();
            });
          }}
        >
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {!isClosed(e) && <ChaseButton entry={e} compact />}
      </div>
    </div>
  );
}

export function ProcurementView({ entries, projects }: { entries: Entry[]; projects: Project[] }) {
  const mounted = useMounted();
  const [kind, setKind] = useState<"all" | "Purchase Request" | "Service Request">("all");
  const today = todayLocal();
  const items = entries.filter(isProcurement).filter((e) => kind === "all" || e.type === kind);
  const p = procurement(items, today);
  return (
    <div>
      <PageHeader
        title="Procurement"
        subtitle="Purchase and service requests from draft to received. Move a card when it changes stage; press Chased when you nudge."
        actions={<Tabs label="Kind" value={kind} onChange={setKind} options={[["all", "All"], ["Purchase Request", "Purchase"], ["Service Request", "Service"]]} />}
      />
      {mounted && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Kpi label="Open" value={p.open.length} />
            <Kpi label="Value pending" value={moneyShort(p.pendingAmount)} tone="accent" />
            <Kpi label="Stuck" value={p.stuck.length} tone={p.stuck.length ? "danger" : "ok"} hint="7+ quiet working days" />
            <Kpi label="Avg request → received" value={p.avgCycleDays === null ? "–" : `${p.avgCycleDays.toFixed(0)}d`} />
          </div>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {BOARD.map((stage) => {
              const list = items
                .filter((e) => (e.stage ?? "Submitted") === stage)
                .filter((e) => stage !== "Received" || ageDays(e, today) <= 45)
                .sort((a, b) => quietWorkdays(b, today) - quietWorkdays(a, today));
              const value = list.reduce((s, e) => s + (e.amount || 0), 0);
              return (
                <section key={stage} className="w-64 shrink-0 snap-start">
                  <h2 className="mb-2 flex items-baseline justify-between text-sm font-semibold text-ink-2">
                    <span>{stage} <span className="num font-normal text-ink-3">{list.length}</span></span>
                    {value > 0 && <span className="num text-xs font-normal text-ink-3">{moneyShort(value)}</span>}
                  </h2>
                  <div className="space-y-2">
                    {list.map((e) => <Card key={e.id} e={e} projects={projects} today={today} />)}
                    {!list.length && <div className="rounded-[var(--radius)] border border-dashed border-line p-4 text-center text-xs text-ink-3">Empty</div>}
                  </div>
                </section>
              );
            })}
          </div>
          <p className="text-xs text-ink-3">
            Capture with <code>pr:</code> or <code>sr:</code>, e.g. <code>pr: 12 laptops £14,400 PR-20431 +Team_Hiring</code>. Amount and reference are picked up automatically.
          </p>
        </div>
      )}
    </div>
  );
}
