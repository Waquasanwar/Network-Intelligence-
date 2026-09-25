import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, Score, Section } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Field, Checkbox } from "@/components/ui/form";
import { setBriefMembers } from "@/server/actions/members";
import { FitChecks } from "@/components/domain/demand";
import { parseFitTraits, fitChecks, fitProfile, type FitScores } from "@/lib/fit";
import { SubmitButton } from "@/components/ui/submit-button";
import { PersonLink } from "@/components/domain/person-link";
import { AvailabilityBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { EditBriefDrawer, AddFeeDrawer } from "@/components/domain/demand-drawers";
import { BriefChips, CheckList, TierBadge, ShortlistBadge, BriefStatusBadge, FeeStatusBadge, FeeBox, AnonCard, routeLabel, budgetLabel, KIND_LABEL } from "@/components/domain/demand";
import { findForBrief, decideShortlist, setBriefStatus, saveBriefTerms, setFeeStatus, toDomain } from "@/server/actions/demand";
import { loadRateCard } from "@/server/queries";
import { estimateFee, fmt, PORTAL_VISIBLE, FEE_MODEL_LABELS, SHORTLIST_LABELS, BRIEF_STATUS_LABELS, FEE_STATUS_LABELS, type HardCheck } from "@/lib/demand";
import type { MatchResult } from "@/lib/matching";
import { redactForPartner } from "@/lib/authz";
import { SENIORITY_LABELS } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await prisma.brief.findUnique({ where: { id }, select: { title: true } });
  return { title: b?.title ?? "Requirement" };
}

const TIER_ORDER: Record<string, number> = { meets: 0, conversation: 1, stretch: 2 };

