import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge, Chip } from "@/components/ui/badge";
import { PersonLink } from "@/components/domain/person-link";
import { AvailabilityBadge, RouteBadge, StageBadge } from "@/components/domain/badges";
import { ACTIVE_STATUSES, assessFreshness } from "@/lib/availability";
import { capabilityCoverage } from "@/lib/matching";
import { fullName } from "@/lib/utils";

export const metadata = { title: "Amana Expert Network" };

export default async function AmanaPage() {
  const user = await requireInternal();
  const [bench, opps, introductions] = await Promise.all([
    prisma.person.findMany({ where: { tenantId: user.tenantId, OR: [{ amanaBench: true }, { usedByAmana: true }] }, include: { evidence: { select: { id: true } }, relationships: { select: { workedTogether: true } } }, orderBy: { lastName: "asc" } }),
    prisma.opportunity.findMany({ where: { tenantId: user.tenantId, isAmana: true }, include: { matches: { select: { humanDecision: true } }, teamShortlist: { include: { person: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.introduction.findMany({ where: { tenantId: user.tenantId, commercialModel: "AMANA_SOW" }, include: { person: true, opportunity: { select: { title: true } } }, orderBy: { createdAt: "desc" } }),
  ]);

  const open = opps.filter((o) => !["CLOSED_WON", "CLOSED_LOST"].includes(o.status));
  const sowReady = bench.filter((p) => (p.engagementPreferences.includes("SOW") || p.availabilityStatus === "SOW_ONLY") && ACTIVE_STATUSES.includes(p.availabilityStatus));
  const benchCaps = [...new Set(bench.flatMap((p) => p.capabilities))];
  const gaps = open.flatMap((o) => capabilityCoverage(o.requiredCapabilities, benchCaps).missing.map((c) => ({ capability: c, opportunity: o })));

  return (
    <>
      <PageHeader eyebrow="Exclusive workspace" title="Amana Expert Network" description="Who do we genuinely know who could solve this problem, and what evidence do we have? Consultants, associates, programme leaders, specialists, fractional executives and SOW teams." />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Trusted bench" value={bench.filter((p) => p.amanaBench).length} />
        <Stat label="Open to SOW now" value={sowReady.length} tone="teal" />
        <Stat label="Used before" value={bench.filter((p) => p.usedByAmana).length} />
        <Stat label="Live requirements" value={open.length} href="/opportunities?source=AMANA" />
        <Stat label="Capability gaps" value={gaps.length} tone={gaps.length ? "amber" : "teal"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Trusted experts" description="Bench status, availability and evidence at a glance" action={<Link href="/network?amanaBench=1" className="text-xs text-navy hover:underline">Full list</Link>} />
            <CardBody className="px-0 pb-0">
              <table className="data">
                <thead><tr><th className="pl-4">Expert</th><th>Capabilities</th><th>Availability</th><th>Routes</th><th>Evidence</th><th>History</th></tr></thead>
                <tbody>
                  {bench.map((p) => (
                    <tr key={p.id}>
                      <td className="pl-4"><PersonLink person={p} sub={[p.primaryCity, p.primaryCountry].filter(Boolean).join(", ")} /></td>
                      <td><div className="flex flex-wrap gap-1 max-w-[280px]">{p.capabilities.slice(0, 4).map((c) => <Chip key={c}>{c}</Chip>)}</div></td>
                      <td><AvailabilityBadge status={p.availabilityStatus} confirmedAt={p.availabilityConfirmedAt} nextCheckDate={p.nextCheckDate} /></td>
                      <td className="text-xs text-ink-muted">{p.engagementPreferences.map((r) => r === "SOW" ? "SOW" : r.toLowerCase()).join(", ") || "—"}</td>
                      <td className="text-xs tabular"><span className={p.evidence.length ? "text-teal" : "text-amber"}>{p.evidence.length}</span>{p.relationships.some((r) => r.workedTogether) ? <span className="text-ink-faint"> · worked with</span> : null}</td>
                      <td>{p.usedByAmana ? <Badge tone="teal">used by Amana</Badge> : <Badge>bench</Badge>}</td>
                    </tr>
                  ))}
                  {!bench.length ? <tr><td colSpan={6}><EmptyState title="No bench yet" description="Flag people as 'Amana trusted bench' on their profile." /></td></tr> : null}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Build team" description="Live Amana requirements and their proposal / SOW shortlists" />
            <CardBody>
              {open.length === 0 ? <EmptyState title="No live Amana requirements" /> : (
                <ul className="divide-y divide-line">
                  {open.map((o) => (
                    <li key={o.id} className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div><Link href={`/opportunities/${o.id}`} className="text-[13px] font-medium hover:underline underline-offset-4">{o.title}</Link><div className="text-[11px] text-ink-faint">{o.clientName} · {o.matches.length} suggestions · {o.matches.filter((m) => m.humanDecision === "RECOMMEND").length} recommended</div></div>
                        <div className="flex items-center gap-1.5"><RouteBadge route={o.engagementRoute} /><StageBadge status={o.status} /></div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {o.teamShortlist.map((t) => <span key={t.id} className="inline-flex items-center gap-1 rounded-md border border-teal/30 bg-teal-100 px-2 py-0.5 text-[11px] text-teal"><Link href={`/network/${t.person.id}`} className="font-medium hover:underline">{fullName(t.person)}</Link><span className="text-teal/70">· {t.roleOnTeam}</span></span>)}
                        {!o.teamShortlist.length ? <span className="text-[11px] text-ink-faint">No team members yet — <Link href={`/opportunities/${o.id}`} className="text-navy hover:underline">build the team</Link></span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Current capability gaps" description="Required by live opportunities, not on the bench" />
            <CardBody>
              {gaps.length === 0 ? <div className="text-xs text-ink-faint">The bench covers every live requirement.</div> : (
                <ul className="space-y-1.5">{gaps.map((g, i) => <li key={i} className="text-xs"><Badge tone="amber">{g.capability}</Badge> <span className="text-ink-faint">for</span> <Link href={`/opportunities/${g.opportunity.id}`} className="text-navy hover:underline">{g.opportunity.title}</Link></li>)}</ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Needs a status check" description="Bench members whose availability is stale" />
            <CardBody>
              <ul className="space-y-1.5">
                {bench.filter((p) => assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate }) !== "fresh").map((p) => <li key={p.id}><PersonLink person={p} sub={null} /></li>)}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Engagement history" description="Amana SOW introductions" />
            <CardBody>
              {introductions.length === 0 ? <div className="text-xs text-ink-faint">None recorded.</div> : (
                <ul className="space-y-2">{introductions.map((i) => <li key={i.id} className="text-xs"><div className="font-medium text-[13px]">{fullName(i.person)}</div><div className="text-ink-faint">{i.opportunity.title} · {i.status.toLowerCase().replace(/_/g, " ")}</div></li>)}</ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
