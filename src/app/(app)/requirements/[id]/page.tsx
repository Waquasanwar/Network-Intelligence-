import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternal, getUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { Notice } from "@/components/ui/notice";
import { PageHeader, Score } from "@/components/ui/page";
import { Fold } from "@/components/ui/fold";
import { Avatar } from "@/components/ui/avatar";
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
import { findForBrief, decideShortlist, setBriefStatus, saveBriefTerms, setFeeStatus, setCreditStatus } from "@/server/actions/demand";
import { toDomain } from "@/lib/brief-domain";
import { loadRateCard } from "@/server/queries";
import { estimateFee, fmt, PORTAL_VISIBLE, FEE_MODEL_LABELS, SHORTLIST_LABELS, BRIEF_STATUS_LABELS, FEE_STATUS_LABELS, type HardCheck } from "@/lib/demand";
import type { MatchResult } from "@/lib/matching";
import { canSeeMoney, redactForPartner } from "@/lib/authz";
import { partnerRef } from "@/lib/refs";
import { partnerHidden } from "@/lib/privacy";
import { SENIORITY_LABELS } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getUser();
  const b = viewer ? await prisma.brief.findFirst({ where: { id, tenantId: viewer.tenantId }, select: { title: true } }) : null;
  return { title: b?.title ?? "Requirement" };
}

const TIER_ORDER: Record<string, number> = { meets: 0, conversation: 1, stretch: 2 };

