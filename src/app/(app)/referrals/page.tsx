import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { TRUST_INCLUDE } from "@/lib/trust-include";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/page";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { SubmitButton } from "@/components/ui/submit-button";
import { PersonLink } from "@/components/domain/person-link";
import { DateText } from "@/components/domain/date";
import { TrustMini, ScreeningBadge } from "@/components/domain/trust";
import { BookScreeningDrawer } from "@/components/domain/member-drawers";
import { triageReferral, triagePitch, trustFor, startScreening } from "@/server/actions/members";
import { SOURCE_LABELS } from "@/lib/labels";
import { fullName } from "@/lib/utils";

export const metadata = { title: "Referrals & pitches" };

const REF_STATUS: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", SCREENING: "Screening booked", ACCEPTED: "In the network", DECLINED: "Not now" };
const PITCH_STATUS: Record<string, string> = { SUBMITTED: "Submitted", SHORTLISTED: "On the shortlist", DECLINED: "Not this time" };

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireInternal();
  const { tab = "referrals" } = await searchParams;
  const [refs, pitches, joiners, screenedCount] = await Promise.all([
    prisma.referral.findMany({ where: { tenantId: user.tenantId }, include: { referrer: { include: TRUST_INCLUDE }, referred: { select: { id: true, firstName: true, lastName: true, headline: true } }, brief: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.pitch.findMany({ where: { brief: { tenantId: user.tenantId } }, include: { person: { include: TRUST_INCLUDE }, brief: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.person.findMany({ where: { tenantId: user.tenantId, screeningStatus: { in: ["REGISTERED", "INVITED", "BOOKED", "SUBMITTED"] } }, include: { ...TRUST_INCLUDE, relationships: { include: { introducedBy: { select: { firstName: true, lastName: true } } } } }, orderBy: { updatedAt: "desc" } }),
    prisma.person.count({ where: { tenantId: user.tenantId, screeningStatus: "APPROVED" } }),
  ]);
  const tabs = [{ key: "referrals", label: "Referrals", count: refs.length }, { key: "pitches", label: "Pitches", count: pitches.length }, { key: "joining", label: "Joining", count: joiners.length }];

  return (
    <>
      <PageHeader eyebrow="Referral network" title="Referrals & pitches" description="People who know people. Every referral carries the referrer's name inside the network and nothing outside it." />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Stat label="New referrals" value={refs.filter((r) => r.status === "NEW").length} hint="to triage" /><Stat label="Accepted" value={refs.filter((r) => r.status === "ACCEPTED").length} hint="into the network" tone="teal" /><Stat label="Pitches" value={pitches.filter((x) => x.status === "SUBMITTED").length} hint="waiting" /><Stat label="Joining" value={joiners.length} hint="registered or in screening" /><Stat label="Members screened" value={screenedCount} tone="teal" />
      </div>
      <Tabs items={tabs} current={tab} base="/referrals" />

      {tab === "pitches" ? (pitches.length === 0 ? <EmptyState title="No pitches yet" description="Members pitch from their portal when a requirement is opened to them." /> : <div className="space-y-3">{await Promise.all(pitches.map(async (x) => { const t = await trustFor(x.person); return (
        <Card key={x.id}><CardBody className="pt-3">
          <div className="flex items-start justify-between gap-3"><PersonLink person={x.person} sub={x.person.headline} /><div className="flex items-center gap-3"><TrustMini t={t} /><Badge tone={x.status === "SHORTLISTED" ? "teal" : "navy"}>{PITCH_STATUS[x.status]}</Badge></div></div>
          <p className="italic text-[13px] mt-2">“{x.note}”</p>
          <div className="text-[11.5px] text-ink-faint mt-1">For <Link href={`/requirements/${x.brief.id}`} className="text-navy hover:underline">{x.brief.title}</Link> · <DateText date={x.createdAt} relative /></div>
          {x.status === "SUBMITTED" ? <div className="flex gap-2 mt-3"><form action={triagePitch}><input type="hidden" name="pitchId" value={x.id} /><input type="hidden" name="action" value="shortlist" /><SubmitButton size="sm" pendingText="…">Add to shortlist</SubmitButton></form><form action={triagePitch}><input type="hidden" name="pitchId" value={x.id} /><input type="hidden" name="action" value="decline" /><SubmitButton size="sm" variant="ghost" pendingText="…">Not this time</SubmitButton></form></div> : null}
        </CardBody></Card>
      ); }))}</div>)
      : tab === "joining" ? (joiners.length === 0 ? <EmptyState title="Nobody joining right now" description="New registrations from the join link appear here and in your alerts." /> : (
        <Card className="overflow-hidden"><table className="data"><thead><tr><th>Person</th><th>Came via</th><th>Status</th><th>Trust</th><th></th></tr></thead><tbody>
          {await Promise.all(joiners.map(async (p) => { const r = p.relationships[0]; const t = await trustFor(p); return (
            <tr key={p.id}><td><PersonLink person={p} sub={p.headline} /></td><td className="text-xs text-ink-muted">{r ? SOURCE_LABELS[r.sourceType] : "—"}{r?.introducedBy ? <div className="text-[11px] text-ink-faint">via {r.introducedBy.firstName} {r.introducedBy.lastName}</div> : null}</td><td><ScreeningBadge status={p.screeningStatus} /></td><td><TrustMini t={t} /></td>
              <td className="text-right whitespace-nowrap"><div className="inline-flex gap-2">{p.screeningStatus === "SUBMITTED" ? <Link href="/conversations?tab=review" className="text-[12.5px] text-navy hover:underline">Review screening</Link> : <><form action={startScreening}><input type="hidden" name="personId" value={p.id} /><SubmitButton size="sm" pendingText="…">Run screening</SubmitButton></form><BookScreeningDrawer personId={p.id} label="Book call" /></>}</div></td></tr>
          ); }))}
        </tbody></table></Card>
      ))
      : (refs.length === 0 ? <EmptyState title="No referrals yet" description="Members refer people from their portal and name them in screenings." /> : <div className="space-y-3">{await Promise.all(refs.map(async (r) => { const t = await trustFor(r.referrer); return (
        <Card key={r.id}><CardBody className="pt-3">
          <div className="flex items-start justify-between gap-3"><div><div className="text-[14px] font-semibold">{r.name}</div><div className="text-[11.5px] text-ink-faint">referred by <Link href={`/network/${r.referrerPersonId}`} className="text-navy hover:underline">{fullName(r.referrer)}</Link> · <DateText date={r.createdAt} relative />{r.brief ? <> · for <Link href={`/requirements/${r.brief.id}`} className="text-navy hover:underline">{r.brief.title}</Link></> : null}</div></div><div className="flex items-center gap-3"><TrustMini t={t} /><Badge tone={r.status === "ACCEPTED" ? "teal" : r.status === "NEW" ? "amber" : "navy"}>{REF_STATUS[r.status]}</Badge></div></div>
          <p className="italic text-[13px] mt-2">“{r.context}”</p>
          {r.note ? <div className="text-[12px] text-ink-muted mt-0.5">{r.note}</div> : null}
          {r.referred ? <div className="text-[12px] text-ink-muted mt-1">In the network: <Link href={`/network/${r.referred.id}`} className="text-navy hover:underline">{fullName(r.referred)}</Link></div> : null}
          {r.status === "NEW" || r.status === "CONTACTED" ? <div className="flex flex-wrap gap-2 mt-3">{(["accept", "screen", "decline"] as const).map((a) => <form key={a} action={triageReferral}><input type="hidden" name="referralId" value={r.id} /><input type="hidden" name="action" value={a} /><SubmitButton size="sm" variant={a === "accept" ? "primary" : a === "screen" ? "secondary" : "ghost"} pendingText="…">{a === "accept" ? (r.referred ? "Link and accept" : "Accept into network") : a === "screen" ? "Book screening" : "Not now"}</SubmitButton></form>)}</div> : null}
        </CardBody></Card>
      ); }))}</div>)}
    </>
  );
}
