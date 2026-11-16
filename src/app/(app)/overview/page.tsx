import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { assessFreshness, ACTIVE_STATUSES } from "@/lib/availability";
import { NetworkGraph } from "@/components/domain/network-graph";
import { buildNetworkMap } from "@/server/network-map";
import { InviteCard } from "@/components/domain/invite-card";
import { networkInviteToken } from "@/server/invites";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";
import { PersonLink } from "@/components/domain/person-link";
import { AvailabilityBadge, StageBadge, IntroBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { formatMoneyCompact, fullName } from "@/lib/utils";
import { ROUTE_LABELS, AVAILABILITY_LABELS } from "@/lib/labels";
import { CIRCLES, circleOf } from "@/lib/circles";
import { SegmentedBar, BarList } from "@/components/ui/charts";
import { AddPersonDrawer } from "@/components/domain/add-person-drawer";
import { Button } from "@/components/ui/button";
import { Upload, Sparkles, ListChecks, FileCheck2, RefreshCw, Handshake, ArrowRight, Users, Briefcase, TrendingUp, UserCheck, UserPlus, ClipboardList, Send, Share2 } from "lucide-react";
import { AgentComposer } from "@/components/domain/agent-composer";

// What the agent has queued for you, by the kind of decision it needs.
type QueueKind = "match" | "review" | "approve" | "reconnect" | "intro";
const QUEUE: Record<QueueKind, { tag: string; verb: string; icon: typeof Sparkles }> = {
  match: { tag: "Matching", verb: "Run", icon: Sparkles },
  review: { tag: "Shortlist", verb: "Review", icon: ListChecks },
  approve: { tag: "Summary", verb: "Approve", icon: FileCheck2 },
  reconnect: { tag: "Reconnect", verb: "Open", icon: RefreshCw },
  intro: { tag: "Introduction", verb: "Respond", icon: Handshake },
};

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const user = await requireInternal();
  const t = user.tenantId;
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);

  const [people, opportunities, introductions, upcoming, needsReview, partnerReqs, existingPeopleForDrawer] = await Promise.all([
    prisma.person.findMany({ where: { tenantId: t }, include: { relationships: { select: { workedTogether: true, lastContactDate: true, introducedById: true } }, evidence: { select: { id: true } }, conversations: { select: { approvalStatus: true } } } }),
    prisma.opportunity.findMany({ where: { tenantId: t }, include: { matches: { select: { humanDecision: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.introduction.findMany({ where: { tenantId: t }, include: { person: true, opportunity: { select: { title: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.scheduledConversation.findMany({ where: { tenantId: t, status: "SCHEDULED", startAt: { gte: now, lte: weekAhead } }, include: { person: true }, orderBy: { startAt: "asc" } }),
    prisma.conversation.findMany({ where: { person: { tenantId: t }, approvalStatus: { in: ["NEEDS_REVIEW", "DRAFT"] } }, include: { person: true }, orderBy: { date: "desc" }, take: 6 }),
    prisma.partnerRequirement.findMany({ where: { partner: { networkTenantId: user.tenantId }, status: { in: ["SUBMITTED", "REVIEWING", "INTRO_REQUESTED"] } }, include: { partner: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.person.findMany({ where: { tenantId: t }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
  ]);

  const showP23 = process.env.NEXT_PUBLIC_FEATURE_PHASE23 !== "false";
  const total = people.length;
  const workedWith = people.filter((p) => p.relationships.some((r) => r.workedTogether)).length;
  const members = people.filter((p) => p.memberSince).length;
  const awaitingScreening = people.filter((p) => ["REGISTERED", "INVITED", "BOOKED", "SUBMITTED"].includes(p.screeningStatus)).length;
  const activeOpps = opportunities.filter((o) => !["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"].includes(o.status));
  const liveIntros = introductions.filter((i) => !["DECLINED", "WITHDRAWN"].includes(i.status));
  const amanaDemand = activeOpps.filter((o) => o.isAmana).length;
  const pipeline = activeOpps.reduce((a, o) => a + (o.budget ? Number(o.budget) * (o.engagementRoute === "PERMANENT" ? 0.15 : 20) : 0), 0);

  // Honest trend lines: an 8-week cumulative line and the count confirmed in the last 7 days.
  const weekMs = 7 * 86_400_000;
  const last7 = (dates: Date[]) => dates.filter((d) => now.getTime() - d.getTime() <= weekMs).length;
  const peopleDates = people.map((p) => p.createdAt);
  const oppDates = activeOpps.map((o) => o.createdAt);
  const introDates = liveIntros.map((i) => i.createdAt);

  const reconnect = people
    .filter((p) => assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate }, now) !== "fresh")
    .filter((p) => p.relationships.some((r) => r.workedTogether) || ACTIVE_STATUSES.includes(p.availabilityStatus) || p.amanaBench)
    .sort((a, b) => (a.availabilityConfirmedAt?.getTime() ?? 0) - (b.availabilityConfirmedAt?.getTime() ?? 0))
    .slice(0, 6);

  const suggestions: { kind: QueueKind; text: string; href: string }[] = [];
  for (const o of activeOpps.filter((o) => o.matches.length === 0).slice(0, 2)) suggestions.push({ kind: "match", text: `Generate matches for "${o.title}" — no suggestions yet.`, href: `/opportunities/${o.id}` });
  for (const o of activeOpps.filter((o) => o.matches.some((m) => m.humanDecision === "UNDECIDED")).slice(0, 2)) suggestions.push({ kind: "review", text: `Review ${o.matches.filter((m) => m.humanDecision === "UNDECIDED").length} undecided suggestions on "${o.title}".`, href: `/opportunities/${o.id}` });
  for (const c of needsReview.slice(0, 2)) suggestions.push({ kind: "approve", text: `Approve the structured summary for ${fullName(c.person)}.`, href: `/conversations?tab=review&open=${c.id}` });
  for (const p of reconnect.slice(0, 2)) suggestions.push({ kind: "reconnect", text: `Reconnect with ${fullName(p)} — status last confirmed ${p.availabilityConfirmedAt ? p.availabilityConfirmedAt.toLocaleDateString("en-GB") : "never"}.`, href: `/network/${p.id}` });
  for (const r of partnerReqs.filter((r) => r.status === "INTRO_REQUESTED").slice(0, 1)) suggestions.push({ kind: "intro", text: `${r.partner.name} has requested an introduction on "${r.title}".`, href: "/partners" });

  const stageCounts = ["INTAKE", "QUALIFYING", "MATCHING", "SHORTLIST", "INTRODUCING", "ENGAGED"].map((s) => ({ stage: s, count: opportunities.filter((o) => o.status === s).length }));

  // The same living map as /network/map — real trust scores and real role matches — in a compact frame.
  const { nodes: mapNodes, links: mapLinks } = await buildNetworkMap(user, now);

  const counts = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const topCaps = counts(mapNodes.flatMap((n) => n.capabilities ?? []));
  const topCities = counts(mapNodes.map((n) => n.city?.split(",")[0]).filter((c): c is string => !!c));
  const mapPeople = mapNodes.filter((n) => !n.hub);
  const circleCounts = [0, 1, 2].map((c) => mapPeople.filter((n) => circleOf(n) === c).length);
  const tally = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const availabilityRows = tally(people.map((p) => p.availabilityStatus)).slice(0, 5).map(([k, v]) => ({ label: AVAILABILITY_LABELS[k as keyof typeof AVAILABILITY_LABELS] ?? k, value: v, href: `/network?status=${k}` }));
  const expertiseRows = tally(mapPeople.flatMap((n) => (n.capabilities ?? []).map((c) => c.trim()).filter(Boolean))).slice(0, 5).map(([k, v]) => ({ label: k, value: v, href: `/network?q=${encodeURIComponent(k)}` }));
  const askSuggestions = [
    topCaps[0] ? `${topCaps[0]}, available now` : null,
    topCities[0] ? `People in ${topCities[0]}` : null,
    topCaps[1] ? `${topCaps[1]} we have worked with` : null,
  ].filter((x): x is string => !!x);

  return (
    <>
      {/* Page title and the two things you do most. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-5">
        <div className="min-w-0">
          <p className="text-[12.5px] text-ink-faint">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="font-display text-[24px] sm:text-[28px] leading-[1.15] mt-1">Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, {user.name.split(" ")[0]}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/network/import"><Button variant="secondary"><Upload className="h-3.5 w-3.5" /> Import contacts</Button></Link>
          <AddPersonDrawer people={existingPeopleForDrawer} />
        </div>
      </div>

      {/* The search banner: one question box, in plain words. */}
      <section className="brand-panel rounded-[28px] px-5 py-6 sm:px-8 sm:py-7 mb-4">
        <h2 className="font-display is-small text-[19px] sm:text-[21px] leading-[1.25]">Who are you looking for?</h2>
        <p className="text-stage-muted text-[14px] mt-1 max-w-[70ch]">Ask in plain words. The agent searches everyone in your network and ranks them by how well you know and trust them.</p>
        <AgentComposer suggestions={askSuggestions} />
      </section>

      {/* Headline numbers. Each one opens the list behind it. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {(showP23
          ? [
              { label: "People in the network", value: total, hint: `${workedWith} you've worked with`, href: "/network", delta: last7(peopleDates), icon: Users },
              { label: "Live opportunities", value: activeOpps.length, hint: amanaDemand ? `${amanaDemand} via Amana` : "open requirements", href: "/opportunities", delta: last7(oppDates), icon: Briefcase },
              { label: "Introductions in flight", value: liveIntros.length, hint: "waiting on a reply or a meeting", href: "/opportunities", delta: last7(introDates), icon: Handshake },
              { label: "Indicative pipeline", value: formatMoneyCompact(pipeline), hint: "rough, not a forecast", href: "/requirements", delta: 0, icon: TrendingUp },
            ]
          : [
              { label: "People in the network", value: total, hint: `${workedWith} you've worked with`, href: "/network", delta: last7(peopleDates), icon: Users },
              { label: "Signed up", value: members, hint: "members in your network", href: "/network", delta: 0, icon: UserCheck },
              { label: "Awaiting screening", value: awaitingScreening, hint: "registered, not yet screened", href: "/conversations", delta: 0, icon: ListChecks },
              { label: "Worked with", value: workedWith, hint: "people you've delivered with", href: "/network?workedWith=1", delta: 0, icon: Handshake },
            ]
        ).map((k) => (
          <Link key={k.label} href={k.href} className="lift group block rounded-[22px] border border-line bg-surface p-5 sm:p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[12.5px] font-medium text-ink-muted leading-tight">{k.label}</div>
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-surface-muted text-ink"><k.icon className="h-4 w-4" /></span>
            </div>
            <div className="font-display text-[34px] sm:text-[40px] leading-none mt-4 text-ink">{k.value}</div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-faint">
              {k.delta ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 font-semibold text-teal">↗ +{k.delta} this week</span> : null}
              <span>{k.hint}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* The everyday jobs, one click each. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {[
          { title: "Add a person", text: "Paste a LinkedIn link or a few lines and let the assistant draft the profile.", href: "/network/intake", icon: UserPlus },
          { title: "Post a requirement", text: "Describe what a client needs; get a shortlist from people you know.", href: "/requirements", icon: ClipboardList },
          { title: "Invite someone", text: "Send your link. They register, do the screening, and you review.", href: "/invite", icon: Send },
          { title: "Open the network map", text: "See your circles of trust and who introduced whom.", href: "/network/map", icon: Share2 },
        ].map((q) => (
          <Link key={q.title} href={q.href} className="lift group flex items-start gap-3 rounded-[22px] border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-navy text-accent"><q.icon className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-[13.5px] font-semibold text-ink">{q.title} <ArrowRight className="arrow-badge h-3.5 w-3.5 flex-none text-ink-faint group-hover:text-ink" /></span>
              <span className="block text-[12.5px] text-ink-muted leading-[1.45] mt-0.5">{q.text}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* The shape of the network: how close people are, who is free, and what they are good at. */}
      {total ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
          <Card>
            <CardHeader title="How well you know them" description="Everyone in the network, by circle of trust" />
            <CardBody><SegmentedBar parts={CIRCLES.map((c, i) => ({ label: c.label, hint: c.hint, value: circleCounts[i] }))} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Availability" description="What people last told you" action={<Link href="/network" className="text-[12.5px] font-semibold text-ink underline decoration-accent decoration-[3px] underline-offset-[5px] hover:decoration-ink">All</Link>} />
            <CardBody><BarList rows={availabilityRows} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Top expertise" description="What your network is strongest at" />
            <CardBody><BarList rows={expertiseRows} empty="No expertise recorded yet. It is captured in the screening." /></CardBody>
          </Card>
        </div>
      ) : null}

      {people.length > 1 ? (
        <Card className="mb-4 overflow-hidden">
          <CardHeader title="Circles of trust" description="You at the centre; the people you have worked with closest in. Click a person for their trust and the open roles they fit." action={<Link href="/network/map" className="text-[13px] font-semibold text-ink underline decoration-accent decoration-[3px] underline-offset-[6px]">Open full map</Link>} />
          <div className="px-3 pb-3"><NetworkGraph nodes={mapNodes} links={mapLinks} heightClass="h-[480px]" compact /></div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card className="ai-surface">
            <CardHeader title={<span className="inline-flex items-center gap-2.5"><span className="live-dot" aria-hidden="true" /> Agent queue</span>} description="What the agent has lined up from the state of the network. Nothing happens until you say so." action={suggestions.length ? <span className="label-caps text-ink-faint">{suggestions.length} waiting</span> : undefined} />
            <CardBody>
              {suggestions.length === 0 ? <EmptyState title="Nothing waiting" description="The agent is watching. New matches, reviews and reconnects appear here." /> : (
                <ul className="space-y-1.5">
                  {suggestions.map((s, i) => {
                    const k = QUEUE[s.kind]; const Icon = k.icon;
                    return (
                      <li key={i}>
                        <Link href={s.href} className="group flex items-center gap-3 rounded-[12px] border border-line bg-surface px-3 py-2.5 transition-colors duration-200 hover:border-ink">
                          <span className="grid h-8 w-8 flex-none place-items-center rounded-[12px] bg-surface-muted text-ink"><Icon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="label-caps block text-ink-faint">{k.tag}</span>
                            <span className="block truncate text-[13px] text-ink">{s.text}</span>
                          </span>
                          <span className="inline-flex flex-none items-center gap-1 rounded-[12px] border border-line px-2.5 py-1.5 text-[12px] font-semibold text-ink transition-colors duration-200 group-hover:border-navy group-hover:bg-navy group-hover:text-white dark:group-hover:text-canvas">{k.verb} <ArrowRight className="h-3 w-3" /></span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="My week" description="Conversations in the next seven days" action={<Link href="/conversations" className="text-[12.5px] font-semibold text-ink underline decoration-accent decoration-[3px] underline-offset-[5px] hover:decoration-ink">All</Link>} />
              <CardBody>
                {upcoming.length === 0 ? <EmptyState title="No conversations booked" description="Book one from a person's profile." /> : (
                  <ul className="divide-y divide-line">
                    {upcoming.map((u) => (
                      <li key={u.id} className="py-2.5 flex items-center justify-between gap-2">
                        <PersonLink person={u.person} sub={u.meetingType.replace(/_/g, " ").toLowerCase()} />
                        <DateText date={u.startAt} relative className="text-xs text-ink-muted whitespace-nowrap" />
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Reconnect queue" description="Trusted people whose status is stale" action={<Link href="/network?freshness=stale" className="text-[12.5px] font-semibold text-ink underline decoration-accent decoration-[3px] underline-offset-[5px] hover:decoration-ink">All</Link>} />
              <CardBody>
                {reconnect.length === 0 ? <EmptyState title="Everyone is current" /> : (
                  <ul className="divide-y divide-line">
                    {reconnect.map((p) => (
                      <li key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                        <PersonLink person={p} />
                        <AvailabilityBadge status={p.availabilityStatus} confirmedAt={p.availabilityConfirmedAt} nextCheckDate={p.nextCheckDate} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          {showP23 ? (
          <Card>
            <CardHeader title="Opportunity intelligence" description="Open requirements by stage" action={<Link href="/opportunities" className="text-[12.5px] font-semibold text-ink underline decoration-accent decoration-[3px] underline-offset-[5px] hover:decoration-ink">Board</Link>} />
            <CardBody>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                {stageCounts.map((s) => (
                  <div key={s.stage} className="rounded-[12px] bg-surface-muted px-2 py-2.5 text-center">
                    <div className="text-[16px] font-semibold tabular text-ink leading-none">{s.count}</div>
                    <div className="text-[9.5px] uppercase tracking-[0.06em] text-ink-faint mt-1 truncate">{s.stage.toLowerCase()}</div>
                  </div>
                ))}
              </div>
              <ul className="divide-y divide-line">
                {activeOpps.slice(0, 5).map((o) => (
                  <li key={o.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/opportunities/${o.id}`} className="text-[13px] font-medium text-ink hover:underline underline-offset-4 truncate block">{o.title}</Link>
                      <div className="text-[12px] text-ink-faint">{o.clientName ?? "—"} · {ROUTE_LABELS[o.engagementRoute]} · {o.matches.length} suggestions, {o.matches.filter((m) => m.humanDecision === "RECOMMEND").length} recommended</div>
                    </div>
                    <StageBadge status={o.status} />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <InviteCard token={await networkInviteToken(user.tenantId)} />
          {showP23 ? (
          <Card>
            <CardHeader title="Amana Expert Network" description="Bench and live demand" action={<Link href="/amana" className="text-[12.5px] font-semibold text-ink underline decoration-accent decoration-[3px] underline-offset-[5px] hover:decoration-ink">Open</Link>} />
            <CardBody>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-semibold tabular">{people.filter((p) => p.amanaBench).length}</div><div className="text-[12px] text-ink-faint uppercase">bench</div></div>
                <div><div className="text-lg font-semibold tabular">{people.filter((p) => p.usedByAmana).length}</div><div className="text-[12px] text-ink-faint uppercase">used before</div></div>
                <div><div className="text-lg font-semibold tabular">{amanaDemand}</div><div className="text-[12px] text-ink-faint uppercase">open</div></div>
              </div>
            </CardBody>
          </Card>
          ) : null}
          <Card>
            <CardHeader title="Needs review" description="AI summaries waiting for a human" action={<Link href="/conversations?tab=review" className="text-[12.5px] font-semibold text-ink underline decoration-accent decoration-[3px] underline-offset-[5px] hover:decoration-ink">Review</Link>} />
            <CardBody>
              {needsReview.length === 0 ? <EmptyState title="Inbox zero" /> : (
                <ul className="divide-y divide-line">
                  {needsReview.map((c) => (
                    <li key={c.id} className="py-2.5 flex items-center justify-between gap-2">
                      <PersonLink person={c.person} sub={null} />
                      <Link href={`/conversations?tab=review&open=${c.id}`} className="text-[12.5px] font-semibold text-ink underline decoration-accent decoration-[3px] underline-offset-[5px] hover:decoration-ink">{c.approvalStatus === "DRAFT" ? "Draft" : "Review"}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          {showP23 ? (<>
          <Card>
            <CardHeader title="Partner activity" action={<Link href="/partners" className="text-[12.5px] font-semibold text-ink underline decoration-accent decoration-[3px] underline-offset-[5px] hover:decoration-ink">Partners</Link>} />
            <CardBody>
              {partnerReqs.length === 0 ? <EmptyState title="No open partner requirements" /> : (
                <ul className="divide-y divide-line">
                  {partnerReqs.map((r) => (
                    <li key={r.id} className="py-2.5">
                      <div className="text-[13px] text-ink">{r.title}</div>
                      <div className="text-[12px] text-ink-faint">{r.partner.name} · {r.status.replace(/_/g, " ").toLowerCase()}</div>
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
                    <li key={i.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0"><div className="text-[13px] text-ink truncate">{fullName(i.person)}</div><div className="text-[12px] text-ink-faint truncate">{i.opportunity.title}</div></div>
                      <IntroBadge status={i.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          </>) : null}
        </div>
      </div>
    </>
  );
}