export default async function RequirementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const user = await requireInternal();
  const money = canSeeMoney(user);
  const { id } = await params;
  const credits = money ? await prisma.referralCredit.findMany({ where: { briefId: id, tenantId: user.tenantId }, include: { person: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } }) : [];
  const b = await prisma.brief.findUnique({ where: { id }, include: { account: true, shortlist: { include: { person: { include: { evidence: true, relationships: true, vouches: true, conversations: { select: { approvalStatus: true, type: true, approvedById: true } } } } } }, pitches: { include: { person: { select: { id: true, firstName: true, lastName: true, headline: true } } } }, referrals: { include: { referrer: { select: { firstName: true, lastName: true } } } }, feeLines: { include: { person: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } } } });
  if (!b || b.tenantId !== user.tenantId) notFound();
  const [card, audit] = await Promise.all([loadRateCard(user.tenantId), prisma.auditLog.findMany({ where: { tenantId: user.tenantId, entityId: id }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 8 })]);
  const d = toDomain(b);
  const est = estimateFee(d, d.terms, card, d.expertHours);
  const items = b.shortlist.slice().sort((x, y) => TIER_ORDER[x.tier] - TIER_ORDER[y.tier] || y.fitScore - x.fitScore);
  const visible = items.filter((s) => PORTAL_VISIBLE.includes(s.decision));
  const placedOrIntroduced = (s: string) => ["INTRODUCED", "PLACED"].includes(s);
  const traits = parseFitTraits(b.rawText);

  return (
    <>
      <Notice code={notice} />
      <PageHeader
        eyebrow={`${KIND_LABEL[b.account.kind]} · ${b.account.name}`}
        title={b.title}
        description={<span className="flex flex-wrap items-center gap-1.5"><Badge tone="navy">{routeLabel(b.engagementRoute)}</Badge><BriefStatusBadge status={b.status} />{b.submittedVia === "PORTAL" ? <Badge tone="amber" filled>submitted via portal</Badge> : null}{b.termsAccepted ? <Badge tone="teal" filled>terms accepted</Badge> : <Badge tone="amber" filled>terms not yet accepted</Badge>}<span className="text-ink-faint">· <DateText date={b.createdAt} relative /></span></span>}
        actions={<><form action={setBriefStatus} className="flex items-center gap-2"><input type="hidden" name="briefId" value={b.id} /><Select name="status" defaultValue={b.status} className="w-[150px]">{Object.entries(BRIEF_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select><SubmitButton variant="secondary" pendingText="…">Set status</SubmitButton></form><EditBriefDrawer b={{ id: b.id, rawText: b.rawText, title: b.title, engagementRoute: b.engagementRoute, headcount: b.headcount, roles: b.roles, capabilities: b.capabilities, locations: b.locations, workRights: b.workRights, seniority: b.seniority, sectors: b.sectors, budgetAmount: b.budgetAmount ? Number(b.budgetAmount) : null, budgetKind: b.budgetKind, budgetCurrency: b.budgetCurrency, durationMonths: b.durationMonths, startBy: b.startBy, mustBeLocal: b.mustBeLocal, feeCurrency: b.feeCurrency }} /></>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4 min-w-0">
          <Card>
            <CardHeader title="The brief" description="What was asked, in their words and in structure." />
            <CardBody>
              <blockquote className="border-l-[3px] border-navy-400 pl-4 text-[14.5px] italic leading-6 text-ink mb-4">{b.rawText}</blockquote>
              <BriefChips b={d} />
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-[12.5px] mt-4">
                <div><dt className="text-ink-faint">Roles</dt><dd>{b.roles.join(", ") || "to confirm"}</dd></div>
                <div><dt className="text-ink-faint">Headcount</dt><dd>{b.headcount}</dd></div>
                <div><dt className="text-ink-faint">Where</dt><dd>{b.locations.join(" / ") || "—"}{b.mustBeLocal ? <span className="block text-[12px] text-ink-faint">must already be there</span> : null}</dd></div>
                <div><dt className="text-ink-faint">Work rights</dt><dd>{b.workRights ?? "not required"}</dd></div>
                <div><dt className="text-ink-faint">Seniority</dt><dd>{b.seniority ? SENIORITY_LABELS[b.seniority] : "—"}</dd></div>
                <div><dt className="text-ink-faint">Sectors</dt><dd>{b.sectors.join(", ") || "—"}</dd></div>
                <div><dt className="text-ink-faint">Budget</dt><dd className="tabular">{budgetLabel(d.budget) ?? "—"}</dd></div>
                <div><dt className="text-ink-faint">Start · duration</dt><dd>{b.startBy ?? "—"}{b.durationMonths ? ` · ${b.durationMonths} months` : ""}</dd></div>
              </dl>
              {b.questions.length ? <div className="mt-4 border-t border-line pt-3 text-[12.5px]"><div className="label-caps text-amber mb-1">Still to confirm with {b.account.name}</div><ul className="pl-4 list-disc space-y-0.5 text-ink-muted">{b.questions.map((q) => <li key={q}>{q}</li>)}</ul></div> : null}
            </CardBody>
          </Card>

          {/* The shortlist: one line a person. Open a line for the reasoning and the decision. */}
          <Card>
            <CardHeader title="Shortlist" description={items.length ? `${items.length} ${items.length === 1 ? "person" : "people"} found for this requirement, best fit first. Open one to see why, and to decide. Only people you mark as proposed reach the client, and without their name.` : "Nothing is shared until you propose someone."} action={<form action={findForBrief}><input type="hidden" name="briefId" value={b.id} /><SubmitButton variant={items.length ? "secondary" : "primary"} pendingText="Finding…"><Sparkles className="h-3.5 w-3.5" /> {items.length ? "Refresh" : "Find people"}</SubmitButton></form>} />
            {items.length === 0 ? <CardBody><p className="text-[13px] text-ink-muted">No shortlist yet. Find people for this requirement to start one.</p></CardBody> : (
              <ul className="divide-y divide-line border-t border-line">
                {items.map((s, i) => { const dims = (s.dimensions as MatchResult["dimensions"]).slice(0, 5); const checks = s.checks as HardCheck[]; const vouched = s.person.vouches.filter((v) => v.wouldRecommend).length; return (
                  <li key={s.id} className={s.decision === "NOT_FOR_THIS" || s.decision === "CLIENT_PASSED" ? "opacity-60" : undefined}>
                    <Fold open={i === 0} summaryClassName="px-5 py-3 sm:px-6 hover:bg-surface-muted/60" summary={
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar person={s.person} size="md" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-ink">{fullName(s.person)}</span><span className="block truncate text-[12.5px] text-ink-muted">{s.person.headline ?? "No headline yet"}</span></span>
                        <span className="hidden flex-none md:block"><TierBadge tier={s.tier} /></span>
                        <span className="w-8 flex-none text-right font-display text-[17px] tabular text-ink" title="Fit, out of 100">{Math.round(s.fitScore)}</span>
                        <span className="hidden flex-none sm:block"><ShortlistBadge decision={s.decision} /></span>
                      </span>
                    }>
                      <div className="px-5 pb-5 sm:px-6">
                        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                          <span className="md:hidden"><TierBadge tier={s.tier} /></span><span className="sm:hidden"><ShortlistBadge decision={s.decision} /></span>
                          <Badge tone={vouched ? "teal" : "neutral"} filled>vouched by {vouched}</Badge>
                          <AvailabilityBadge status={s.person.availabilityStatus} confirmedAt={s.person.availabilityConfirmedAt} nextCheckDate={s.person.nextCheckDate} />
                          <Link href={`/network/${s.person.id}`} className="ml-auto font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">Open profile</Link>
                        </div>
                        <CheckList checks={checks} />
                        <FitChecks checks={fitChecks(traits, fitProfile((s.person.attributes as FitScores | null) ?? null, s.person.vouches.map((v) => v.attributes as FitScores | null).filter((x): x is FitScores => !!x)))} />
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">{dims.map((x) => <div key={x.name} className="min-w-0"><div className="label-caps text-ink-faint truncate">{x.name}</div><Score value={x.score} /></div>)}</div>
                        <p className="text-[13px] mt-3 leading-5">{s.fitExplanation}</p>
                        {s.uncertainty.length ? <div className="mt-2 text-[12.5px]"><div className="label-caps text-amber mb-0.5">Not yet known</div><ul className="pl-4 list-disc space-y-0.5 text-ink-muted">{s.uncertainty.map((u) => <li key={u}>{u}</li>)}</ul></div> : null}
                        <form action={decideShortlist} className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-2.5 items-end mt-4 pt-4 border-t border-line">
                          <input type="hidden" name="itemId" value={s.id} />
                          <Field label="Decision"><Select name="decision" defaultValue={s.decision}>{Object.entries(SHORTLIST_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                          <Field label="Note for the client (anonymised card)"><Input name="clientNote" defaultValue={s.clientNote ?? ""} placeholder="Why this person, in a sentence they can read." /></Field>
                          <SubmitButton variant="secondary" pendingText="…">Save</SubmitButton>
                          {s.person.referralConsent === "yes" || ["INTRODUCED", "PLACED"].includes(s.decision) ? null : <label className="md:col-span-3 flex items-center gap-2 text-[12.5px] text-ink-muted cursor-pointer"><input type="checkbox" name="consentConfirmed" className="h-3.5 w-3.5 rounded border-line-strong accent-navy" /> They have agreed to this introduction. Needed before choosing Introduced or Placed, which gives the client their name.</label>}
                        </form>
                      </div>
                    </Fold>
                  </li>
                ); })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 min-w-0">
          {money ? (
            <Card>
              <CardHeader title="Commercials" description={`Paid by ${b.account.name}. Only you see this.`} action={<AddFeeDrawer briefId={b.id} people={items.map((s) => ({ id: s.personId, name: fullName(s.person) }))} defaults={{ gross: est.gross, ourTake: est.perHead, currency: est.currency, basis: est.basis }} />} />
              <CardBody>
                <FeeBox est={est} extra={est.confident && b.headcount > 1 ? <div className="text-[12px] text-ink-faint">{fmt(est.perHead, est.currency)} per placement</div> : null} />
                {b.feeLines.length ? <div className="mt-4"><div className="label-caps text-ink-faint mb-2">Fee lines</div><ul className="divide-y divide-line">{b.feeLines.map((f) => <li key={f.id} className="py-2.5 first:pt-0 last:pb-0"><div className="flex items-center justify-between"><span className="text-[13px] font-semibold tabular">{fmt(Number(f.ourTake), f.currency)}</span><FeeStatusBadge status={f.status} /></div><div className="text-[12px] text-ink-faint">{f.person ? `${fullName(f.person)} · ` : ""}{f.basis}</div><form action={setFeeStatus} className="flex items-center gap-2 mt-1.5"><input type="hidden" name="feeId" value={f.id} /><Select name="status" defaultValue={f.status} className="h-7 text-xs w-[130px]">{Object.entries(FEE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select><SubmitButton size="sm" variant="secondary" pendingText="…">Update</SubmitButton></form></li>)}</ul></div> : <p className="mt-3 text-[12.5px] text-ink-muted">A fee line is created when someone is placed, or add one now.</p>}
                {credits.length ? <div className="mt-4" data-credits><div className="label-caps text-ink-faint mb-2">Members&apos; share</div><ul className="divide-y divide-line">{credits.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 text-[12.5px]">
                    <span className="min-w-0"><b className="font-semibold">{fullName(c.person)}</b> <span className="text-ink-muted">{c.reason} · {Number(c.pct)}%{c.amount !== null ? ` · ${fmt(Number(c.amount), c.currency)}` : " · amount follows the fee"}</span></span>
                    {c.status === "OWED" ? <form action={setCreditStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="PAID" /><SubmitButton size="sm" variant="secondary" pendingText="…">Mark paid</SubmitButton></form> : <span className="text-[12px] font-semibold text-teal">{c.status === "PAID" ? "Paid" : "Written off"}</span>}
                  </li>))}</ul></div> : null}
                <Fold className="mt-4 border-t border-line pt-3" summary={<span className="text-[13px] font-semibold text-ink">Change the terms</span>}>
                  <form action={saveBriefTerms} className="space-y-3 mt-3">
                    <input type="hidden" name="briefId" value={b.id} />
                    <Field label="Fee model" hint={`${KIND_LABEL[b.account.kind]} · defaults come from the rate card in Settings`}><Select name="model" defaultValue={d.terms.model}>{Object.entries(FEE_MODEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                <div className="grid grid-cols-2 gap-3">
                  {d.terms.model === "INTRODUCTION_FEE" ? <Field label="Flat fee"><Input name="flat" type="number" step="0.5" min={0} defaultValue={d.terms.flat ?? ""} /></Field> : <Field label="Our %"><Input name="pct" type="number" step="0.5" min={0} defaultValue={d.terms.pct ?? ""} /></Field>}
                  <Field label="Currency"><Select name="currency" defaultValue={d.terms.currency}>{["GBP", "AED", "SAR", "USD", "EUR"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
                </div>
                {b.engagementRoute === "ADVISORY" ? <Field label="Expert hours"><Input name="expertHours" type="number" min={1} defaultValue={b.expertHours ?? card.defaultExpertHours} /></Field> : null}
                <Checkbox name="termsAccepted" label="Terms accepted by the paying party" defaultChecked={b.termsAccepted} />
                    <div className="flex justify-end"><SubmitButton size="sm" pendingText="Saving…">Save terms</SubmitButton></div>
                  </form>
                </Fold>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="What the client sees" description="Without names, until an introduction is agreed." />
            <CardBody>
              {visible.length === 0 ? <p className="text-[12.5px] text-ink-muted">Nothing yet. Mark someone as <b>Proposed to client</b> and an anonymised card appears here and in their portal.</p> : (
                <>
                  <ul>{visible.map((s) => { const x = redactForPartner({ ...s.person, tenantId: b.tenantId, evidence: s.person.evidence, relationships: s.person.relationships }, { ref: partnerRef(b.accountId, s.person.id), hideRegion: partnerHidden({ privacy: s.person.privacy as never }).region }); const checks = s.checks as HardCheck[]; return <AnonCard key={s.id} refCode={x.ref} headline={x.headlineSummary || s.person.headline || "Profile"} region={x.region} availabilityBand={x.availabilityBand} evidenceSummary={x.evidenceSummary} proofs={x.proofs} rights={checks.find((c) => c.label === "Work rights")} rateStated={s.person.rateExpectation ?? s.person.salaryExpectation} tier={s.tier} decision={s.decision} kind={b.account.kind} referred={s.referred} clientNote={s.clientNote} revealedName={placedOrIntroduced(s.decision) ? fullName(s.person) : null} />; })}</ul>
                  <Link href={`/portal?account=${b.accountId}`} className="text-[12.5px] font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink mt-2 inline-block">Open the portal as {b.account.name}</Link>
                </>
              )}
              <form action={setBriefMembers} className="mt-4 border-t border-line pt-4 space-y-3"><input type="hidden" name="briefId" value={b.id} /><Checkbox name="openToMembers" label="Also open to network members, without the client's name" defaultChecked={b.openToMembers} /><Field label="What members see"><Input name="memberSummary" defaultValue={b.memberSummary ?? ""} placeholder="The need in plain words, no client name." /></Field><div className="flex justify-end"><SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton></div></form>
              {b.pitches.length || b.referrals.length ? <ul className="mt-3 divide-y divide-line text-[12.5px]">{b.pitches.map((x) => <li key={x.id} className="py-1.5 flex justify-between gap-2"><span><PersonLink person={x.person} sub={null} /><small className="block text-ink-faint">pitched · {x.status.toLowerCase()}</small></span><Link href="/referrals?tab=pitches" className="text-navy hover:underline text-[12px]">Review</Link></li>)}{b.referrals.map((x) => <li key={x.id} className="py-1.5 flex justify-between gap-2"><span><b>{x.name}</b><small className="block text-ink-faint">referred by {x.referrer.firstName} {x.referrer.lastName} · {x.status.toLowerCase()}</small></span><Link href="/referrals" className="text-navy hover:underline text-[12px]">Review</Link></li>)}</ul> : null}
            </CardBody>
          </Card>

          <Fold className="px-1" summary={<span className="text-[13px] font-semibold text-ink-muted">Activity <span className="font-normal text-ink-faint">· {audit.length}</span></span>}>
            {audit.length === 0 ? <p className="mt-2 text-[12.5px] text-ink-muted">No activity yet.</p> : <ul className="mt-2 space-y-1.5 text-[12px]">{audit.map((a) => <li key={a.id}><span className="text-ink-faint"><DateText date={a.createdAt} relative /> · {a.actor?.name ?? "Portal user"}</span> <code className="text-[12px] bg-surface-muted rounded px-1">{a.action}</code></li>)}</ul>}
          </Fold>
        </div>
      </div>
    </>
  );
}
