import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { canViewRelationshipNotes } from "@/lib/authz";
import { assessFreshness } from "@/lib/availability";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Tabs, EmptyState, Section } from "@/components/ui/page";
import { Badge, Chip } from "@/components/ui/badge";
import { AvailabilityBadge, DecisionBadge, RouteBadge, StageBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { AvailabilityDrawer, EditProfileDrawer, AddRelationshipDrawer, AddEvidenceDrawer, ScheduleDrawer, CaptureConversationDrawer, RelocationDrawer } from "@/components/domain/person-drawers";
import { fullName } from "@/lib/utils";
import { SENIORITY_LABELS, SOURCE_LABELS, RELATIONSHIP_LABELS, EVIDENCE_LABELS, ADVISORY_LABELS } from "@/lib/labels";
import type { ExtractedSummary } from "@/lib/ai";

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireInternal();
  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      relationships: { include: { networkOwner: { select: { name: true } }, introducedBy: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
      evidence: { include: { observer: { select: { name: true } } }, orderBy: { dateObserved: "desc" } },
      conversations: { include: { conductedBy: { select: { name: true } } }, orderBy: { date: "desc" } },
      matches: { include: { opportunity: true }, orderBy: { updatedAt: "desc" } },
      introductions: { include: { opportunity: { select: { title: true } } } },
      relocationProfile: true,
      scheduledMeetings: { where: { status: "SCHEDULED" }, orderBy: { startAt: "asc" } },
      introducedPeople: { include: { person: { select: { id: true, firstName: true, lastName: true, headline: true } } } },
      teamMemberships: { include: { opportunity: { select: { id: true, title: true } } } },
    },
  });
  if (!person || person.tenantId !== user.tenantId) notFound(); // object-level check; never reveal existence across tenants

  const [audit, allPeople, connections] = await Promise.all([
    prisma.auditLog.findMany({ where: { tenantId: user.tenantId, OR: [{ entityId: id }, { metadata: { path: ["personId"], equals: id } }] }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.person.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
    prisma.schedulingConnection.findMany({ where: { userId: user.id, revokedAt: null }, select: { provider: true } }),
  ]);

  const showNotes = canViewRelationshipNotes(user, person.tenantId);
  const freshness = assessFreshness({ availabilityStatus: person.availabilityStatus, availabilityConfirmedAt: person.availabilityConfirmedAt, nextCheckDate: person.nextCheckDate });
  const approved = person.conversations.filter((c) => c.approvalStatus === "APPROVED");
  const latestSummary = approved[0]?.approvedSummary as ExtractedSummary | null | undefined;
  const workedWith = person.relationships.filter((r) => r.workedTogether);

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
      <div className="mb-1 text-[11px] text-ink-faint"><Link href="/network" className="hover:text-ink">Network</Link> / {fullName(person)}</div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <Avatar person={person} size="lg" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{fullName(person)}</h1>
            <div className="text-[13px] text-ink-muted">{person.headline ?? "—"}</div>
            <div className="text-xs text-ink-faint mt-0.5">{[person.currentRole, person.currentCompany].filter(Boolean).join(" · ")}{person.primaryCity ? ` · ${[person.primaryCity, person.primaryCountry].filter(Boolean).join(", ")}` : ""}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <AvailabilityBadge status={person.availabilityStatus} confirmedAt={person.availabilityConfirmedAt} nextCheckDate={person.nextCheckDate} />
              {person.engagementPreferences.map((r) => <RouteBadge key={r} route={r} />)}
              {person.amanaBench ? <Badge tone="teal">Amana bench</Badge> : null}
              {workedWith.length ? <Badge tone="teal">worked with</Badge> : null}
              {person.relocationInterest ? <Badge>relocation</Badge> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <ScheduleDrawer personId={person.id} connections={connections.map((c) => c.provider)} />
          <CaptureConversationDrawer personId={person.id} />
          <AvailabilityDrawer person={person} />
          <EditProfileDrawer person={person} />
        </div>
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
                    <div><div className="text-[11px] uppercase text-ink-faint mb-1">Summary</div><p className="text-ink">{latestSummary.summary}</p></div>
                    <div><div className="text-[11px] uppercase text-ink-faint mb-1">Current status</div><p>{latestSummary.currentStatus || "—"}</p><div className="text-[11px] uppercase text-ink-faint mb-1 mt-3">Rates / salary</div><p>{latestSummary.ratesOrSalary || "—"}</p></div>
                    <div><div className="text-[11px] uppercase text-ink-faint mb-1">Strengths</div><ul className="list-disc pl-4 space-y-0.5">{latestSummary.strengths.map((s) => <li key={s}>{s}</li>)}{!latestSummary.strengths.length && <li className="list-none text-ink-faint">—</li>}</ul></div>
                    <div><div className="text-[11px] uppercase text-ink-faint mb-1">Does not want</div><ul className="list-disc pl-4 space-y-0.5">{latestSummary.avoid.map((s) => <li key={s}>{s}</li>)}{!latestSummary.avoid.length && <li className="list-none text-ink-faint">—</li>}</ul></div>
                    <div><div className="text-[11px] uppercase text-ink-faint mb-1">Working characteristics</div><ul className="list-disc pl-4 space-y-0.5">{latestSummary.workingCharacteristics.map((s) => <li key={s}>{s}</li>)}{!latestSummary.workingCharacteristics.length && <li className="list-none text-ink-faint">—</li>}</ul></div>
                    <div><div className="text-[11px] uppercase text-ink-faint mb-1">Constraints</div><ul className="list-disc pl-4 space-y-0.5">{latestSummary.constraints.map((s) => <li key={s}>{s}</li>)}{!latestSummary.constraints.length && <li className="list-none text-ink-faint">—</li>}</ul></div>
                    {latestSummary.unresolvedQuestions.length ? <div className="md:col-span-2 rounded-md bg-amber-100/60 border border-amber/20 p-3"><div className="text-[11px] uppercase text-amber mb-1">Still to find out</div><ul className="list-disc pl-4 space-y-0.5 text-ink">{latestSummary.unresolvedQuestions.map((s) => <li key={s}>{s}</li>)}</ul></div> : null}
                  </div>
                ) : <EmptyState title="Not yet in conversation" description="Book a conversation, capture notes, and approve the structured summary." />}
              </CardBody>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader title="Expertise" />
                <CardBody>
                  <div className="flex flex-wrap gap-1 mb-3">{person.capabilities.map((c) => <Chip key={c}>{c}</Chip>)}{!person.capabilities.length && <span className="text-xs text-ink-faint">None recorded</span>}</div>
                  <div className="text-[11px] uppercase text-ink-faint mb-1">Sectors</div>
                  <div className="flex flex-wrap gap-1">{person.sectors.map((c) => <Chip key={c}>{c}</Chip>)}{!person.sectors.length && <span className="text-xs text-ink-faint">—</span>}</div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-3">
                    <dt className="text-ink-faint">Seniority</dt><dd>{person.seniority ? SENIORITY_LABELS[person.seniority] : "—"}</dd>
                    <dt className="text-ink-faint">Rate</dt><dd>{person.rateExpectation ?? "—"}</dd>
                    <dt className="text-ink-faint">Salary</dt><dd>{person.salaryExpectation ?? "—"}</dd>
                    <dt className="text-ink-faint">Notice</dt><dd>{person.noticePeriod ?? "—"}</dd>
                    <dt className="text-ink-faint">Target locations</dt><dd>{person.targetLocations.join(", ") || "—"}</dd>
                  </dl>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Availability" />
                <CardBody>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-ink-faint">Status</dt><dd><AvailabilityBadge status={person.availabilityStatus} confirmedAt={person.availabilityConfirmedAt} nextCheckDate={person.nextCheckDate} /></dd>
                    <dt className="text-ink-faint">Last confirmed</dt><dd><DateText date={person.availabilityConfirmedAt} relative /></dd>
                    <dt className="text-ink-faint">Source</dt><dd>{person.availabilitySource ?? "—"}</dd>
                    <dt className="text-ink-faint">Confidence</dt><dd className="tabular">{person.availabilityConfidence}%</dd>
                    <dt className="text-ink-faint">Next check</dt><dd><DateText date={person.nextCheckDate} relative /></dd>
                    <dt className="text-ink-faint">Freshness</dt><dd>{freshness === "fresh" ? <span className="text-teal">fresh</span> : freshness === "aging" ? <span>aging</span> : <span className="text-amber">{freshness}</span>}</dd>
                  </dl>
                  {person.nextAction ? <div className="mt-3 rounded-md border border-line bg-surface-muted px-3 py-2 text-xs"><span className="text-ink-faint">Next action: </span>{person.nextAction} <DateText date={person.nextActionDate} relative className="text-ink-faint" /></div> : null}
                </CardBody>
              </Card>
            </div>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Provenance" description="Who knows them and how" />
              <CardBody>
                <ul className="space-y-2">
                  {person.relationships.map((r) => (
                    <li key={r.id} className="text-xs">
                      <div className="font-medium text-ink">{r.networkOwner.name} · {RELATIONSHIP_LABELS[r.relationshipType]}</div>
                      <div className="text-ink-muted">{SOURCE_LABELS[r.sourceType]}{r.introducedBy ? <> · via <Link href={`/network/${r.introducedBy.id}`} className="text-navy hover:underline">{r.introducedBy.firstName} {r.introducedBy.lastName}</Link></> : null}{r.yearsKnown ? ` · ${r.yearsKnown}y` : ""}</div>
                      {r.wouldWorkTogetherAgain === true ? <div className="text-teal">Would work together again</div> : r.wouldWorkTogetherAgain === false ? <div className="text-risk">Would not work together again</div> : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Upcoming" />
              <CardBody>
                {person.scheduledMeetings.length === 0 ? <div className="text-xs text-ink-faint">Nothing booked.</div> : (
                  <ul className="space-y-1 text-xs">{person.scheduledMeetings.map((m) => <li key={m.id} className="flex justify-between"><span>{m.meetingType.replace(/_/g, " ").toLowerCase()} · {m.provider === "MANUAL" ? "manual" : m.provider === "CALENDLY" ? "Calendly" : "Outlook"}</span><DateText date={m.startAt} relative className="text-ink-faint" /></li>)}</ul>
                )}
              </CardBody>
            </Card>
            {person.introducedPeople.length ? (
              <Card>
                <CardHeader title="Has introduced" />
                <CardBody><ul className="space-y-1 text-xs">{person.introducedPeople.map((r) => <li key={r.id}><Link href={`/network/${r.person.id}`} className="text-navy hover:underline">{r.person.firstName} {r.person.lastName}</Link> <span className="text-ink-faint">— {r.person.headline}</span></li>)}</ul></CardBody>
              </Card>
            ) : null}
            <Card>
              <CardHeader title="Contact" />
              <CardBody>
                <dl className="text-xs space-y-1">
                  <div className="flex justify-between gap-2"><dt className="text-ink-faint">Email</dt><dd className="truncate">{person.email ?? "—"}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-faint">Phone</dt><dd>{person.phone ?? "—"}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-faint">LinkedIn</dt><dd className="truncate">{person.linkedinUrl ? <a href={person.linkedinUrl} className="text-navy hover:underline" rel="noreferrer noopener" target="_blank">profile</a> : "—"}</dd></div>
                </dl>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "relationships" ? (
        <Section title="Relationships" description="Relationship provenance and private notes. Notes never leave this tenant." action={<AddRelationshipDrawer personId={person.id} people={allPeople} />}>
          <div className="rounded-lg border border-line bg-surface overflow-hidden">
            <table className="data">
              <thead><tr><th>Known by</th><th>Type</th><th>Source</th><th>Worked together</th><th>Years</th><th>Again?</th><th>Last contact</th>{showNotes ? <th>Private notes</th> : null}</tr></thead>
              <tbody>
                {person.relationships.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.networkOwner.name}</td>
                    <td>{RELATIONSHIP_LABELS[r.relationshipType]}</td>
                    <td>{SOURCE_LABELS[r.sourceType]}{r.introducedBy ? <div className="text-[11px] text-ink-faint">via {r.introducedBy.firstName} {r.introducedBy.lastName}</div> : null}</td>
                    <td>{r.workedTogether ? <><Badge tone="teal">yes</Badge>{r.workedTogetherContext ? <div className="text-[11px] text-ink-muted mt-1 max-w-[260px]">{r.workedTogetherContext}</div> : null}</> : <span className="text-ink-faint">no</span>}</td>
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
                      <div className="text-[11px] text-ink-faint">{e.observer.name} · <DateText date={e.dateObserved} /> · confidence {e.confidence}% · {e.visibility.toLowerCase().replace("_", " ")}</div>
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
                          {c.approvalStatus !== "APPROVED" ? <Link href={`/conversations?tab=review&open=${c.id}`} className="text-xs text-navy hover:underline">Review</Link> : null}
                        </div>
                      </div>
                      {s?.summary ? <p className="text-[13px] mt-2">{s.summary}</p> : null}
                      {c.rawNotes ? <details className="mt-2"><summary className="text-xs text-ink-faint cursor-pointer">Raw notes</summary><p className="text-xs text-ink-muted whitespace-pre-wrap mt-1">{c.rawNotes}</p></details> : null}
                      {c.followUpDate ? <div className="text-[11px] text-ink-faint mt-2">Follow up <DateText date={c.followUpDate} relative /></div> : null}
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
            <div className="rounded-lg border border-line bg-surface overflow-hidden">
              <table className="data">
                <thead><tr><th>Opportunity</th><th>Route</th><th>Stage</th><th>Fit</th><th>Human decision</th><th>Notes</th></tr></thead>
                <tbody>
                  {person.matches.map((m) => (
                    <tr key={m.id}>
                      <td><Link href={`/opportunities/${m.opportunity.id}`} className="font-medium text-ink hover:underline underline-offset-4">{m.opportunity.title}</Link><div className="text-[11px] text-ink-faint">{m.opportunity.clientName}</div></td>
                      <td><RouteBadge route={m.opportunity.engagementRoute} /></td>
                      <td><StageBadge status={m.opportunity.status} /></td>
                      <td className="tabular">{m.fitScore}</td>
                      <td><DecisionBadge decision={m.humanDecision} /></td>
                      <td className="text-xs text-ink-muted max-w-[280px]">{m.humanNotes ?? "—"}</td>
                    </tr>
                  ))}
                  {person.teamMemberships.map((t) => (
                    <tr key={t.id}><td><Link href={`/opportunities/${t.opportunity.id}`} className="font-medium text-ink hover:underline">{t.opportunity.title}</Link><div className="text-[11px] text-ink-faint">Amana team shortlist</div></td><td colSpan={4}><Badge tone="teal">{t.roleOnTeam}</Badge></td><td className="text-xs text-ink-muted">{t.notes ?? "—"}</td></tr>
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
            <div className="rounded-lg border border-line bg-surface overflow-hidden">
              <table className="data"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
                <tbody>{audit.map((a) => <tr key={a.id}><td><DateText date={a.createdAt} relative /></td><td>{a.actor?.name ?? "system"}</td><td className="font-mono text-[11px]">{a.action}</td><td>{a.entityType}</td><td className="text-xs text-ink-muted font-mono">{a.metadata ? JSON.stringify(a.metadata) : ""}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Section>
      ) : null}
    </>
  );
}
