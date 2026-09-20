import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Chip } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TRUST_BAND_LABEL, type TrustScore } from "@/lib/trust";
import { ATTRIBUTES, type FitProfileRow } from "@/lib/fit";
import type { ScreeningStatus, Vouch } from "@prisma/client";
import { DateText } from "./date";

const SCREEN: Record<ScreeningStatus, [string, "neutral" | "amber" | "navy" | "teal"]> = { NONE: ["Not screened", "neutral"], REGISTERED: ["Registered · needs screening", "amber"], INVITED: ["Invited to screening", "amber"], BOOKED: ["Screening call booked", "navy"], SUBMITTED: ["Screening submitted · review", "amber"], APPROVED: ["Screened", "teal"] };
export function ScreeningBadge({ status }: { status: ScreeningStatus }) { const [l, t] = SCREEN[status]; return <Badge tone={t} filled>{l}</Badge>; }

export function Ring({ score, label, size = 64 }: { score: number; label?: string; size?: number }) {
  const tone = score >= 60 ? "stroke-teal" : score >= 35 ? "stroke-navy-400" : "stroke-amber";
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90"><circle cx="22" cy="22" r="18" fill="none" className="stroke-line-strong" strokeWidth="4" /><circle cx="22" cy="22" r="18" fill="none" className={tone} strokeWidth="4" strokeLinecap="round" pathLength={100} strokeDasharray={`${score} 100`} /></svg>
      <div className="absolute inset-0 grid place-content-center text-center leading-none"><b className="font-semibold tracking-[-0.03em]" style={{ fontSize: size * 0.3 }}>{score}</b>{label ? <small className="block text-[9.5px] text-ink-faint mt-0.5">{label}</small> : null}</div>
    </div>
  );
}

export function TrustMini({ t }: { t: TrustScore }) {
  return <span className="inline-flex items-center gap-1.5" title={`${TRUST_BAND_LABEL[t.band]} · vouched by ${t.vouchedBy}`}><Ring score={t.score} size={26} /><b className="text-[13px] tabular">{t.score}</b><small className="text-[11px] text-ink-faint whitespace-nowrap">{t.vouchedBy} vouch{t.vouchedBy === 1 ? "" : "es"}</small></span>;
}

