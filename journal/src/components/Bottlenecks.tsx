"use client";

import { STAGES, isClosed, type Entry, type Project, type Ref } from "@/lib/schema";
import { bottlenecks, chaseStats, isOpenAsk, isStuck, procurement, upward } from "@/lib/planning";
import { Bar, ChaseButton, EmptyRow, Kpi, Section, WorkRow, moneyShort } from "./work";

export function Bottlenecks({ entries, projects, people, today }: { entries: Entry[]; projects: Project[]; people: Ref[]; today: string }) {
  const open = entries.filter(isOpenAsk);
  const stuck = open.filter((e) => isStuck(e, today));
  const b = bottlenecks(entries, today);
  const c = chaseStats(entries, today);
  const proc = procurement(entries, today);
  const mgmt = upward(entries);
  const maxCount = Math.max(1, ...b.map((x) => x.count));
  const maxStage = Math.max(1, ...proc.byStage.map((s) => s.count));
  const requests = entries.filter((e) => e.type === "Request" && isClosed(e));
  const turnaround = requests.length
    ? requests.reduce((s, e) => s + (new Date(e.lastEdited).getTime() - new Date(e.backdate || e.captured).getTime()) / 86400000, 0) / requests.length
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Open asks" value={open.length} hint="requests, PRs, SRs, questions" />
        <Kpi label="Stuck" value={stuck.length} tone={stuck.length ? "danger" : "ok"} hint="7+ quiet working days" />
        <Kpi label="Chase now" value={c.dueNow.length} tone={c.dueNow.length ? "warn" : "ok"} hint="3+ quiet working days" />
        <Kpi label="With management" value={mgmt.length} hint="upward asks open" />
        <Kpi label="Procurement pending" value={moneyShort(proc.pendingAmount)} hint={`${proc.open.length} open PR/SR`} tone="accent" />
        <Kpi label="Request turnaround" value={turnaround === null ? "–" : `${turnaround.toFixed(1)}d`} hint="average to close" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Section title="Who is holding things up" sub="Open asks by who they wait on, weighted by how long they have waited">
          {b.length ? (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="label text-left">
                  <th className="px-4 py-2 font-medium">Waiting on</th>
                  <th className="w-[30%] px-2 py-2 font-medium">Items</th>
                  <th className="px-2 py-2 text-right font-medium">Avg</th>
                  <th className="px-2 py-2 text-right font-medium">Oldest</th>
                  <th className="px-2 py-2 text-right font-medium">Chases</th>
                  <th className="px-4 py-2 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {b.map((x) => (
                  <tr key={x.who}>
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {x.who}
                      {x.stuck > 0 && <span className="ml-2 rounded bg-surface-2 font-medium px-1.5 py-0.5 text-[0.68rem] whitespace-nowrap text-danger">{x.stuck} stuck</span>}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="num w-5 text-ink-2">{x.count}</span>
                        <Bar value={x.count} max={maxCount} tone={x.stuck ? "danger" : "accent"} />
                      </div>
                    </td>
                    <td className="num px-2 py-2.5 text-right text-ink-2">{x.avgDays}d</td>
                    <td className={`num px-2 py-2.5 text-right ${x.oldestDays > 14 ? "text-danger" : "text-ink-2"}`}>{x.oldestDays}d</td>
                    <td className="num px-2 py-2.5 text-right text-ink-2">{x.chases}</td>
                    <td className="num px-4 py-2.5 text-right text-ink-2">{x.amount ? moneyShort(x.amount) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <EmptyRow>Nothing is waiting on anyone. Set &ldquo;Waiting on&rdquo; on requests to see bottlenecks.</EmptyRow>
          )}
        </Section>

        <Section title="Procurement pipeline" sub={`Purchase and service requests by stage${proc.avgCycleDays !== null ? ` · ${proc.avgCycleDays.toFixed(0)} days average from request to received` : ""}`}>
          <div className="space-y-2 px-4 py-3">
            {proc.byStage.map((s) => (
              <div key={s.stage} className="grid grid-cols-[7.5rem_1fr_3rem_3.5rem] items-center gap-3 text-sm">
                <span className={`truncate ${s.count ? "text-ink" : "text-ink-3"}`}>{s.stage}</span>
                <Bar value={s.count} max={maxStage} tone={s.avgDays > 14 && s.stage !== "Received" ? "danger" : s.avgDays > 7 && s.stage !== "Received" ? "warn" : "accent"} />
                <span className="num text-right text-ink-2">{s.count}</span>
                <span className="num text-right text-xs text-ink-3">{s.count ? `${s.avgDays}d` : ""}</span>
              </div>
            ))}
            <p className="pt-1 text-xs text-ink-3">Bar colour shows average age at that stage: amber over a week, orange over two.</p>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Chase now" sub="Waiting, quiet for 3+ working days or past their follow-up date">
          <div className="divide-y divide-line">
            {c.dueNow.slice(0, 8).map((e) => (
              <WorkRow key={e.id} entry={e} today={today} projects={projects} people={people} right={<ChaseButton entry={e} compact />} />
            ))}
            {!c.dueNow.length && <EmptyRow>Nothing to chase. Everything has moved recently.</EmptyRow>}
          </div>
        </Section>
        <Section title="Stuck" sub="Open for a while with no movement for 7+ working days">
          <div className="divide-y divide-line">
            {stuck.slice(0, 8).map((e) => (
              <WorkRow key={e.id} entry={e} today={today} projects={projects} people={people} right={<ChaseButton entry={e} compact />} />
            ))}
            {!stuck.length && <EmptyRow>Nothing stuck.</EmptyRow>}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Waiting on management" sub="Asks you have sent upward that are still open">
          <div className="divide-y divide-line">
            {mgmt.map((e) => (
              <WorkRow key={e.id} entry={e} today={today} projects={projects} people={people} right={<ChaseButton entry={e} compact />} />
            ))}
            {!mgmt.length && <EmptyRow>Nothing waiting on management. Use ^^ when you capture an ask to your manager.</EmptyRow>}
          </div>
        </Section>
        <Section title="How much chasing it takes" sub="Across every request, purchase, service request and question">
          <div className="grid grid-cols-3 gap-px bg-line">
            {[
              ["Total chases", String(c.totalChases)],
              ["Avg chases to close", c.avgChasesToClose === null ? "–" : c.avgChasesToClose.toFixed(1)],
              ["Closed only after chasing", c.closedNeedingChase === null ? "–" : `${Math.round(c.closedNeedingChase * 100)}%`],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-4 py-3">
                <div className="num text-xl text-ink">{v}</div>
                <div className="text-xs text-ink-3">{k}</div>
              </div>
            ))}
          </div>
          <div className="divide-y divide-line border-t border-line">
            <p className="label px-4 pt-3 pb-1">Most chased, still open</p>
            {c.mostChased.map((e) => (
              <WorkRow key={e.id} entry={e} today={today} projects={projects} people={people} />
            ))}
            {!c.mostChased.length && <EmptyRow>No open item has needed chasing yet.</EmptyRow>}
          </div>
        </Section>
      </div>

      <p className="text-xs text-ink-3">
        Stages run {STAGES.slice(0, 7).join(" → ")}. Press <span className="text-ink-2">Chased</span> whenever you nudge someone: it counts the chase, resets the clock and notes it on the Notion page.
      </p>
    </div>
  );
}
