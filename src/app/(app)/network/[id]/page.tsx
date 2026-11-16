import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternal, getUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { canSeeMoney } from "@/lib/authz";
import { canViewRelationshipNotes } from "@/lib/authz";
import { assessFreshness } from "@/lib/availability";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Tabs, EmptyState, Section, Facts } from "@/components/ui/page";
import { MoreMenu } from "@/components/ui/more-menu";
import { Badge, Chip } from "@/components/ui/badge";
import { AvailabilityBadge, DecisionBadge, RouteBadge, StageBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { AvailabilityDrawer, EditProfileDrawer, AddRelationshipDrawer, AddEvidenceDrawer, ScheduleDrawer, CaptureConversationDrawer, RelocationDrawer } from "@/components/domain/person-drawers";
import { fullName } from "@/lib/utils";
import { TrustCard, FitCard, VouchList, ScreeningBadge } from "@/components/domain/trust";
import { VouchDrawer } from "@/components/domain/member-drawers";
import { InviteContactDrawer } from "@/components/domain/invite-drawers";
import { mergeRegistration } from "@/server/actions/invites";
import { startScreening } from "@/server/actions/members";
import { trustFor, fitFor } from "@/lib/trust-for";
import { ReferDrawer, type ReferTarget } from "@/components/domain/refer";
import { ReferredCard, type ReferredRow } from "@/components/domain/referred-card";
import { toDomain } from "@/lib/brief-domain";
import { loadRateCard } from "@/server/queries";
import { estimateFee, PORTAL_VISIBLE, FEE_STATUS_LABELS, type AccountKind, type ShortlistDecision } from "@/lib/demand";
import { ROUTE_LABELS } from "@/lib/labels";
import { SubmitButton } from "@/components/ui/submit-button";
import { ClipboardList, GitMerge, MessagesSquare } from "lucide-react";
import { ProvenanceThread } from "@/components/domain/provenance";
import { SENIORITY_LABELS, SOURCE_LABELS, RELATIONSHIP_LABELS, EVIDENCE_LABELS, ADVISORY_LABELS } from "@/lib/labels";
import type { ExtractedSummary } from "@/lib/ai";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getUser();
  const p = viewer ? await prisma.person.findFirst({ where: { id, tenantId: viewer.tenantId }, select: { firstName: true, lastName: true, preferredName: true } }) : null;
  return { title: p ? fullName(p) : "Person" };
}

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireInternal();
  const money = canSeeMoney(user);
  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      relationships: { include: { networkOwner: { select: { name: true } }, introducedBy: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
      vouches: { include: { voucherUser: { select: { name: true } }, voucherPerson: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
      referralsMade: { select: { status: true } },
      evidence: { include: { observer: { select: { name: true } } }, orderBy: { dateObserved: "desc" } },
      conversations: { include: { conductedBy: { select: { name: true } } }, orderBy: { date: "desc" } },
      matches: { include: { opportunity: true }, orderBy: { updatedAt: "desc" } },
      introductions: { include: { opportunity: { select: { title: true } } } },
      relocationProfile: true,
      scheduledMeetings: { where: { status: "SCHEDULED" }, orderBy: { startAt: "asc" } },
      introducedPeople: { include: { person: { select: { id: true, firstName: true, lastName: true, headline: true } } } },
      teamMemberships: { include: { opportunity: { select: { id: true, title: true } } } },
      memberUser: { select: { id: true } },
    },
  });
  if (!person || person.tenantId !== user.tenantId) notFound(); // object-level check; never reveal existence across tenants
  // Someone who registered themselves may already have been a contact here. Offer to join the two
  // up — a person decides, because an email typed into a form is not proof of who someone is.
  const twin = person.memberUser
    ? await prisma.person.findFirst({ where: { tenantId: user.tenantId, id: { not: person.id }, memberUser: null, OR: [...(person.email ? [{ email: { equals: person.email, mode: "insensitive" as const } }] : []), { firstName: { equals: person.firstName, mode: "insensitive" as const }, lastName: { equals: person.lastName, mode: "insensitive" as const } }] }, select: { id: true, firstName: true, lastName: true, headline: true } })
    : null;
  const canMerge = user.role === "OWNER" || user.role === "ADMIN";

  const [trust, fit, users] = await Promise.all([trustFor(person), fitFor(person), prisma.user.findMany({ where: { tenantId: user.tenantId, role: { in: ["OWNER", "ADMIN", "CONTRIBUTOR"] } }, select: { id: true, name: true } })]);
  const [audit, allPeople, connections] = await Promise.all([
    prisma.auditLog.findMany({ where: { tenantId: user.tenantId, OR: [{ entityId: id }, { metadata: { path: ["personId"], equals: id } }] }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.person.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
    prisma.schedulingConnection.findMany({ where: { userId: user.id, revokedAt: null }, select: { provider: true } }),
  ]);

  // Where this person has been put forward, and who we could still refer them to.
  const [shortlisted, openAccounts, card] = await Promise.all([
    prisma.shortlistItem.findMany({ where: { personId: id, OR: [{ referred: true }, { decision: { in: PORTAL_VISIBLE } }] }, include: { brief: { include: { account: { select: { name: true, kind: true } }, feeLines: { where: { personId: id }, take: 1 } } } }, orderBy: { updatedAt: "desc" } }),
    prisma.commercialAccount.findMany({ where: { tenantId: user.tenantId, status: { not: "PAUSED" } }, include: { briefs: { where: { status: { notIn: ["FILLED", "CLOSED"] } }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, engagementRoute: true, headcount: true, shortlist: { where: { personId: id }, select: { decision: true } } } } }, orderBy: { name: "asc" } }),
    loadRateCard(user.tenantId),
  ]);
  const referredRows: ReferredRow[] = await Promise.all(shortlisted.map(async (s) => {
    const d = toDomain(s.brief);
    const est = estimateFee({ ...d, headcount: 1 }, d.terms, card, d.expertHours);
    const fee = s.brief.feeLines[0];
    return {
      itemId: s.id, briefId: s.briefId, briefTitle: s.brief.title, routeLabel: s.brief.engagementRoute ? ROUTE_LABELS[s.brief.engagementRoute] : "Route to confirm",
      accountName: s.brief.account.name, kind: s.brief.account.kind as AccountKind, decision: s.decision as ShortlistDecision, referred: s.referred,
      clientNote: s.clientNote, updatedAt: s.updatedAt,
      fee: fee ? { ourTake: Number(fee.ourTake), currency: fee.currency, statusLabel: FEE_STATUS_LABELS[fee.status].toLowerCase() } : null,
      estimate: { ourTake: est.ourTake, currency: est.currency, basis: est.basis, confident: est.confident },
    };
  }));
  const referTargets: ReferTarget[] = openAccounts.map((a) => ({
    accountId: a.id, accountName: a.name, kindLabel: a.kind === "AGENCY" ? "Agency" : a.kind === "CLIENT" ? "Client" : "Expert network",
    briefs: a.briefs.map((b) => ({ id: b.id, label: `${b.title} · ${b.engagementRoute ? ROUTE_LABELS[b.engagementRoute] : "route to confirm"}${b.headcount > 1 ? ` × ${b.headcount}` : ""}`, already: b.shortlist.some((x) => PORTAL_VISIBLE.includes(x.decision as ShortlistDecision)) })),
  }));
  const referSuggestion = person.vouches.find((v) => v.statement)?.statement ?? person.relationships.find((r) => r.workedTogetherContext)?.workedTogetherContext ?? person.headline ?? "";

  const showNotes = canViewRelationshipNotes(user, person.tenantId);
  const freshness = assessFreshness({ availabilityStatus: person.availabilityStatus, availabilityConfirmedAt: person.availabilityConfirmedAt, nextCheckDate: person.nextCheckDate });
  const approved = person.conversations.filter((c) => c.approvalStatus === "APPROVED");
  const latestSummary = approved[0]?.approvedSummary as ExtractedSummary | null | undefined;

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "relationships", label: "Relationships", count: person.relationships.length },
    { key: "evidence", label: "Evidence", count: person.evidence.length },
    { key: "conversations", label: "Conversations", count: person.conversations.length },
    { key: "opportunities", label: "Opportunities", count: person.matches.length },
    { key: "relocation", label: "Relocation" },
    { key: "activity", label: "Activity", count: audit.length },
  ];

  return (
    <>
      {twin ? (
        <div className="mb-4 flex flex-col gap-3 rounded-[18px] border border-amber/30 bg-amber-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-[13.5px] text-ink"><GitMerge className="h-4 w-4 flex-none mt-0.5 text-amber" /><span><b>{fullName(person)} registered, and you already had <Link href={`/network/${twin.id}`} className="underline underline-offset-4">{fullName(twin)}</Link> as a contact.</b> If they are the same person, join them up: the new login moves onto the existing profile and nothing you recorded is lost.</span></div>
          {canMerge ? <form action={mergeRegistration} className="flex-none"><input type="hidden" name="newPersonId" value={person.id} /><input type="hidden" name="existingPersonId" value={twin.id} /><SubmitButton size="sm" pendingText="Joining up…">Same person: join them up</SubmitButton></form> : <span className="text-[12.5px] text-ink-muted flex-none">An owner or admin can join them up.</span>}
        </div>
      ) : null}
      <div className="rounded-[22px] border border-line bg-surface p-5 sm:p-6 mb-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <Avatar person={person} size="xl" />
            <div className="min-w-0">
              <h1 className="font-display text-[24px] sm:text-[28px] leading-[1.15]">{fullName(person)}</h1>
              <div className="text-[14.5px] text-ink-muted mt-1">{person.headline ?? "No headline yet"}</div>
              {[person.currentRole, person.currentCompany, [person.primaryCity, person.primaryCountry].filter(Boolean).join(", ")].filter(Boolean).length ? (
                <div className="text-[13px] text-ink-faint mt-1">{[[person.currentRole, person.currentCompany].filter(Boolean).join(" at "), [person.primaryCity, person.primaryCountry].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <AvailabilityBadge status={person.availabilityStatus} confirmedAt={person.availabilityConfirmedAt} nextCheckDate={person.nextCheckDate} />
                {person.engagementPreferences.map((r) => <RouteBadge key={r} route={r} />)}
                {person.amanaBench ? <Badge tone="teal" filled>Amana bench</Badge> : null}
                {person.relocationInterest ? <Badge filled>relocation</Badge> : null}
                {person.memberSince ? <Badge tone="teal" filled>network member</Badge> : null}
                <ScreeningBadge status={person.screeningStatus} />
              </div>
            </div>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            <ReferDrawer personId={person.id} personName={fullName(person)} targets={referTargets} suggestion={referSuggestion} showFees={money} />
            <ScheduleDrawer personId={person.id} connections={connections.map((c) => c.provider)} />
            <MoreMenu>
              <form action={startScreening}><input type="hidden" name="personId" value={person.id} /><SubmitButton size="sm" variant="secondary" pendingText="Starting…"><ClipboardList className="h-3.5 w-3.5" /> Start screening call</SubmitButton></form>
              <CaptureConversationDrawer personId={person.id} />
              <AvailabilityDrawer person={person} />
              <EditProfileDrawer person={person} />
              {person.memberUser ? null : <InviteContactDrawer person={{ id: person.id, name: fullName(person), email: person.email }} network={user.tenantName} from={user.name.split(" ")[0]} label="Invite to join" />}
            </MoreMenu>
          </div>
        </div>
        {person.relationships[0] ? (
          <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="label-caps text-ink-faint">How you know them</span>
            <ProvenanceThread owner={person.relationships[0].networkOwner} introducer={person.relationships[0].introducedBy} person={person} workedTogether={person.relationships[0].workedTogether} />
          </div>
        ) : null}
      </div>

      <Tabs items={tabs} current={tab} base={`/network/${person.id}`} />

      {tab === "overview" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <Card>
              <CardHeader title="What we know" description={latestSummary ? `From the approved conversation on ${approved[0].date.toLocaleDateString("en-GB")}` : "No approved conversation yet — book one."} />
              <CardBody>
                {latestSummary ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                    <div><div className="label-caps text-ink-faint mb-1">Summary</div><p className="text-ink">{latestSummary.summary}</p></div>
                    <div><div className="label-caps text-ink-faint mb-1">Current status</div><p>{latestSummary.currentStatus || "—"}</p><div className="label-caps text-ink-faint mb-1 mt-3">Rates / salary</div><p>{latestSummary.ratesOrSalary || "—"}</p></div>
                    <div><div className="label-caps text-ink-faint mb-1">Strengths</div><ul className="list-disc pl-4 space-y-0.5">{latestSummary.strengths.map((s) => <li key={s}>{s}</li>)}{!latestSummary.strengths.length && <li className="list-none text-ink-faint">—</li>}</ul></div>
                    <div><div className="label-caps text-ink-faint mb-1">Does not want</div><ul className="list-disc pl-4 space-y-0.5">{latestSummary.avoid.map((s) => <li key={s}>{s}</li>)}{!latestSummary.avoid.length && <li className="list-none text-ink-faint">—</li>}</ul></div>
                    <div><div className="label-caps text-ink-faint mb-1">Working characteristics</div><ul className="list-disc pl-4 space-y-0.5">{latestSummary.workingCharacteristics.map((s) => <li key={s}>{s}</li>)}{!latestSummary.workingCharacteristics.length && <li className="list-none text-ink-faint">—</li>}</ul></div>
                    <div><div className="label-caps text-ink-faint mb-1">Constraints</div><ul className="list-disc pl-4 space-y-0.5">{latestSummary.constraints.map((s) => <li key={s}>{s}</li>)}{!latestSummary.constraints.length && <li className="list-none text-ink-faint">—</li>}</ul></div>
                    {latestSummary.unresolvedQuestions.length ? <div className="md:col-span-2 rounded-md bg-amber-100/60 border border-amber/20 p-3"><div className="label-caps text-amber mb-1">Still to find out</div><ul className="list-disc pl-4 space-y-0.5 text-ink">{latestSummary.unresolvedQuestions.map((s) => <li key={s}>{s}</li>)}</ul></div> : null}
                  </div>
                ) : <EmptyState icon={MessagesSquare} title="No conversation on record yet" description="Book a conversation, capture the notes, and approve the summary. It then appears here." />}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Profile" description="What they do, and when they are free" />
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                  <div>
                    <div className="label-caps text-ink-faint mb-2">Expertise</div>
                    {person.capabilities.length ? <div className="flex flex-wrap gap-1.5">{person.capabilities.map((c) => <Chip key={c}>{c}</Chip>)}</div> : <p className="text-[13px] text-ink-faint">None recorded yet. The screening captures it.</p>}
                    {person.sectors.length ? <><div className="label-caps text-ink-faint mt-4 mb-2">Sectors</div><div className="flex flex-wrap gap-1.5">{person.sectors.map((c) => <Chip key={c}>{c}</Chip>)}</div></> : null}
                    <Facts className="mt-5" rows={[
                      { label: "Seniority", value: person.seniority ? SENIORITY_LABELS[person.seniority] : null },
                      { label: "Rate", value: person.rateExpectation },
                      { label: "Salary", value: person.salaryExpectation },
                      { label: "Notice", value: person.noticePeriod },
                      { label: "Target locations", value: person.targetLocations.join(", ") },
                    ]} />
                  </div>
                  <div>
                    <div className="label-caps text-ink-faint mb-2">Availability</div>
                    <Facts rows={[
                      { label: "Status", value: <AvailabilityBadge status={person.availabilityStatus} confirmedAt={person.availabilityConfirmedAt} nextCheckDate={person.nextCheckDate} /> },
                      { label: "Last confirmed", value: person.availabilityConfirmedAt ? <DateText date={person.availabilityConfirmedAt} relative /> : null },
                      { label: "Told us by", value: person.availabilitySource },
                      { label: "Next check", value: person.nextCheckDate ? <DateText date={person.nextCheckDate} relative /> : null },
                      { label: "How current", value: freshness === "fresh" ? <span className="text-teal">Fresh</span> : freshness === "aging" ? "Ageing" : <span className="text-amber capitalize">{freshness}</span> },
                    ]} />
                    {person.nextAction ? <div className="mt-4 rounded-[12px] bg-surface-muted px-3 py-2.5 text-[13px]"><span className="text-ink-muted">Next action: </span><span className="font-medium">{person.nextAction}</span> <DateText date={person.nextActionDate} relative className="text-ink-faint" /></div> : null}
                  </div>
                </div>
              </CardBody>
            </Card>
            <FitCard rows={fit} />
          </div>
          <div className="space-y-4">
            <TrustCard t={trust} firstName={person.firstName} screened={person.screeningStatus === "APPROVED" || !!person.screenedAt} workedWith={person.relationships.some((r) => r.workedTogether)} action={<VouchDrawer personId={person.id} personName={fullName(person)} users={users} people={allPeople.filter((x) => x.id !== person.id).map((x) => ({ id: x.id, name: fullName(x) }))} />} />
            <ReferredCard rows={referredRows} showFees={money} action={<ReferDrawer personId={person.id} personName={fullName(person)} targets={referTargets} suggestion={referSuggestion} variant="secondary" size="sm" label="Refer" showFees={money} />} />
            {person.vouches.length ? <VouchList vouches={person.vouches} /> : null}
            <Card>
              <CardHeader title="Details" />
              <CardBody className="space-y-5">
                <div>
                  <div className="label-caps text-ink-faint mb-2">Who knows them</div>
                  <ul className="space-y-2.5">
                    {person.relationships.map((r) => (
                      <li key={r.id} className="text-[13px]">
                        <div className="font-medium text-ink">{r.networkOwner.name} · {RELATIONSHIP_LABELS[r.relationshipType]}</div>
                        <div className="text-ink-muted">{SOURCE_LABELS[r.sourceType]}{r.introducedBy ? <> · via <Link href={`/network/${r.introducedBy.id}`} className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">{r.introducedBy.firstName} {r.introducedBy.lastName}</Link></> : null}{r.yearsKnown ? ` · ${r.yearsKnown}y` : ""}</div>
                        {r.wouldWorkTogetherAgain === true ? <div className="text-teal">Would work together again</div> : r.wouldWorkTogetherAgain === false ? <div className="text-risk">Would not work together again</div> : null}
                      </li>
                    ))}
                  </ul>
                </div>
                {person.scheduledMeetings.length ? (
                  <div className="pt-5 border-t border-line">
                    <div className="label-caps text-ink-faint mb-2">Coming up</div>
                    <ul className="space-y-1.5 text-[13px]">{person.scheduledMeetings.map((m) => <li key={m.id} className="flex justify-between gap-3"><span className="capitalize">{m.meetingType.replace(/_/g, " ").toLowerCase()} · {m.provider === "MANUAL" ? "manual" : m.provider === "CALENDLY" ? "Calendly" : "Outlook"}</span><DateText date={m.startAt} relative className="text-ink-faint" /></li>)}</ul>
                  </div>
                ) : null}
                {person.introducedPeople.length ? (
                  <div className="pt-5 border-t border-line">
                    <div className="label-caps text-ink-faint mb-2">Has introduced</div>
                    <ul className="space-y-1.5 text-[13px]">{person.introducedPeople.map((r) => <li key={r.id}><Link href={`/network/${r.person.id}`} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">{r.person.firstName} {r.person.lastName}</Link>{r.person.headline ? <span className="text-ink-faint"> · {r.person.headline}</span> : null}</li>)}</ul>
                  </div>
                ) : null}
                <div className="pt-5 border-t border-line">
                  <div className="label-caps text-ink-faint mb-2">Contact</div>
                  <Facts rows={[
                    { label: "Email", value: person.email ? <span className="break-all">{person.email}</span> : null },
                    { label: "Phone", value: person.phone },
                    { label: "LinkedIn", value: person.linkedinUrl ? <a href={person.linkedinUrl} className="underline decoration-line-strong underline-offset-4 hover:decoration-ink" rel="noreferrer noopener" target="_blank">Open profile</a> : null },
                  ]} />
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "relationships" ? (
        <Section title="Relationships" description="Relationship provenance and private notes. Notes never leave this tenant." action={<AddRelationshipDrawer personId={person.id} people={allPeople} />}>
          <div className="rounded-[22px] border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
            <table className="data">
              <thead><tr><th>Known by</th><th>Type</th><th>Source</th><th>Worked together</th><th>Years</th><th>Again?</th><th>Last contact</th>{showNotes ? <th>Private notes</th> : null}</tr></thead>
              <tbody>
                {person.relationships.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.networkOwner.name}</td>
                    <td>{RELATIONSHIP_LABELS[r.relationshipType]}</td>
                    <td>{SOURCE_LABELS[r.sourceType]}{r.introducedBy ? <div className="text-[12px] text-ink-faint">via {r.introducedBy.firstName} {r.introducedBy.lastName}</div> : null}</td>
                    <td>{r.workedTogether ? <><Badge tone="teal">yes</Badge>{r.workedTogetherContext ? <div className="text-[12px] text-ink-muted mt-1 max-w-[260px]">{r.workedTogetherContext}</div> : null}</> : <span className="text-ink-faint">no</span>}</td>
                    <td className="tabular">{r.yearsKnown ?? "—"}</td>
                    <td>{r.wouldWorkTogetherAgain === true ? <span className="text-teal">Yes</span> : r.wouldWorkTogetherAgain === false ? <span className="text-risk">No</span> : "—"}</td>
                    <td><DateText date={r.lastContactDate} relative /></td>
                    {showNotes ? <td className="text-ink-muted max-w-[320px]">{r.relationshipNotes ?? "—"}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {tab === "evidence" ? (
        <Section title="Observed evidence" description="What trusted people have directly seen them deliver." action={<AddEvidenceDrawer personId={person.id} />}>
          {person.evidence.length === 0 ? <EmptyState title="No evidence yet" description="This is an evidence gap. Record what you or someone you trust has seen." /> : (
            <div className="space-y-2">
              {person.evidence.map((e) => (
                <Card key={e.id} className={e.evidenceType === "CAUTION" ? "border-amber/40" : ""}>
                  <CardBody className="pt-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2"><Badge tone={e.evidenceType === "CAUTION" ? "amber" : "teal"}>{EVIDENCE_LABELS[e.evidenceType]}</Badge><span className="text-xs text-ink-muted">{e.context}</span></div>
                      <div className="text-[12px] text-ink-faint">{e.observer.name} · <DateText date={e.dateObserved} /> · confidence {e.confidence}% · {e.visibility.toLowerCase().replace("_", " ")}</div>
                    </div>
                    <p className="text-[13px]">{e.description}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </Section>
      ) : null}

      {tab === "conversations" ? (
        <Section title="Conversations" description="The profile is the ongoing record of the relationship." action={<CaptureConversationDrawer personId={person.id} />}>
          {person.conversations.length === 0 ? <EmptyState title="No conversations recorded" /> : (
            <div className="space-y-2">
              {person.conversations.map((c) => {
                const s = (c.approvedSummary ?? c.aiSummary) as ExtractedSummary | null;
                return (
                  <Card key={c.id}>
                    <CardBody className="pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-medium"><DateText date={c.date} /> · {c.type.replace(/_/g, " ").toLowerCase()} · {c.conductedBy.name}</div>
                        <div className="flex items-center gap-2">
                          <Badge tone={c.approvalStatus === "APPROVED" ? "teal" : c.approvalStatus === "NEEDS_REVIEW" ? "amber" : "neutral"}>{c.approvalStatus.replace(/_/g, " ").toLowerCase()}</Badge>
                          {c.approvalStatus !== "APPROVED" ? <Link href={`/conversations?tab=review&open=${c.id}`} className="text-[12.5px] font-semibold text-ink underline decoration-accent decoration-[3px] underline-offset-[5px] hover:decoration-ink">Review</Link> : null}
                        </div>
                      </div>
                      {s?.summary ? <p className="text-[13px] mt-2">{s.summary}</p> : null}
                      {c.rawNotes ? <details className="mt-2"><summary className="text-xs text-ink-faint cursor-pointer">Raw notes</summary><p className="text-xs text-ink-muted whitespace-pre-wrap mt-1">{c.rawNotes}</p></details> : null}
                      {c.followUpDate ? <div className="text-[12px] text-ink-faint mt-2">Follow up <DateText date={c.followUpDate} relative /></div> : null}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </Section>
      ) : null}

      {tab === "opportunities" ? (
        <Section title="Opportunities" description="Where this person has been considered. Scores are per-opportunity, never a global rank.">
          {person.matches.length === 0 && person.teamMemberships.length === 0 ? <EmptyState title="Not yet considered for an opportunity" /> : (
            <div className="rounded-[22px] border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
              <table className="data">
                <thead><tr><th>Opportunity</th><th>Route</th><th>Stage</th><th>Fit</th><th>Human decision</th><th>Notes</th></tr></thead>
                <tbody>
                  {person.matches.map((m) => (
                    <tr key={m.id}>
                      <td><Link href={`/opportunities/${m.opportunity.id}`} className="font-medium text-ink hover:underline underline-offset-4">{m.opportunity.title}</Link><div className="text-[12px] text-ink-faint">{m.opportunity.clientName}</div></td>
                      <td><RouteBadge route={m.opportunity.engagementRoute} /></td>
                      <td><StageBadge status={m.opportunity.status} /></td>
                      <td className="tabular">{m.fitScore}</td>
                      <td><DecisionBadge decision={m.humanDecision} /></td>
                      <td className="text-xs text-ink-muted max-w-[280px]">{m.humanNotes ?? "—"}</td>
                    </tr>
                  ))}
                  {person.teamMemberships.map((t) => (
                    <tr key={t.id}><td><Link href={`/opportunities/${t.opportunity.id}`} className="font-medium text-ink hover:underline">{t.opportunity.title}</Link><div className="text-[12px] text-ink-faint">Amana team shortlist</div></td><td colSpan={4}><Badge tone="teal">{t.roleOnTeam}</Badge></td><td className="text-xs text-ink-muted">{t.notes ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      ) : null}

      {tab === "relocation" ? (
        <Section title="Relocation" description="Location context lives in the relationship profile. Advisory is a separate, optional paid service." action={<RelocationDrawer personId={person.id} profile={person.relocationProfile} />}>
          {!person.relocationProfile ? <EmptyState title="No relocation profile" description="Capture interest if it comes up in conversation." /> : (
            <Card>
              <CardBody className="pt-4">
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div><dt className="text-ink-faint">From</dt><dd className="text-[13px]">{person.relocationProfile.currentLocation ?? "—"}</dd></div>
                  <div><dt className="text-ink-faint">To</dt><dd className="text-[13px]">{person.relocationProfile.targetLocation ?? "—"}</dd></div>
                  <div><dt className="text-ink-faint">Window</dt><dd className="text-[13px]">{person.relocationProfile.targetMoveWindow ?? "—"}</dd></div>
                  <div><dt className="text-ink-faint">Advisory</dt><dd><Badge tone={person.relocationProfile.advisoryStatus === "ACTIVE" ? "teal" : "neutral"}>{ADVISORY_LABELS[person.relocationProfile.advisoryStatus]}</Badge></dd></div>
                </dl>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {person.relocationProfile.familyMove ? <Chip>family move</Chip> : null}
                  {person.relocationProfile.schoolGuidanceInterest ? <Chip>schools</Chip> : null}
                  {person.relocationProfile.housingGuidanceInterest ? <Chip>housing</Chip> : null}
                  {person.relocationProfile.relocationAdvisoryInterest ? <Chip>wants advisory</Chip> : null}
                  <Chip>{person.relocationProfile.employerSponsored ? "employer funded" : "individually funded"}</Chip>
                </div>
                {person.relocationProfile.notes ? <p className="text-[13px] mt-3">{person.relocationProfile.notes}</p> : null}
              </CardBody>
            </Card>
          )}
        </Section>
      ) : null}

      {tab === "activity" ? (
        <Section title="Activity" description="Audit trail of sensitive actions on this record.">
          {audit.length === 0 ? <EmptyState title="No activity recorded" /> : (
            <div className="rounded-[22px] border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
              <table className="data"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
                <tbody>{audit.map((a) => <tr key={a.id}><td><DateText date={a.createdAt} relative /></td><td>{a.actor?.name ?? "system"}</td><td className="font-mono text-[12px]">{a.action}</td><td>{a.entityType}</td><td className="text-xs text-ink-muted font-mono">{a.metadata ? JSON.stringify(a.metadata) : ""}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Section>
      ) : null}
    </>
  );
}