export function TrustCard({ t, firstName, self, screened, workedWith, action }: { t: TrustScore; firstName: string; self?: boolean; screened: boolean; workedWith: boolean; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title="Trust" action={action} />
      <CardBody>
        <div className="flex gap-4 items-start">
          <Ring score={t.score} label="of 100" size={72} />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">{TRUST_BAND_LABEL[t.band]}</div>
            <p className="text-[12.5px] text-ink-muted mt-0.5">{self ? "How many people stand behind you, and how well the network knows you." : `How many people stand behind ${firstName}, and how well the network knows them. Network confidence, not a judgement.`}</p>
            <div className="flex flex-wrap gap-1 mt-2"><Chip>vouched by {t.vouchedBy}</Chip><Chip>{screened ? "screened" : "not screened"}</Chip>{workedWith ? <Chip>worked with directly</Chip> : null}</div>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {t.breakdown.map((b) => (
            <li key={b.label} className="grid grid-cols-[130px_1fr_34px] gap-x-2.5 items-center text-[12px]">
              <span className="text-ink-muted">{b.label}</span>
              <div className="h-1.5 rounded-full bg-surface-muted border border-line overflow-hidden"><div className={cn("h-full rounded-full", b.points < 0 ? "bg-amber" : "bg-[linear-gradient(90deg,#0d7a6f,#14b8a6)]")} style={{ width: `${b.max ? Math.min(100, Math.max(0, (b.points / b.max) * 100)) : 100}%` }} /></div>
              <b className={cn("text-right tabular", b.points < 0 && "text-amber")}>{b.points > 0 ? "+" : ""}{b.points}</b>
              <small className="col-span-3 text-[11px] text-ink-faint -mt-1">{b.note}</small>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export function FitCard({ rows, self, traits = [] }: { rows: FitProfileRow[]; self?: boolean; traits?: string[] }) {
  const any = rows.some((r) => r.combined !== null);
  return (
    <Card>
      <CardHeader title={self ? "How you work" : "How they work"} description={self ? "Your working style: assertiveness, conflict handling, political and commercial awareness. Clients see the strengths, never the numbers." : "Working style and attitude, so we know where they will land well. Never a pass or fail."} />
      <CardBody>
        {!any ? <div className="text-xs text-ink-muted">{self ? "Complete the screening to build your working-style profile." : "Not assessed yet. The screening call captures this, and each vouch adds what people have seen."}</div> : (
          <>
            <ul className="space-y-2.5">
              {rows.map((r) => (
                <li key={r.key} className={cn("grid grid-cols-1 md:grid-cols-[170px_1fr_74px] gap-x-3 gap-y-1 items-center text-[12.5px]", traits.includes(r.key) && "bg-navy-100/60 rounded-[12px] px-2 py-1.5 -mx-2")}>
                  <span className="flex flex-col items-start gap-0.5"><b className="font-medium">{r.label}</b>{traits.includes(r.key) ? <Badge tone="navy" filled>asked for</Badge> : null}</span>
                  <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center"><small className="text-[10.5px] text-ink-faint whitespace-nowrap max-w-[92px] truncate">{r.low}</small><div className="relative h-2 rounded-full border border-line bg-[linear-gradient(90deg,var(--color-surface-muted),var(--color-navy-100))]">{r.self !== null ? <i className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-navy-400 shadow" style={{ left: `${((r.self - 1) / 4) * 100}%` }} title={`Self-assessed ${r.self}/5`} /> : null}{r.peers !== null ? <i className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-teal shadow" style={{ left: `${((r.peers - 1) / 4) * 100}%` }} title={`Observed by ${r.peerCount}: ${r.peers}/5`} /> : null}</div><small className="text-[10.5px] text-ink-faint whitespace-nowrap max-w-[92px] truncate">{r.high}</small></div>
                  <em className="not-italic font-semibold text-right tabular">{r.combined !== null ? `${r.combined}/5` : "—"}<small className="block text-[10.5px] text-ink-faint font-normal">{r.peerCount ? `${r.peerCount} observed` : r.self !== null ? "self" : ""}</small></em>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11.5px] text-ink-faint flex items-center gap-1.5 flex-wrap"><i className="inline-block h-2.5 w-2.5 rounded-full bg-navy-400" /> self-assessed in screening <i className="inline-block h-2.5 w-2.5 rounded-full bg-teal ml-2" /> observed by people who vouched</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

export function VouchList({ vouches }: { vouches: (Vouch & { voucherUser?: { name: string } | null; voucherPerson?: { firstName: string; lastName: string } | null })[] }) {
  return (
    <Card>
      <CardHeader title={`Vouched for by ${vouches.length}`} description="Each vouch is a person putting their name behind them. LinkedIn recommendations count at a lower weight." />
      <CardBody>
        {vouches.length === 0 ? <div className="text-xs text-ink-muted">Nobody has vouched yet. Ask someone who has seen them deliver.</div> : (
          <ul className="divide-y divide-line">
            {vouches.map((v) => { const attrs = (v.attributes as Record<string, number> | null) ?? null; return (
              <li key={v.id} className="py-2.5 first:pt-0 last:pb-0 text-[12.5px]">
                <div className="flex items-center justify-between gap-2"><b>{v.voucherKind === "EXTERNAL" ? v.voucherName ?? "External" : v.voucherKind === "USER" ? v.voucherUser?.name ?? "Network owner" : v.voucherPerson ? `${v.voucherPerson.firstName} ${v.voucherPerson.lastName}` : "Network member"}</b><span className="flex gap-1.5">{v.voucherKind === "EXTERNAL" ? <Badge filled>{v.source ?? "external"}</Badge> : <Badge tone="teal" filled>{v.voucherKind === "USER" ? "network owner" : "network member"}</Badge>}{!v.wouldRecommend ? <Badge tone="amber" filled>would not recommend</Badge> : null}</span></div>
                <div className="text-ink-muted">{v.context}</div>
                {v.statement ? <p className="italic mt-1">“{v.statement}”</p> : null}
                {attrs ? <div className="flex flex-wrap gap-1 mt-1">{Object.entries(attrs).filter(([, n]) => n >= 4).map(([k]) => <Chip key={k}>{ATTRIBUTES.find((a) => a.key === k)?.label.toLowerCase() ?? k}</Chip>)}</div> : null}
                <div className="text-[11px] text-ink-faint mt-1"><DateText date={v.createdAt} relative /></div>
              </li>
            ); })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
