import Link from "next/link";
import { notFound } from "next/navigation";
import { canSeeMoney } from "@/lib/authz";
import { requireInternal, getUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { Notice } from "@/components/ui/notice";
import { PageHeader, EmptyState, Score, Section, Facts } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { PersonLink } from "@/components/domain/person-link";
import { AvailabilityBadge, DecisionBadge, IntroBadge, RouteBadge, StageBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { ApproveIntroductionDrawer } from "@/components/domain/opportunity-drawers";
import { generateMatches, decideMatch, setOpportunityStatus, updateIntroductionStatus, addToTeam, removeFromTeam } from "@/server/actions/opportunities";
import { OutreachButton } from "@/components/domain/outreach-button";
import { DECISION_LABELS, OPPORTUNITY_STATUS_LABELS, ROUTE_LABELS, SENIORITY_LABELS, INTRO_STATUS_LABELS } from "@/lib/labels";
import { formatMoney, fullName } from "@/lib/utils";
import { ChevronDown, Sparkles } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getUser();
  const o = viewer ? await prisma.opportunity.findFirst({ where: { id, tenantId: viewer.tenantId }, select: { title: true } }) : null;
  return { title: o?.title ?? "Opportunity" };
}

export default async function OpportunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const user = await requireInternal();
  const money = canSeeMoney(user);
  const { id } = await params;
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      partner: true,
      matches: { include: { person: { include: { evidence: { select: { id: true, evidenceType: true } }, relationships: { select: { workedTogether: true } } } }, approvedBy: { select: { name: true } } }, orderBy: { fitScore: "desc" } },
      introductions: { include: { person: true, recruitmentPartner: { select: { name: true } }, approvedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      teamShortlist: { include: { person: true } },
    },
  });
  if (!opp || opp.tenantId !== user.tenantId) notFound();

  const [partners, benchPeople] = await Promise.all([
    prisma.partner.findMany({ where: { networkTenantId: user.tenantId }, select: { id: true, name: true, licensedForPermanent: true, commercialSharePct: true } }),
    opp.isAmana ? prisma.person.findMany({ where: { tenantId: user.tenantId, amanaBench: true }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }) : Promise.resolve([]),
  ]);
  const partnerOpts = partners.map((p) => ({ ...p, commercialSharePct: money && p.commercialSharePct ? Number(p.commercialSharePct) : null }));
  const recommended = opp.matches.filter((m) => m.humanDecision === "RECOMMEND");
  const undecided = opp.matches.filter((m) => m.humanDecision === "UNDECIDED");

  return (
    <>
      <Notice code={notice} />
      <PageHeader
        title={opp.title}
        description={<span className="flex flex-wrap items-center gap-1.5"><RouteBadge route={opp.engagementRoute} /><StageBadge status={opp.status} />{opp.isAmana ? <Badge tone="teal" filled>Amana Expert Network</Badge> : null}<span className="text-ink-faint">· {opp.clientName ?? opp.sourceType.toLowerCase()}{opp.partner ? ` via ${opp.partner.name}` : ""}</span></span>}
        actions={
          <form action={setOpportunityStatus} className="flex items-center gap-2">
            <input type="hidden" name="opportunityId" value={opp.id} />
            <Select name="status" defaultValue={opp.status} className="w-[160px]">{Object.entries(OPPORTUNITY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            <SubmitButton variant="secondary" pendingText="…">Set stage</SubmitButton>
          </form>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader title="The problem" />
            <CardBody>
              <p className="text-[14.5px] leading-[1.6] text-ink">{opp.problemStatement}</p>
              {opp.desiredOutcomes ? <><div className="label-caps text-ink-faint mt-3 mb-1">Desired outcomes</div><p className="text-[13px] leading-6">{opp.desiredOutcomes}</p></> : null}
              {opp.requiredCapabilities.length ? <><div className="label-caps text-ink-faint mt-5 mb-2">Must have</div><div className="flex flex-wrap gap-1.5">{opp.requiredCapabilities.map((c) => <Chip key={c}>{c}</Chip>)}</div></> : null}
              {opp.preferredCapabilities.length ? <><div className="label-caps text-ink-faint mt-4 mb-2">Nice to have</div><div className="flex flex-wrap gap-1.5">{opp.preferredCapabilities.map((c) => <Chip key={c}>{c}</Chip>)}</div></> : null}
              <Facts className="mt-5 max-w-[460px]" rows={[
                { label: "Route", value: ROUTE_LABELS[opp.engagementRoute] },
                { label: "Location", value: opp.location },
                { label: "Start", value: opp.startDate ? <DateText date={opp.startDate} /> : null },
                { label: "Duration", value: opp.duration },
                { label: "Budget", value: opp.budget ? `${formatMoney(Number(opp.budget), opp.currency ?? "GBP")}${opp.engagementRoute === "PERMANENT" ? "" : "/day"}` : null },
                { label: "Seniority", value: opp.seniority ? SENIORITY_LABELS[opp.seniority] : null },
                { label: "Sectors", value: opp.sectors.join(", ") },
              ]} />
            </CardBody>
          </Card>

          <Section
            title="People who might fit"
            description="Suggested from your network for this requirement only. Open a row for the reasoning, then record your decision."
            action={<form action={generateMatches}><input type="hidden" name="opportunityId" value={opp.id} /><SubmitButton variant="secondary" pendingText="Finding…"><Sparkles className="h-3.5 w-3.5" /> {opp.matches.length ? "Refresh suggestions" : "Find possible matches"}</SubmitButton></form>}
          >
            {opp.matches.length === 0 ? <EmptyState icon={Sparkles} title="No suggestions yet" description="Find possible matches from your network. Each comes with the evidence behind it and what is still uncertain." /> : (
              <div className="rounded-[22px] border border-line bg-surface divide-y divide-line overflow-hidden">
                {opp.matches.map((m) => {
                  const intro = opp.introductions.find((i) => i.personId === m.personId);
                  const cautions = m.person.evidence.filter((e) => e.evidenceType === "CAUTION").length;
                  const worked = m.person.relationships.some((r) => r.workedTogether);
                  return (
                    <details key={m.id} className={`group ${m.humanDecision === "NOT_FOR_THIS_REQUIREMENT" ? "opacity-60" : ""}`}>
                      {/* One line per person: who, how good a fit, are they free, what you decided. Open it for the reasoning. */}
                      <summary className="grid grid-cols-[minmax(0,1fr)_auto_16px] md:grid-cols-[minmax(0,1fr)_140px_190px_150px_16px] items-center gap-x-5 gap-y-2 px-4 py-3.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-surface-hover transition-colors duration-200">
                        <div className="min-w-0"><PersonLink person={m.person} sub={m.person.headline} /></div>
                        <div className="flex items-center gap-2.5" title={`Fit for this requirement: ${Math.round(m.fitScore)} of 100`}>
                          <span className="font-display text-[20px] leading-none w-8 text-right">{Math.round(m.fitScore)}</span>
                          <span className="flex-1"><span className="block text-[12px] text-ink-faint leading-none mb-1.5">fit</span><span className="block h-1.5 rounded-full bg-series-track overflow-hidden"><span className="block h-full rounded-full bg-series-1" style={{ width: `${Math.max(2, Math.min(100, m.fitScore))}%` }} /></span></span>
                        </div>
                        <div className="hidden md:block min-w-0"><AvailabilityBadge status={m.person.availabilityStatus} confirmedAt={m.person.availabilityConfirmedAt} nextCheckDate={m.person.nextCheckDate} /></div>
                        <div className="hidden md:block min-w-0"><DecisionBadge decision={m.humanDecision} /></div>
                        <ChevronDown className="h-4 w-4 flex-none text-ink-faint transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <div className="px-4 pb-5 pt-1 bg-surface-hover/60">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 pt-3">
                          <div><div className="label-caps text-ink-faint mb-1.5">Evidence</div><Score value={m.evidenceStrength} /></div>
                          <div><div className="label-caps text-ink-faint mb-1.5">Relationship</div><Score value={m.relationshipStrength} /></div>
                          <div><div className="label-caps text-ink-faint mb-1.5">Availability</div><Score value={m.availabilityFit} /></div>
                          <div><div className="label-caps text-ink-faint mb-1.5">Commercial</div><Score value={m.commercialFit} /></div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-8 gap-y-4 mt-5">
                          <div>
                            <div className="label-caps text-ink-faint mb-1.5">Why they might fit</div>
                            <p className="text-[13.5px] leading-[1.6] text-ink">{m.fitExplanation}</p>
                            <p className="text-[12.5px] text-ink-faint mt-2">{cautions ? `${cautions} caution${cautions === 1 ? "" : "s"} on file · ` : ""}{m.person.evidence.length} piece{m.person.evidence.length === 1 ? "" : "s"} of evidence on file{worked ? " · you have worked together" : " · not worked with directly"}</p>
                          </div>
                          {m.uncertainty.length ? (
                            <div>
                              <div className="label-caps text-amber mb-1.5">Still uncertain</div>
                              <ul className="space-y-1.5 text-[13px] text-ink">{m.uncertainty.map((u) => <li key={u} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-amber" aria-hidden="true" />{u}</li>)}</ul>
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-end justify-between gap-3">
                          <form action={decideMatch} className="flex flex-wrap items-end gap-2 flex-1 min-w-[280px]">
                            <input type="hidden" name="matchId" value={m.id} />
                            <Field label="Your decision" className="w-[210px]"><Select name="decision" defaultValue={m.humanDecision}>{Object.entries(DECISION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                            <Field label="Why" className="flex-1 min-w-[200px]"><Input name="humanNotes" defaultValue={m.humanNotes ?? ""} placeholder="Your judgement, in a sentence." /></Field>
                            <SubmitButton variant="secondary" pendingText="Saving…" className="h-10">Save decision</SubmitButton>
                          </form>
                          <div className="flex items-center gap-2">
                            {intro ? <div className="text-[12.5px] flex items-center gap-1.5"><IntroBadge status={intro.status} /><span className="text-ink-faint">{intro.consentStatus.toLowerCase()} consent</span></div> : m.humanDecision === "RECOMMEND" ? <ApproveIntroductionDrawer opportunityId={opp.id} personId={m.personId} personName={fullName(m.person)} route={opp.engagementRoute} partners={partnerOpts} showTerms={money} /> : null}
                            {opp.isAmana && !opp.teamShortlist.some((t) => t.personId === m.personId) ? <form action={addToTeam}><input type="hidden" name="opportunityId" value={opp.id} /><input type="hidden" name="personId" value={m.personId} /><input type="hidden" name="roleOnTeam" value="Team member" /><Button size="sm" variant="ghost" type="submit">Add to team</Button></form> : null}
                          </div>
                        </div>
                        <OutreachButton opportunityId={opp.id} personId={m.personId} />
                        {m.approvedBy ? <div className="text-[12px] text-ink-faint mt-2">Decision by {m.approvedBy.name} · <DateText date={m.updatedAt} relative /></div> : null}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Where this stands" />
            <CardBody>
              <dl className="text-xs space-y-1.5">
                <div className="flex justify-between"><dt className="text-ink-faint">Suggestions</dt><dd className="tabular">{opp.matches.length}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Awaiting decision</dt><dd className="tabular">{undecided.length}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Recommended</dt><dd className="tabular text-teal">{recommended.length}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Introductions</dt><dd className="tabular">{opp.introductions.length}</dd></div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Introductions" description="Human-approved only. Consent before identity." />
            <CardBody>
              {opp.introductions.length === 0 ? <div className="text-xs text-ink-faint">None yet. Mark someone Recommend to enable an introduction.</div> : (
                <ul className="space-y-3">
                  {opp.introductions.map((i) => (
                    <li key={i.id} className="text-xs border border-line rounded-md p-2.5">
                      <div className="flex items-center justify-between gap-2"><span className="font-medium text-[13px]">{fullName(i.person)}</span><IntroBadge status={i.status} /></div>
                      <div className="text-ink-faint mt-1">{ROUTE_LABELS[i.route]}{money ? <> · {i.commercialModel.replace(/_/g, " ").toLowerCase()}{i.commercialSharePct ? ` ${Number(i.commercialSharePct)}%` : ""}{i.commercialValue ? ` · ${formatMoney(Number(i.commercialValue), i.currency ?? "GBP")}` : ""}</> : null}{i.recruitmentPartner ? ` · via ${i.recruitmentPartner.name}` : ""}</div>
                      <div className="text-ink-faint">Consent: {i.consentStatus.toLowerCase()}{i.approvedBy ? ` · approved by ${i.approvedBy.name.split(" ")[0]}` : ""}</div>
                      {i.notes ? <div className="mt-1 text-ink-muted">{i.notes}</div> : null}
                      <form action={updateIntroductionStatus} className="flex items-center gap-1.5 mt-2">
                        <input type="hidden" name="introductionId" value={i.id} />
                        <Select name="consentStatus" defaultValue={i.consentStatus} className="h-7 text-[12px]"><option value="NOT_REQUESTED">Consent not requested</option><option value="REQUESTED">Consent requested</option><option value="GRANTED">Consent granted</option><option value="DECLINED">Consent declined</option></Select>
                        <Select name="status" defaultValue={i.status} className="h-7 text-[12px]">{Object.entries(INTRO_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                        <SubmitButton size="sm" variant="secondary" pendingText="…">Update</SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {opp.isAmana ? (
            <Card>
              <CardHeader title="Team shortlist" description="Build the SOW / proposal team" />
              <CardBody>
                <ul className="space-y-2 mb-3">
                  {opp.teamShortlist.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                      <div><Link href={`/network/${t.person.id}`} className="font-medium text-[13px] hover:underline">{fullName(t.person)}</Link><div className="text-ink-faint">{t.roleOnTeam}{t.notes ? ` · ${t.notes}` : ""}</div></div>
                      <form action={removeFromTeam}><input type="hidden" name="memberId" value={t.id} /><Button size="sm" variant="ghost" type="submit">Remove</Button></form>
                    </li>
                  ))}
                  {!opp.teamShortlist.length ? <li className="text-xs text-ink-faint">No one yet.</li> : null}
                </ul>
                <form action={addToTeam} className="flex items-end gap-2">
                  <input type="hidden" name="opportunityId" value={opp.id} />
                  <Field label="Add from bench" className="flex-1"><Select name="personId" defaultValue="">{[<option key="" value="" disabled>Choose…</option>, ...benchPeople.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)]}</Select></Field>
                  <Field label="Role" className="w-[120px]"><Select name="roleOnTeam" defaultValue="Lead"><option>Lead</option><option>Specialist</option><option>Advisor</option><option>PMO</option><option>Bid director</option></Select></Field>
                  <SubmitButton size="md" variant="secondary" pendingText="…">Add</SubmitButton>
                </form>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