export default async function RequirementPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireInternal();
  const { id } = await params;
  const b = await prisma.brief.findUnique({ where: { id }, include: { account: true, shortlist: { include: { person: { include: { evidence: true, relationships: true, vouches: true } } } }, pitches: { include: { person: { select: { id: true, firstName: true, lastName: true, headline: true } } } }, referrals: { include: { referrer: { select: { firstName: true, lastName: true } } } }, feeLines: { include: { person: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } } } });
  if (!b || b.tenantId !== user.tenantId) notFound();
  const [card, audit] = await Promise.all([loadRateCard(user.tenantId), prisma.auditLog.findMany({ where: { tenantId: user.tenantId, entityId: id }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 8 })]);
  const d = await toDomain(b);
  const est = estimateFee(d, d.terms, card, d.expertHours);
  const items = b.shortlist.slice().sort((x, y) => TIER_ORDER[x.tier] - TIER_ORDER[y.tier] || y.fitScore - x.fitScore);
  const visible = items.filter((s) => PORTAL_VISIBLE.includes(s.decision));
  const placedOrIntroduced = (s: string) => ["INTRODUCED", "PLACED"].includes(s);
  const traits = parseFitTraits(b.rawText);

  return (
    <>
      <PageHeader
        eyebrow={`${KIND_LABEL[b.account.kind]} · ${b.account.name}`}
        title={b.title}
        description={<span className="flex flex-wrap items-center gap-1.5"><Badge tone="navy">{routeLabel(b.engagementRoute)}</Badge><BriefStatusBadge status={b.status} />{b.submittedVia === "PORTAL" ? <Badge tone="amber" filled>submitted via portal</Badge> : null}{b.termsAccepted ? <Badge tone="teal" filled>terms accepted</Badge> : <Badge tone="amber" filled>terms not yet accepted</Badge>}<span className="text-ink-faint">· <DateText date={b.createdAt} relative /></span></span>}
        actions={<><form action={setBriefStatus} className="flex items-center gap-2"><input type="hidden" name="briefId" value={b.id} /><Select name="status" defaultValue={b.status} className="w-[150px]">{Object.entries(BRIEF_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select><SubmitButton variant="secondary" pendingText="…">Set status</SubmitButton></form><EditBriefDrawer b={{ id: b.id, rawText: b.rawText, title: b.title, engagementRoute: b.engagementRoute, headcount: b.headcount, roles: b.roles, capabilities: b.capabilities, locations: b.locations, workRights: b.workRights, seniority: b.seniority, sectors: b.sectors, budgetAmount: b.budgetAmount ? Number(b.budgetAmount) : null, budgetKind: b.budgetKind, budgetCurrency: b.budgetCurrency, durationMonths: b.durationMonths, startBy: b.startBy, mustBeLocal: b.mustBeLocal, feeCurrency: b.feeCurrency }} /></>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader title="The brief" description="What was asked, in their words and in structure." />
            <CardBody>
              <blockquote className="border-l-[3px] border-navy-400 bg-surface-muted rounded-r-[12px] px-4 py-3 text-[14px] italic leading-6 mb-3">{b.rawText}</blockquote>
              <BriefChips b={d} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-4">
                <div><div className="text-ink-faint">Roles</div><div>{b.roles.join(", ") || "to confirm"}</div></div>
                <div><div className="text-ink-faint">Headcount</div><div>{b.headcount}</div></div>
                <div><div className="text-ink-faint">Where</div><div>{b.locations.join(" / ") || "—"}{b.mustBeLocal ? <div className="text-[11px] text-ink-faint">must already be there</div> : null}</div></div>
                <div><div className="text-ink-faint">Work rights</div><div>{b.workRights ?? "not required"}</div></div>
                <div><div className="text-ink-faint">Seniority</div><div>{b.seniority ? SENIORITY_LABELS[b.seniority] : "—"}</div></div>
                <div><div className="text-ink-faint">Sectors</div><div>{b.sectors.join(", ") || "—"}</div></div>
                <div><div className="text-ink-faint">Budget</div><div className="tabular">{budgetLabel(d.budget) ?? "—"}</div></div>
                <div><div className="text-ink-faint">Start · duration</div><div>{b.startBy ?? "—"}{b.durationMonths ? ` · ${b.durationMonths} months` : ""}</div></div>
              </div>
              {b.questions.length ? <div className="mt-3 rounded-[12px] bg-amber-100 border border-amber/30 px-3 py-2.5 text-[12.5px]"><div className="text-[10.5px] uppercase tracking-wide font-medium text-amber mb-1">Still to confirm with {b.account.name}</div><ul className="pl-4 list-disc space-y-0.5">{b.questions.map((q) => <li key={q}>{q}</li>)}</ul></div> : null}
            </CardBody>
          </Card>

          <Section title="Shortlist" description="Retrieved for this brief only. Hard requirements are checked and labelled. Only people you mark as proposed appear in the portal, anonymised." action={<form action={findForBrief}><input type="hidden" name="briefId" value={b.id} /><SubmitButton variant={items.length ? "secondary" : "primary"} pendingText="Finding…"><Sparkles className="h-3.5 w-3.5" /> {items.length ? "Refresh" : "Find people"}</SubmitButton></form>}>
            {items.length === 0 ? <EmptyState title="No shortlist yet" description="Find people for this brief. Nothing is shared until you propose someone." /> : (
              <div className="space-y-3">
                {items.map((s) => { const dims = (s.dimensions as MatchResult["dimensions"]).slice(0, 5); const checks = s.checks as HardCheck[]; const rec = ["PROPOSED", "CLIENT_INTERESTED", "INTRODUCED", "PLACED"].includes(s.decision); return (
                  <Card key={s.id} className={rec ? "border-teal/40" : s.decision === "NOT_FOR_THIS" || s.decision === "CLIENT_PASSED" ? "opacity-60" : ""}>
                    <CardBody className="pt-3">
                      <div className="flex items-start justify-between gap-3"><PersonLink person={s.person} sub={s.person.headline} /><div className="flex flex-wrap items-center gap-2 justify-end shrink-0"><TierBadge tier={s.tier} /><Badge tone={s.person.vouches.filter((v) => v.wouldRecommend).length ? "teal" : "neutral"} filled>vouched by {s.person.vouches.filter((v) => v.wouldRecommend).length}</Badge><AvailabilityBadge status={s.person.availabilityStatus} confirmedAt={s.person.availabilityConfirmedAt} nextCheckDate={s.person.nextCheckDate} /><ShortlistBadge decision={s.decision} /></div></div>
                      <CheckList checks={checks} />
                      <FitChecks checks={fitChecks(traits, fitProfile((s.person.attributes as FitScores | null) ?? null, s.person.vouches.map((v) => v.attributes as FitScores | null).filter((a): a is FitScores => !!a)))} />
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">{dims.map((x) => <div key={x.name}><div className="text-[10px] uppercase text-ink-faint truncate">{x.name}</div><Score value={x.score} /></div>)}</div>
                      <p className="text-[13px] mt-3 leading-5">{s.fitExplanation}</p>
                      {s.uncertainty.length ? <div className="mt-2 rounded-[12px] bg-amber-100 border border-amber/30 px-3 py-2 text-[12px]"><div className="text-[10.5px] uppercase tracking-wide font-medium text-amber mb-0.5">Uncertainty</div><ul className="pl-4 list-disc space-y-0.5">{s.uncertainty.map((u) => <li key={u}>{u}</li>)}</ul></div> : null}
                      <form action={decideShortlist} className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-2.5 items-end mt-3 pt-3 border-t border-line">
                        <input type="hidden" name="itemId" value={s.id} />
                        <Field label="Decision"><Select name="decision" defaultValue={s.decision}>{Object.entries(SHORTLIST_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                        <Field label="Note for the client (anonymised card)"><Input name="clientNote" defaultValue={s.clientNote ?? ""} placeholder="Why this person, in a sentence they can read." /></Field>
                        <SubmitButton variant="secondary" pendingText="…">Save</SubmitButton>
                      </form>
                    </CardBody>
                  </Card>
                ); })}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Private to you" description="Requirements are only ever seen by you and your team. Clients see their own; members see only what you open to them, without the client's name." />
            <CardBody>
              <form action={setBriefMembers} className="space-y-3"><input type="hidden" name="briefId" value={b.id} /><Checkbox name="openToMembers" label="Open to network members (anonymised)" defaultChecked={b.openToMembers} /><Field label="What members see"><Input name="memberSummary" defaultValue={b.memberSummary ?? ""} placeholder="The need in plain words, no client name." /></Field><div className="flex justify-end"><SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton></div></form>
              {b.pitches.length || b.referrals.length ? <ul className="mt-3 divide-y divide-line text-[12.5px]">{b.pitches.map((x) => <li key={x.id} className="py-1.5 flex justify-between gap-2"><span><PersonLink person={x.person} sub={null} /><small className="block text-ink-faint">pitched · {x.status.toLowerCase()}</small></span><Link href="/referrals?tab=pitches" className="text-navy hover:underline text-[12px]">Review</Link></li>)}{b.referrals.map((x) => <li key={x.id} className="py-1.5 flex justify-between gap-2"><span><b>{x.name}</b><small className="block text-ink-faint">referred by {x.referrer.firstName} {x.referrer.lastName} · {x.status.toLowerCase()}</small></span><Link href="/referrals" className="text-navy hover:underline text-[12px]">Review</Link></li>)}</ul> : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Commercials" description={`Who pays: ${b.account.name}. Change the model or the % here for this brief only.`} />
            <CardBody>
              <form action={saveBriefTerms} className="space-y-3">
                <input type="hidden" name="briefId" value={b.id} />
                <FeeBox est={est} extra={est.confident && b.headcount > 1 ? <div className="text-[11.5px] text-ink-faint">{fmt(est.perHead, est.currency)} per placement</div> : null} />
                <Field label="Fee model" hint={`${KIND_LABEL[b.account.kind]} · defaults come from the rate card in Settings`}><Select name="model" defaultValue={d.terms.model}>{Object.entries(FEE_MODEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                <div className="grid grid-cols-2 gap-3">
                  {d.terms.model === "INTRODUCTION_FEE" ? <Field label="Flat fee"><Input name="flat" type="number" step="0.5" min={0} defaultValue={d.terms.flat ?? ""} /></Field> : <Field label="Our %"><Input name="pct" type="number" step="0.5" min={0} defaultValue={d.terms.pct ?? ""} /></Field>}
                  <Field label="Currency"><Select name="currency" defaultValue={d.terms.currency}>{["GBP", "AED", "SAR", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
                </div>
                {b.engagementRoute === "ADVISORY" ? <Field label="Expert hours"><Input name="expertHours" type="number" min={1} defaultValue={b.expertHours ?? card.defaultExpertHours} /></Field> : null}
                <Checkbox name="termsAccepted" label="Terms accepted by the paying party" defaultChecked={b.termsAccepted} />
                <div className="flex justify-end"><SubmitButton size="sm" pendingText="Saving…">Save terms</SubmitButton></div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Fees on this requirement" action={<AddFeeDrawer briefId={b.id} people={items.map((s) => ({ id: s.personId, name: fullName(s.person) }))} defaults={{ gross: est.gross, ourTake: est.perHead, currency: est.currency, basis: est.basis }} />} />
            <CardBody>{b.feeLines.length === 0 ? <div className="text-xs text-ink-muted">A fee line is created when someone is placed, or add one now.</div> : <ul className="divide-y divide-line">{b.feeLines.map((f) => <li key={f.id} className="py-2.5 first:pt-0 last:pb-0"><div className="flex items-center justify-between"><span className="text-[13px] font-semibold tabular">{fmt(Number(f.ourTake), f.currency)}</span><FeeStatusBadge status={f.status} /></div><div className="text-[11.5px] text-ink-faint">{f.person ? `${fullName(f.person)} · ` : ""}{f.basis}</div><form action={setFeeStatus} className="flex items-center gap-2 mt-1.5"><input type="hidden" name="feeId" value={f.id} /><Select name="status" defaultValue={f.status} className="h-7 text-xs w-[130px]">{Object.entries(FEE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select><SubmitButton size="sm" variant="secondary" pendingText="…">Update</SubmitButton></form></li>)}</ul>}</CardBody>
          </Card>

          <Card>
            <CardHeader title="What the client sees" description="Anonymised. Names only after introduction and consent." />
            <CardBody>
              {visible.length === 0 ? <div className="text-xs text-ink-muted">Nothing yet. Mark someone as <b>Proposed to client</b> and an anonymised card appears here and in their portal.</div> : (
                <>
                  <ul>{visible.map((s) => { const x = redactForPartner({ ...s.person, tenantId: b.tenantId, evidence: s.person.evidence, relationships: s.person.relationships }); const checks = s.checks as HardCheck[]; return <AnonCard key={s.id} refCode={x.ref} headline={x.headlineSummary || s.person.headline || "Profile"} region={x.region} availabilityBand={x.availabilityBand} evidenceSummary={x.evidenceSummary} rights={checks.find((c) => c.label === "Work rights")} rateStated={s.person.rateExpectation ?? s.person.salaryExpectation} tier={s.tier} decision={s.decision} kind={b.account.kind} referred={s.referred} clientNote={s.clientNote} revealedName={placedOrIntroduced(s.decision) ? fullName(s.person) : null} />; })}</ul>
                  <Link href={`/portal?account=${b.accountId}`} className="text-[12px] text-navy hover:underline underline-offset-4 mt-2 inline-block">Open the portal as {b.account.name} →</Link>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <CardBody>{audit.length === 0 ? <div className="text-xs text-ink-muted">No activity yet.</div> : <ul className="space-y-1.5 text-[12px]">{audit.map((a) => <li key={a.id}><span className="text-ink-faint"><DateText date={a.createdAt} relative /> · {a.actor?.name ?? "Portal user"}</span> <code className="text-[11px] bg-surface-muted rounded px-1">{a.action}</code></li>)}</ul>}</CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
