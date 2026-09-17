import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { assessFreshness, ACTIVE_STATUSES } from "@/lib/availability";
import { Stat } from "@/components/ui/stat";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { PersonLink } from "@/components/domain/person-link";
import { AvailabilityBadge, StageBadge, IntroBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { Badge } from "@/components/ui/badge";
import { formatMoney, fullName } from "@/lib/utils";
import { ROUTE_LABELS } from "@/lib/labels";
import { AddPersonDrawer } from "@/components/domain/add-person-drawer";
import { PipelineChart } from "@/components/domain/pipeline-chart";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const user = await requireInternal();
  const t = user.tenantId;
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);

  const [people, opportunities, introductions, upcoming, needsReview, partnerReqs, relocation, recentAudit, existingPeopleForDrawer] = await Promise.all([
    prisma.person.findMany({ where: { tenantId: t }, include: { relationships: { select: { workedTogether: true, lastContactDate: true, introducedById: true } }, evidence: { select: { id: true } }, conversations: { select: { approvalStatus: true } } } }),
    prisma.opportunity.findMany({ where: { tenantId: t }, include: { matches: { select: { humanDecision: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.introduction.findMany({ where: { tenantId: t }, include: { person: true, opportunity: { select: { title: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.scheduledConversation.findMany({ where: { tenantId: t, status: "SCHEDULED", startAt: { gte: now, lte: weekAhead } }, include: { person: true }, orderBy: { startAt: "asc" } }),
    prisma.conversation.findMany({ where: { person: { tenantId: t }, approvalStatus: { in: ["NEEDS_REVIEW", "DRAFT"] } }, include: { person: true }, orderBy: { date: "desc" }, take: 6 }),
    prisma.partnerRequirement.findMany({ where: { status: { in: ["SUBMITTED", "REVIEWING", "INTRO_REQUESTED"] } }, include: { partner: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.relocationProfile.findMany({ where: { person: { tenantId: t }, advisoryStatus: { notIn: ["COMPLETED", "NOT_PROCEEDING"] } }, include: { person: true }, orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.auditLog.findMany({ where: { tenantId: t }, orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true } } } }),
    prisma.person.findMany({ where: { tenantId: t }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
  ]);

  const total = people.length;
  const workedWith = people.filter((p) => p.relationships.some((r) => r.workedTogether)).length;
  const conversationsCompleted = people.reduce((a, p) => a + p.conversations.filter((c) => c.approvalStatus === "APPROVED").length, 0);
  const fresh = people.filter((p) => assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate }, now) === "fresh").length;
  const freshPct = total ? Math.round((fresh / total) * 100) : 0;
  const activeOpps = opportunities.filter((o) => !["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"].includes(o.status));
  const liveIntros = introductions.filter((i) => !["DECLINED", "WITHDRAWN"].includes(i.status));
  const amanaDemand = activeOpps.filter((o) => o.isAmana).length;
  const pipeline = activeOpps.reduce((a, o) => a + (o.budget ? Number(o.budget) * (o.engagementRoute === "PERMANENT" ? 0.15 : 20) : 0), 0);

  const reconnect = people
    .filter((p) => assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate }, now) !== "fresh")
    .filter((p) => p.relationships.some((r) => r.workedTogether) || ACTIVE_STATUSES.includes(p.availabilityStatus) || p.amanaBench)
    .sort((a, b) => (a.availabilityConfirmedAt?.getTime() ?? 0) - (b.availabilityConfirmedAt?.getTime() ?? 0))
    .slice(0, 6);
  const newReferrals = people.filter((p) => p.relationships.some((r) => r.introducedById) && p.conversations.length === 0).slice(0, 5);
  const evidenceGaps = people.filter((p) => p.evidence.length === 0 && (ACTIVE_STATUSES.includes(p.availabilityStatus) || p.amanaBench)).slice(0, 6);
  const nextActions = people.filter((p) => p.nextAction).sort((a, b) => (a.nextActionDate?.getTime() ?? Infinity) - (b.nextActionDate?.getTime() ?? Infinity)).slice(0, 6);

  const suggestions: { text: string; href: string }[] = [];
  for (const o of activeOpps.filter((o) => o.matches.length === 0).slice(0, 2)) suggestions.push({ text: `Generate matches for "${o.title}" — no suggestions yet.`, href: `/opportunities/${o.id}` });
  for (const o of activeOpps.filter((o) => o.matches.some((m) => m.humanDecision === "UNDECIDED")).slice(0, 2)) suggestions.push({ text: `Review ${o.matches.filter((m) => m.humanDecision === "UNDECIDED").length} undecided suggestions on "${o.title}".`, href: `/opportunities/${o.id}` });
  for (const c of needsReview.slice(0, 2)) suggestions.push({ text: `Approve the structured summary for ${fullName(c.person)}.`, href: `/conversations?tab=review&open=${c.id}` });
  for (const p of reconnect.slice(0, 2)) suggestions.push({ text: `Reconnect with ${fullName(p)} — status last confirmed ${p.availabilityConfirmedAt ? p.availabilityConfirmedAt.toLocaleDateString("en-GB") : "never"}.`, href: `/network/${p.id}` });
  for (const r of partnerReqs.filter((r) => r.status === "INTRO_REQUESTED").slice(0, 1)) suggestions.push({ text: `${r.partner.name} has requested an introduction on "${r.title}".`, href: "/partners" });

  const stageCounts = ["INTAKE", "QUALIFYING", "MATCHING", "SHORTLIST", "INTRODUCING", "ENGAGED"].map((s) => ({ stage: s, count: opportunities.filter((o) => o.status === s).length }));

  return (
    <>
      <PageHeader
        title={`Good ${now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`}
        description="Who do we genuinely know who could solve this problem, why do we trust them, and how quickly can we start the right conversation?"
        actions={<AddPersonDrawer people={existingPeopleForDrawer} />}
      />

      {total < 25 ? (
        <Card className="mb-5 border-navy/15 bg-navy-50/60">
          <CardBody className="pt-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-[13px] font-semibold">Start with the people you already know</div>
              <div className="text-[12.5px] text-ink-muted mt-0.5">Import your contact list from a spreadsheet, then book conversations from the reconnect queue. Provenance is recorded for every person automatically.</div>
            </div>
            <Link href="/network/import" className="flex-none"><Button><Upload className="h-3.5 w-3.5" /> Import contacts</Button></Link>
          </CardBody>
        </Card>
      ) : null}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        <Stat label="Network" value={total} href="/network" />
        <Stat label="Worked with" value={workedWith} hint="direct delivery seen" href="/network?workedWith=1" />
        <Stat label="Conversations" value={conversationsCompleted} hint="approved" href="/conversations?tab=completed" />
        <Stat label="Fresh status" value={`${freshPct}%`} tone={freshPct < 50 ? "amber" : "teal"} hint={`${total - fresh} need a check`} href="/network?freshness=stale" />
        <Stat label="Active opportunities" value={activeOpps.length} href="/opportunities" />
        <Stat label="Introductions" value={liveIntros.length} href="/opportunities" />
        <Stat label="Amana demand" value={amanaDemand} hint="open Amana requirements" href="/amana" />
        <Stat label="Indicative pipeline" value={formatMoney(pipeline)} hint="rough, not forecast" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Suggested next actions" description="Generated from the state of the network. You decide." />
            <CardBody>
              {suggestions.length === 0 ? <EmptyState title="Nothing pressing" description="The network is in good shape." /> : (
                <ul className="divide-y divide-line">
                  {suggestions.map((s, i) => (
                    <li key={i} className="py-2 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-teal shrink-0" />
                      <Link href={s.href} className="text-[13px] text-ink hover:underline underline-offset-4">{s.text}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="My week" description="Conversations in the next seven days" action={<Link href="/conversations" className="text-xs text-navy hover:underline">All</Link>} />
              <CardBody>
                {upcoming.length === 0 ? <EmptyState title="No conversations booked" description="Book one from a person's profile." /> : (
                  <ul className="divide-y divide-line">
                    {upcoming.map((u) => (
                      <li key={u.id} className="py-2 flex items-center justify-between gap-2">
                        <PersonLink person={u.person} sub={u.meetingType.replace(/_/g, " ").toLowerCase()} />
                        <DateText date={u.startAt} relative className="text-xs text-ink-muted whitespace-nowrap" />
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Reconnect queue" description="Trusted people whose status is stale" action={<Link href="/network?freshness=stale" className="text-xs text-navy hover:underline">All</Link>} />
              <CardBody>
                {reconnect.length === 0 ? <EmptyState title="Everyone is current" /> : (
                  <ul className="divide-y divide-line">
                    {reconnect.map((p) => (
                      <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                        <PersonLink person={p} />
                        <AvailabilityBadge status={p.availabilityStatus} confirmedAt={p.availabilityConfirmedAt} nextCheckDate={p.nextCheckDate} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Next actions" description="What you said you would do" />
              <CardBody>
                {nextActions.length === 0 ? <EmptyState title="No next actions" /> : (
                  <ul className="divide-y divide-line">
                    {nextActions.map((p) => (
                      <li key={p.id} className="py-2">
                        <div className="flex items-center justify-between gap-2">
                          <PersonLink person={p} sub={null} />
                          <DateText date={p.nextActionDate} relative className="text-[11px] text-ink-faint" />
                        </div>
                        <div className="text-xs text-ink-muted mt-1 pl-[34px]">{p.nextAction}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Evidence gaps" description="Active or bench people with no observed evidence" />
              <CardBody>
                {evidenceGaps.length === 0 ? <EmptyState title="No gaps" /> : (
                  <ul className="divide-y divide-line">
                    {evidenceGaps.map((p) => (
                      <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                        <PersonLink person={p} />
                        <Badge tone="amber">No evidence</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Opportunity intelligence" description="Open requirements by stage" action={<Link href="/opportunities" className="text-xs text-navy hover:underline">Board</Link>} />
            <CardBody>
              <PipelineChart data={stageCounts} />
              <ul className="divide-y divide-line mt-3">
                {activeOpps.slice(0, 5).map((o) => (
                  <li key={o.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/opportunities/${o.id}`} className="text-[13px] font-medium text-ink hover:underline underline-offset-4 truncate block">{o.title}</Link>
                      <div className="text-[11px] text-ink-faint">{o.clientName ?? "—"} · {ROUTE_LABELS[o.engagementRoute]} · {o.matches.length} suggestions, {o.matches.filter((m) => m.humanDecision === "RECOMMEND").length} recommended</div>
                    </div>
                    <StageBadge status={o.status} />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Amana Expert Network" description="Bench and live demand" action={<Link href="/amana" className="text-xs text-navy hover:underline">Open</Link>} />
            <CardBody>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-semibold tabular">{people.filter((p) => p.amanaBench).length}</div><div className="text-[10px] text-ink-faint uppercase">bench</div></div>
                <div><div className="text-lg font-semibold tabular">{people.filter((p) => p.usedByAmana).length}</div><div className="text-[10px] text-ink-faint uppercase">used before</div></div>
                <div><div className="text-lg font-semibold tabular">{amanaDemand}</div><div className="text-[10px] text-ink-faint uppercase">open</div></div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Needs review" description="AI summaries waiting for a human" action={<Link href="/conversations?tab=review" className="text-xs text-navy hover:underline">Review</Link>} />
            <CardBody>
              {needsReview.length === 0 ? <EmptyState title="Inbox zero" /> : (
                <ul className="divide-y divide-line">
                  {needsReview.map((c) => (
                    <li key={c.id} className="py-2 flex items-center justify-between gap-2">
                      <PersonLink person={c.person} sub={null} />
                      <Link href={`/conversations?tab=review&open=${c.id}`} className="text-xs text-navy hover:underline">{c.approvalStatus === "DRAFT" ? "Draft" : "Review"}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Partner activity" action={<Link href="/partners" className="text-xs text-navy hover:underline">Partners</Link>} />
            <CardBody>
              {partnerReqs.length === 0 ? <EmptyState title="No open partner requirements" /> : (
                <ul className="divide-y divide-line">
                  {partnerReqs.map((r) => (
                    <li key={r.id} className="py-2">
                      <div className="text-[13px] text-ink">{r.title}</div>
                      <div className="text-[11px] text-ink-faint">{r.partner.name} · {r.status.replace(/_/g, " ").toLowerCase()}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Introductions" />
            <CardBody>
              {liveIntros.length === 0 ? <EmptyState title="None yet" /> : (
                <ul className="divide-y divide-line">
                  {liveIntros.slice(0, 5).map((i) => (
                    <li key={i.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0"><div className="text-[13px] text-ink truncate">{fullName(i.person)}</div><div className="text-[11px] text-ink-faint truncate">{i.opportunity.title}</div></div>
                      <IntroBadge status={i.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Relocation signals" action={<Link href="/relocation" className="text-xs text-navy hover:underline">Pipeline</Link>} />
            <CardBody>
              {relocation.length === 0 ? <EmptyState title="No live relocation interest" /> : (
                <ul className="divide-y divide-line">
                  {relocation.map((r) => (
                    <li key={r.personId} className="py-2 flex items-center justify-between gap-2">
                      <PersonLink person={r.person} sub={`${r.currentLocation ?? "?"} → ${r.targetLocation ?? "?"}`} />
                      {r.employerSponsored ? <Badge tone="teal">Employer funded</Badge> : <Badge>Individual</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="New referrals" description="Introduced, not yet spoken to" />
            <CardBody>
              {newReferrals.length === 0 ? <EmptyState title="None waiting" /> : (
                <ul className="divide-y divide-line">{newReferrals.map((p) => <li key={p.id} className="py-2"><PersonLink person={p} /></li>)}</ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent activity" action={<Link href="/settings/security" className="text-xs text-navy hover:underline">Audit log</Link>} />
            <CardBody>
              <ul className="space-y-1.5">
                {recentAudit.map((a) => (
                  <li key={a.id} className="text-[11px] text-ink-muted flex justify-between gap-2"><span className="truncate">{a.actor?.name ?? "system"} · {a.action}</span><DateText date={a.createdAt} relative className="text-ink-faint whitespace-nowrap" /></li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
