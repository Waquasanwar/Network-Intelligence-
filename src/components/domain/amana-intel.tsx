import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AgentMark } from "@/components/ui/agent-mark";
import { Avatar } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/ui/submit-button";
import { askBenchToConfirm } from "@/server/actions/agent-notes";
import { localTime, utcLabel, offsetHours } from "@/lib/place";
import type { amanaIntel } from "@/lib/amana-intel";
import { cn } from "@/lib/utils";

type Intel = ReturnType<typeof amanaIntel>;
const READY = [["now", "Free now"], ["soon", "Free soon"], ["later", "Later"], ["unknown", "Not confirmed"], ["no", "Not looking"]] as const;

/**
 * The Amana bench, read by the agent: a short briefing in sentences, then three pictures of the same
 * data. Who can start, what live work needs against who is free to do it, and where they are.
 */
export function AmanaIntelligence({ intel, asked }: { intel: Intel; asked?: number }) {
  const { count, bench, freeBench, supply, zones, workPlaces, patterns, insights } = intel;
  const max = Math.max(1, ...supply.map((s) => Math.max(s.bench.length, s.network.length)));
  const workOffsets = new Set(workPlaces.map((w) => offsetHours(w.zone)));
  return (
    <section className="mb-6 space-y-4" aria-labelledby="amana-intel" data-amana-intel>
      <div className="stage-ink rounded-[24px] px-5 py-6 sm:px-8 sm:py-7">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <h2 id="amana-intel" className="flex items-center gap-2.5 font-display text-[20px] font-semibold text-white"><span className="pulse-orb"><AgentMark size={16} busy /></span>On the bench now</h2>
            {asked !== undefined ? <p className="mt-3 text-[13px] text-[#6ee7c5]">{asked ? `Asked ${asked} ${asked === 1 ? "member" : "members"} to confirm. Their answers update the bench.` : "Everyone who could be asked has been asked this month."}</p> : null}
            <ul className="mt-4 space-y-2.5" data-insights>
              {insights.length ? insights.map((i) => (
                <li key={i.text} className="flex items-start gap-3 text-[14.5px] leading-[1.5] text-white/90" data-insight={i.tone}>
                  <span className={cn("intel-dot", `is-${i.tone}`)} aria-hidden="true" />
                  <span className="min-w-0 flex-1">{i.text}
                    {i.href ? <> <Link href={i.href} className="inline-flex items-center gap-1 font-semibold text-[#6ee7c5] hover:underline">Open<ArrowRight className="h-3 w-3" aria-hidden="true" /></Link></> : null}
                    {i.action === "ask-bench" ? <form action={askBenchToConfirm} className="mt-2"><SubmitButton size="sm" variant="secondary" pendingText="Asking…">Ask them to confirm</SubmitButton></form> : null}
                  </span>
                </li>
              )) : <li className="text-[14.5px] text-white/80">Mark people as Amana core circle and I will read the bench for you here.</li>}
            </ul>
          </div>
          <div className="flex gap-8 lg:flex-col lg:gap-4 lg:text-right">
            <div><b className="figure-num block text-[44px] leading-none text-white">{count.now}</b><span className="text-[13px] text-white/70">free now</span></div>
            <div><b className="figure-num block text-[28px] leading-none text-white/85">{count.soon}</b><span className="text-[13px] text-white/70">free soon</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="intel-card" data-intel="readiness">
          <h3 className="intel-title">Core circle</h3>
          <p className="intel-sub">{bench.length} experts, by when they can start</p>
          <div className="intel-bar" aria-hidden="true">{READY.map(([k]) => count[k] ? <i key={k} className={`r-${k}`} style={{ flexGrow: count[k] }} /> : null)}</div>
          <ul className="intel-legend">{READY.filter(([k]) => count[k]).map(([k, l]) => <li key={k}><i className={`r-${k}`} aria-hidden="true" />{l} <b>{count[k]}</b></li>)}</ul>
          {freeBench.length ? <div className="mt-4 flex flex-wrap gap-1.5">{freeBench.slice(0, 9).map((p) => <Link key={p.id} href={`/network/${p.id}`} title={`${p.firstName} ${p.lastName}`} className="world-face is-now"><Avatar person={p} size="sm" /></Link>)}</div> : null}
          <p className="mt-4 text-[12.5px] text-ink-muted">Of the free: {patterns.full_time} full time · {patterns.part_time} part time · {patterns.per_project} per project</p>
        </div>

        <div className="intel-card" data-intel="supply">
          <h3 className="intel-title">What the work needs</h3>
          <p className="intel-sub">Live Amana work, against who is free</p>
          {supply.length ? (
            <ul className="mt-3 space-y-3">
              {supply.slice(0, 6).map((s) => (
                <li key={s.capability}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]"><b className="truncate font-semibold text-ink">{s.capability}</b><span className="flex-none text-[12px] text-ink-faint">needed by {s.needed}</span></div>
                  <div className="intel-pair" aria-label={`${s.bench.length} on the bench and ${s.network.length} in the wider network are free`}>
                    <span className="is-bench" style={{ width: `${(s.bench.length / max) * 100}%` }} /><em>{s.bench.length}</em>
                    <span className="is-net" style={{ width: `${(s.network.length / max) * 100}%` }} /><em>{s.network.length}</em>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-[13px] text-ink-muted">No live Amana work yet. <Link href="/requirements" className="font-semibold text-ink underline-offset-4 hover:underline">Raise one</Link> and I will check the bench against it.</p>}
          {supply.length ? <ul className="intel-legend mt-3"><li><i className="r-now" aria-hidden="true" />Bench</li><li><i className="r-net" aria-hidden="true" />Wider network</li></ul> : null}
        </div>

        <div className="intel-card" data-intel="zones">
          <h3 className="intel-title">Where they are</h3>
          <p className="intel-sub">Free people by time zone{workPlaces.length ? `, with where the work is` : ""}</p>
          <ul className="mt-3 space-y-2">
            {zones.map((z) => (
              <li key={z.offset} className={cn("intel-zone", workOffsets.has(z.offset) && "is-work")}>
                <b className="tabular">{localTime(z.zone)}</b>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-muted">{utcLabel(z.offset)} · {[...z.cities].slice(0, 2).join(", ")}</span>
                <span className="intel-dots" role="img" aria-label={`${z.bench} bench, ${z.network} wider network`}>{Array.from({ length: Math.min(z.bench, 8) }).map((_, i) => <i key={`b${i}`} className="r-now" />)}{Array.from({ length: Math.min(z.network, 8) }).map((_, i) => <i key={`n${i}`} className="r-net" />)}</span>
                {workOffsets.has(z.offset) ? <span className="tag is-mint">{workPlaces.filter((w) => offsetHours(w.zone) === z.offset).map((w) => w.label).join(", ")} work</span> : null}
              </li>
            ))}
            {!zones.length ? <li className="text-[13px] text-ink-muted">Nobody free has a location on record yet.</li> : null}
          </ul>
        </div>
      </div>
    </section>
  );
}
