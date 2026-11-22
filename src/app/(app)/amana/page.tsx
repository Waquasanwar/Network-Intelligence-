import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Chip } from "@/components/ui/badge";
import { PersonLink } from "@/components/domain/person-link";
import { AvailabilityBadge, RouteBadge, StageBadge } from "@/components/domain/badges";
import { fullName } from "@/lib/utils";
import { amanaIntel } from "@/lib/amana-intel";
import { AmanaIntelligence } from "@/components/domain/amana-intel";

export const metadata = { title: "Amana Expert Network" };

export default async function AmanaPage({ searchParams }: { searchParams: Promise<{ asked?: string }> }) {
  const user = await requireInternal();
  const sp = await searchParams;
  const [bench, opps, introductions, everyone, amanaBriefs] = await Promise.all([
    prisma.person.findMany({ where: { tenantId: user.tenantId, OR: [{ amanaBench: true }, { usedByAmana: true }] }, include: { evidence: { select: { id: true } }, relationships: { select: { workedTogether: true } } }, orderBy: { lastName: "asc" } }),
    prisma.opportunity.findMany({ where: { tenantId: user.tenantId, isAmana: true }, include: { matches: { select: { humanDecision: true } }, teamShortlist: { include: { person: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.introduction.findMany({ where: { tenantId: user.tenantId, commercialModel: "AMANA_SOW" }, include: { person: true, opportunity: { select: { title: true } } }, orderBy: { createdAt: "desc" } }),
    // The whole network, for the agent's read of who is free and where.
    prisma.person.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true, capabilities: true, availabilityStatus: true, availabilityDate: true, availabilityConfirmedAt: true, workPattern: true, primaryCity: true, primaryCountry: true, timeZone: true, amanaBench: true, usedByAmana: true } }),
    prisma.brief.findMany({ where: { tenantId: user.tenantId, account: { kind: "EXPERT_NETWORK" }, status: { notIn: ["FILLED", "CLOSED"] } }, select: { id: true, title: true, capabilities: true, locations: true, engagementRoute: true, shortlist: { where: { decision: { not: "NOT_FOR_THIS" } }, orderBy: { fitScore: "desc" }, take: 4, select: { id: true, tier: true, person: { select: { id: true, firstName: true, lastName: true } } } } }, orderBy: { updatedAt: "desc" } }),
  ]);

  const open = opps.filter((o) => !["CLOSED_WON", "CLOSED_LOST"].includes(o.status));

  // Live Amana work: Amana opportunities and requirements raised for the Amana account.
  const demand = [
    ...open.map((o) => ({ id: o.id, title: o.title, capabilities: o.requiredCapabilities, location: o.location, href: `/opportunities/${o.id}` })),
    ...amanaBriefs.map((b) => ({ id: b.id, title: b.title, capabilities: b.capabilities, location: b.locations[0] ?? null, href: `/requirements/${b.id}` })),
  ];
  const intel = amanaIntel(everyone, demand);

  return (
    <>
      <PageHeader eyebrow="Exclusive workspace" title="Amana Expert Network" description="Who do we genuinely know who could solve this problem, and what evidence do we have? Consultants, associates, programme leaders, specialists, fractional executives and SOW teams." />

      <AmanaIntelligence intel={intel} asked={sp.asked !== undefined ? Number(sp.asked) || 0 : undefined} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Trusted experts" description="Core circle status, availability and evidence at a glance" action={<Link href="/network?amanaBench=1" className="text-[12.5px] font-semibold text-ink underline decoration-accent decoration-[3px] underline-offset-[5px] hover:decoration-ink">Full list</Link>} />
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
                      <td>{p.usedByAmana ? <Badge tone="teal">used by Amana</Badge> : <Badge>core circle</Badge>}</td>
                    </tr>
                  ))}
                  {!bench.length ? <tr><td colSpan={6}><EmptyState title="No core circle yet" description="Flag people as 'Amana core circle' on their profile." /></td></tr> : null}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Build team" description="Live Amana requirements and their proposal / SOW shortlists" />
            <CardBody>
              {amanaBriefs.length ? (
                <ul className="mb-2 divide-y divide-line" data-amana-briefs>
                  {amanaBriefs.map((b) => (
                    <li key={b.id} className="py-3">
                      <div className="flex items-center justify-between gap-2"><Link href={`/requirements/${b.id}`} className="inline-block py-1 text-[13px] font-medium hover:underline underline-offset-4">{b.title}</Link>{b.engagementRoute ? <RouteBadge route={b.engagementRoute} /> : null}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">{b.shortlist.length ? b.shortlist.map((t) => <Link key={t.id} href={`/network/${t.person.id}`} className="inline-flex items-center rounded-md border border-teal/30 bg-teal-100 px-2 py-0.5 text-[12px] text-teal">{fullName(t.person)}{t.tier === "meets" ? " · meets every requirement" : ""}</Link>) : <span className="text-[12px] text-ink-faint">Nobody found yet. <Link href={`/requirements/${b.id}`} className="text-navy hover:underline">Open the requirement</Link></span>}</div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {open.length === 0 ? (amanaBriefs.length ? null : <EmptyState title="No live Amana requirements" description="Raise one in Requirements for the Amana account." />) : (
                <ul className="divide-y divide-line">
                  {open.map((o) => (
                    <li key={o.id} className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div><Link href={`/opportunities/${o.id}`} className="inline-block py-1 text-[13px] font-medium hover:underline underline-offset-4">{o.title}</Link><div className="text-[12px] text-ink-faint">{o.clientName} · {o.matches.length} suggestions · {o.matches.filter((m) => m.humanDecision === "RECOMMEND").length} recommended</div></div>
                        <div className="flex items-center gap-1.5"><RouteBadge route={o.engagementRoute} /><StageBadge status={o.status} /></div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {o.teamShortlist.map((t) => <span key={t.id} className="inline-flex items-center gap-1 rounded-md border border-teal/30 bg-teal-100 px-2 py-0.5 text-[12px] text-teal"><Link href={`/network/${t.person.id}`} className="font-medium hover:underline">{fullName(t.person)}</Link><span className="text-teal/70">· {t.roleOnTeam}</span></span>)}
                        {!o.teamShortlist.length ? <span className="text-[12px] text-ink-faint">No team members yet — <Link href={`/opportunities/${o.id}`} className="text-navy hover:underline">build the team</Link></span> : null}
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
