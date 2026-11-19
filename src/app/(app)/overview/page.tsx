import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { canSeeMoney } from "@/lib/authz";
import { assessFreshness, ACTIVE_STATUSES } from "@/lib/availability";
import { NetworkGraph } from "@/components/domain/network-graph";
import { buildNetworkMap } from "@/server/network-map";
import { EmptyState } from "@/components/ui/page";
import { formatMoneyCompact, fullName } from "@/lib/utils";
import { AddPersonDrawer } from "@/components/domain/add-person-drawer";
import { Button } from "@/components/ui/button";
import { Upload, UserSearch, ListChecks, FileCheck2, RefreshCw, Handshake, ArrowRight, Users, Briefcase, TrendingUp, UserCheck } from "lucide-react";
import { AgentComposer } from "@/components/domain/agent-composer";

// What the agent has queued for you, by the kind of decision it needs.
type QueueKind = "match" | "review" | "approve" | "reconnect" | "intro";
const QUEUE: Record<QueueKind, { tag: string; verb: string; icon: typeof UserSearch }> = {
  match: { tag: "Matching", verb: "Run", icon: UserSearch },
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

  const [people, opportunities, introductions, needsReview, partnerReqs, existingPeopleForDrawer] = await Promise.all([
    prisma.person.findMany({ where: { tenantId: t }, include: { relationships: { select: { workedTogether: true, lastContactDate: true, introducedById: true } }, evidence: { select: { id: true } }, conversations: { select: { approvalStatus: true } } } }),
    prisma.opportunity.findMany({ where: { tenantId: t }, include: { matches: { select: { humanDecision: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.introduction.findMany({ where: { tenantId: t }, include: { person: true, opportunity: { select: { title: true } } }, orderBy: { updatedAt: "desc" } }),
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

  // The same living map as /network/map — real trust scores and real role matches — in a compact frame.
  const { nodes: mapNodes, links: mapLinks } = await buildNetworkMap(user, now);

  const counts = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const topCaps = counts(mapNodes.flatMap((n) => n.capabilities ?? []));
  const topCities = counts(mapNodes.map((n) => n.city?.split(",")[0]).filter((c): c is string => !!c));
  const askSuggestions = [
    topCaps[0] ? `${topCaps[0]}, available now` : null,
    topCities[0] ? `People in ${topCities[0]}` : null,
    topCaps[1] ? `${topCaps[1]} we have worked with` : null,
  ].filter((x): x is string => !!x);

  return (
    <>
      {/* A greeting and the question box: the agent is the first thing on the page. */}
      <section className="max-w-[760px] pt-6 pb-10 sm:pt-10">
        <p className="text-[13px] text-ink-faint">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="hero-title mt-2 text-[32px] sm:text-[40px]">Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, {user.name.split(" ")[0]}</h1>
        <p className="mt-2 mb-6 text-[15px] text-ink-muted">Ask for anyone in plain words. I search everyone you know and rank them by trust.</p>
        <AgentComposer suggestions={askSuggestions} />
      </section>

      {/* Headline numbers. Each one opens the list behind it. */}
      <div className="figures mb-10">
        {(showP23
          ? [
              { label: "People in the network", value: total, hint: `${workedWith} you've worked with`, href: "/network", delta: last7(peopleDates), icon: Users },
              { label: "Live opportunities", value: activeOpps.length, hint: amanaDemand ? `${amanaDemand} via Amana` : "open requirements", href: "/opportunities", delta: last7(oppDates), icon: Briefcase },
              { label: "Introductions in flight", value: liveIntros.length, hint: "waiting on a reply or a meeting", href: "/opportunities", delta: last7(introDates), icon: Handshake },
              // The money line is the owner's alone; everyone else sees how the network is growing instead.
              canSeeMoney(user)
                ? { label: "Indicative pipeline", value: formatMoneyCompact(pipeline), hint: "rough, not a forecast · only you see this", href: "/requirements", delta: 0, icon: TrendingUp }
                : { label: "Members joined", value: members, hint: `${awaitingScreening} waiting on screening`, href: "/invite", delta: 0, icon: TrendingUp },
            ]
          : [
              { label: "People in the network", value: total, hint: `${workedWith} you've worked with`, href: "/network", delta: last7(peopleDates), icon: Users },
              { label: "Signed up", value: members, hint: "members in your network", href: "/network", delta: 0, icon: UserCheck },
              { label: "Awaiting screening", value: awaitingScreening, hint: "registered, not yet screened", href: "/conversations", delta: 0, icon: ListChecks },
              { label: "Worked with", value: workedWith, hint: "people you've delivered with", href: "/network?workedWith=1", delta: 0, icon: Handshake },
            ]
        ).map((k) => (
          <Link key={k.label} href={k.href} className="figure group">
            <span className="block text-[12.5px] font-medium text-ink-muted leading-tight">{k.label}</span>
            <span className="mt-2 block hero-title text-[30px] sm:text-[34px] leading-none tabular">{k.value}</span>
            <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-faint">
              {k.delta ? <span className="font-semibold text-teal">+{k.delta} this week</span> : null}
              <span>{k.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      <section className="mb-10" aria-labelledby="home-queue">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="home-queue" className="section-title text-[20px]">Waiting on you</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/network/import"><Button variant="secondary"><Upload className="h-3.5 w-3.5" /> Import contacts</Button></Link>
            <AddPersonDrawer people={existingPeopleForDrawer} />
          </div>
        </div>
        {suggestions.length === 0 ? <EmptyState title="Nothing waiting" description="New matches, reviews and people to reconnect with appear here." /> : (
          <ul className="divide-y divide-line rounded-[16px] border border-line bg-surface">
            {suggestions.map((s, i) => {
              const k = QUEUE[s.kind]; const Icon = k.icon;
              return (
                <li key={i}>
                  <Link href={s.href} className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-hover">
                    <Icon className="h-4 w-4 flex-none text-ink-faint" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-ink">{s.text}</span>
                      <span className="block text-[12px] text-ink-faint">{k.tag}</span>
                    </span>
                    <span className="inline-flex flex-none items-center gap-1 text-[13px] font-medium text-ink-muted transition-colors group-hover:text-ink">{k.verb} <ArrowRight className="h-3.5 w-3.5" /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* The network itself: the one picture on the page. */}
      {people.length > 1 ? (
        <section className="mb-6" aria-labelledby="home-map">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 id="home-map" className="section-title text-[20px]">Your network</h2>
            <Link href="/network/map" className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">Open the full map <ArrowRight className="arrow-badge h-3.5 w-3.5" /></Link>
          </div>
          <NetworkGraph nodes={mapNodes} links={mapLinks} heightClass="h-[460px]" compact />
        </section>
      ) : null}

    </>
  );
}
