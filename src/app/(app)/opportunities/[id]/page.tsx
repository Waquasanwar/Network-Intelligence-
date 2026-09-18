import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, Score, Section } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea, Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { PersonLink } from "@/components/domain/person-link";
import { AvailabilityBadge, DecisionBadge, IntroBadge, RouteBadge, StageBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { ApproveIntroductionDrawer } from "@/components/domain/opportunity-drawers";
import { generateMatches, decideMatch, setOpportunityStatus, updateIntroductionStatus, addToTeam, removeFromTeam } from "@/server/actions/opportunities";
import { DECISION_LABELS, OPPORTUNITY_STATUS_LABELS, ROUTE_LABELS, SENIORITY_LABELS, INTRO_STATUS_LABELS } from "@/lib/labels";
import { formatMoney, fullName } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await prisma.opportunity.findUnique({ where: { id }, select: { title: true } });
  return { title: o?.title ?? "Opportunity" };
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireInternal();
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
    prisma.partner.findMany({ select: { id: true, name: true, licensedForPermanent: true, commercialSharePct: true } }),
    opp.isAmana ? prisma.person.findMany({ where: { tenantId: user.tenantId, amanaBench: true }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }) : Promise.resolve([]),
  ]);
  const partnerOpts = partners.map((p) => ({ ...p, commercialSharePct: p.commercialSharePct ? Number(p.commercialSharePct) : null }));
  const recommended = opp.matches.filter((m) => m.humanDecision === "RECOMMEND");
  const undecided = opp.matches.filter((m) => m.humanDecision === "UNDECIDED");

  return (
    <>
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
              <p className="text-[13px] leading-6">{opp.problemStatement}</p>
              {opp.desiredOutcomes ? <><div className="text-[11px] uppercase text-ink-faint mt-3 mb-1">Desired outcomes</div><p className="text-[13px] leading-6">{opp.desiredOutcomes}</p></> : null}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-4">
                <div><div className="text-ink-faint">Route</div><div>{ROUTE_LABELS[opp.engagementRoute]}</div></div>
                <div><div className="text-ink-faint">Location</div><div>{opp.location ?? "—"}</div></div>
                <div><div className="text-ink-faint">Start / duration</div><div><DateText date={opp.startDate} />{opp.duration ? ` · ${opp.duration}` : ""}</div></div>
                <div><div className="text-ink-faint">Budget</div><div className="tabular">{opp.budget ? `${formatMoney(Number(opp.budget), opp.currency ?? "GBP")}${opp.engagementRoute === "PERMANENT" ? "" : "/day"}` : "—"}</div></div>
                <div className="col-span-2"><div className="text-ink-faint">Required</div><div className="flex flex-wrap gap-1 mt-0.5">{opp.requiredCapabilities.map((c) => <Chip key={c}>{c}</Chip>)}</div></div>
                <div><div className="text-ink-faint">Preferred</div><div className="flex flex-wrap gap-1 mt-0.5">{opp.preferredCapabilities.map((c) => <Chip key={c}>{c}</Chip>)}{!opp.preferredCapabilities.length && "—"}</div></div>
                <div><div className="text-ink-faint">Seniority / sectors</div><div>{opp.seniority ? SENIORITY_LABELS[opp.seniority] : "—"}{opp.sectors.length ? ` · ${opp.sectors.join(", ")}` : ""}</div></div>
              </div>
            </CardBody>
          </Card>

          <Section
            title="Matching panel"
            description="AI retrieves and explains possible fits for this requirement only. It does not rank people globally or reject anyone. You decide."
            action={<form action={generateMatches}><input type="hidden" name="opportunityId" value={opp.id} /><SubmitButton variant="secondary" pendingText="Finding…"><Sparkles className="h-3.5 w-3.5" /> {opp.matches.length ? "Refresh suggestions" : "Find possible matches"}</SubmitButton></form>}
          >
            {opp.matches.length === 0 ? <EmptyState title="No suggestions yet" description="Generate suggestions from the network. Each comes with evidence, provenance and what is still uncertain." /> : (
              <div className="space-y-3">
                {opp.matches.map((m) => {
                  const intro = opp.introductions.find((i) => i.personId === m.personId);
                  const cautions = m.person.evidence.filter((e) => e.evidenceType === "CAUTION").length;
                  return (
                    <Card key={m.id} className={m.humanDecision === "RECOMMEND" ? "border-teal/40" : m.humanDecision === "NOT_FOR_THIS_REQUIREMENT" ? "opacity-60" : ""}>
                      <CardBody className="pt-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <PersonLink person={m.person} sub={m.person.headline} />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <AvailabilityBadge status={m.person.availabilityStatus} confirmedAt={m.person.availabilityConfirmedAt} nextCheckDate={m.person.nextCheckDate} />
                            <DecisionBadge decision={m.humanDecision} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                          <div><div className="text-[10px] uppercase text-ink-faint">Fit for this</div><Score value={m.fitScore} /></div>
                          <div><div className="text-[10px] uppercase text-ink-faint">Evidence</div><Score value={m.evidenceStrength} /></div>
                          <div><div className="text-[10px] uppercase text-ink-faint">Relationship</div><Score value={m.relationshipStrength} /></div>
                          <div><div className="text-[10px] uppercase text-ink-faint">Availability</div><Score value={m.availabilityFit} /></div>
                          <div><div className="text-[10px] uppercase text-ink-faint">Commercial</div><Score value={m.commercialFit} /></div>
                        </div>
                        <p className="text-[13px] mt-3 leading-5">{m.fitExplanation}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2 text-[11px]">
                          {m.person.relationships.some((r) => r.workedTogether) ? <Badge tone="teal" filled>worked with</Badge> : <Badge filled>not worked with directly</Badge>}
                          <Badge tone={m.person.evidence.length ? "teal" : "amber"} filled>{m.person.evidence.length} evidence</Badge>
                          {cautions ? <Badge tone="amber" filled>{cautions} caution</Badge> : null}
                        </div>
                        {m.uncertainty.length ? (
                          <div className="mt-2 rounded-md bg-amber-100/60 border border-amber/20 px-3 py-2">
                            <div className="text-[10px] uppercase text-amber mb-0.5">Uncertainty</div>
                            <ul className="list-disc pl-4 text-xs text-ink space-y-0.5">{m.uncertainty.map((u) => <li key={u}>{u}</li>)}</ul>
                          </div>
                        ) : null}
                        <div className="mt-3 border-t border-line pt-3 flex flex-wrap items-end justify-between gap-3">
                          <form action={decideMatch} className="flex items-end gap-2 flex-1 min-w-[320px]">
                            <input type="hidden" name="matchId" value={m.id} />
                            <Field label="Human decision" className="w-[200px]"><Select name="decision" defaultValue={m.humanDecision}>{Object.entries(DECISION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                            <Field label="Why" className="flex-1"><Textarea name="humanNotes" defaultValue={m.humanNotes ?? ""} className="min-h-[32px] h-8 py-1.5" placeholder="Your judgement, in a sentence." /></Field>
                            <SubmitButton variant="secondary" pendingText="…">Save</SubmitButton>
                          </form>
                          <div className="flex items-center gap-2">
                            {intro ? <div className="text-xs flex items-center gap-1.5"><IntroBadge status={intro.status} /><span className="text-ink-faint">{intro.consentStatus.toLowerCase()} consent</span></div> : m.humanDecision === "RECOMMEND" ? <ApproveIntroductionDrawer opportunityId={opp.id} personId={m.personId} personName={fullName(m.person)} route={opp.engagementRoute} partners={partnerOpts} /> : null}
                            {opp.isAmana && !opp.teamShortlist.some((t) => t.personId === m.personId) ? <form action={addToTeam}><input type="hidden" name="opportunityId" value={opp.id} /><input type="hidden" name="personId" value={m.personId} /><input type="hidden" name="roleOnTeam" value="Team member" /><Button size="sm" variant="ghost" type="submit">Add to team</Button></form> : null}
                          </div>
                        </div>
                        {m.approvedBy ? <div className="text-[11px] text-ink-faint mt-2">Decision by {m.approvedBy.name} · <DateText date={m.updatedAt} relative /></div> : null}
                      </CardBody>
                    </Card>
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
                      <div className="text-ink-faint mt-1">{ROUTE_LABELS[i.route]} · {i.commercialModel.replace(/_/g, " ").toLowerCase()}{i.commercialSharePct ? ` ${Number(i.commercialSharePct)}%` : ""}{i.commercialValue ? ` · ${formatMoney(Number(i.commercialValue), i.currency ?? "GBP")}` : ""}{i.recruitmentPartner ? ` · via ${i.recruitmentPartner.name}` : ""}</div>
                      <div className="text-ink-faint">Consent: {i.consentStatus.toLowerCase()}{i.approvedBy ? ` · approved by ${i.approvedBy.name.split(" ")[0]}` : ""}</div>
                      {i.notes ? <div className="mt-1 text-ink-muted">{i.notes}</div> : null}
                      <form action={updateIntroductionStatus} className="flex items-center gap-1.5 mt-2">
                        <input type="hidden" name="introductionId" value={i.id} />
                        <Select name="consentStatus" defaultValue={i.consentStatus} className="h-7 text-[11px]"><option value="NOT_REQUESTED">Consent not requested</option><option value="REQUESTED">Consent requested</option><option value="GRANTED">Consent granted</option><option value="DECLINED">Consent declined</option></Select>
                        <Select name="status" defaultValue={i.status} className="h-7 text-[11px]">{Object.entries(INTRO_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
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
