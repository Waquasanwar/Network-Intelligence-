import Link from "next/link";
import { setAccountSearch } from "@/server/actions/search";
import { handlePublicRequest } from "@/server/actions/public";
import { requireInternal } from "@/server/session";
import { NextStep } from "@/components/ui/next-step";
import { requirementsStep } from "@/server/next-step";
import { prisma } from "@/lib/db";
import { canSeeMoney } from "@/lib/authz";
import { PageHeader, EmptyState, Pill, Section, Score, Tabs } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Stat, StatStrip } from "@/components/ui/stat";
import { PersonLink } from "@/components/domain/person-link";
import { AvailabilityBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { NewAccountDrawer } from "@/components/domain/demand-drawers";
import { Guide } from "@/components/ui/guide";
import { ReadCard, CheckList, TierBadge, KindBadge, BriefStatusBadge, FeeStatusBadge, FeeBox, routeLabel, KIND_LABEL } from "@/components/domain/demand";
import { createBrief, raiseBrief } from "@/server/actions/demand";
import { toDomain } from "@/lib/brief-domain";
import { loadRateCard, feeSummary } from "@/server/queries";
import { parseBrief, matchBrief, estimateFee, defaultFeeModel, defaultTerms, fmt, PORTAL_VISIBLE, FEE_MODEL_LABELS, type BriefPerson, type AccountKind } from "@/lib/demand";
import { fullName } from "@/lib/utils";
import { Building2, CheckCheck, ListChecks, Send, Sparkles, TrendingUp, Wallet } from "lucide-react";

export const metadata = { title: "Requirements" };

const EXAMPLES = [
  "Agency looking for 2 BAs already in Dubai with a visa, perm, retail banking, AED 360k",
  "Client A wants a perm senior project manager in London, £95k, start in January",
  "Fractional CISO 2 days a week for a UAE insurer, £1,200–1,500 per day, 6 months",
  "Expert call: 2 hours on SAP S/4 go-live assurance for a utility, £600/hour, this week",
  "BA or PM",
];

export default async function RequirementsPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string; tab?: string; paste?: string }> }) {
  const user = await requireInternal();
  const money = canSeeMoney(user);
  const sp = await searchParams;
  const monthAhead = (n: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return d.toLocaleString("en-GB", { month: "long" }); };
  const q = (sp.q ?? "").trim();
  const kind = sp.kind as AccountKind | undefined;
  const tab = sp.tab === "accounts" ? "accounts" : sp.tab === "fees" && canSeeMoney(user) ? "fees" : "briefs";
  const [accounts, briefs, fees, card, summary] = await Promise.all([
    prisma.commercialAccount.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "asc" }, include: { _count: { select: { briefs: true } } } }),
    prisma.brief.findMany({ where: { tenantId: user.tenantId, ...(kind ? { account: { kind } } : {}) }, include: { account: true, shortlist: { select: { tier: true, decision: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.feeLine.findMany({ where: { tenantId: user.tenantId }, include: { brief: { select: { title: true } }, account: { select: { name: true } }, person: { select: { firstName: true, lastName: true } } }, orderBy: { updatedAt: "desc" }, take: 8 }),
    loadRateCard(user.tenantId),
    feeSummary(user.tenantId),
  ]);

  const enquiries = await prisma.publicRequest.findMany({ where: { tenantId: user.tenantId, kind: "NEED", status: "NEW" }, orderBy: { createdAt: "asc" }, take: 50 });

  // Co-pilot: parse and retrieve on the server. Nothing is saved until the human chooses an account.
  let copilot: { brief: ReturnType<typeof parseBrief>; groups: { tier: string; rows: ReturnType<typeof matchBrief> }[]; people: Map<string, BriefPersonRow>; defaultAccountId: string | null } | null = null;
  type BriefPersonRow = { id: string; firstName: string; lastName: string; headline: string | null; availabilityStatus: BriefPerson["availabilityStatus"]; availabilityConfirmedAt: Date | null; nextCheckDate: Date | null };
  if (q) {
    const brief = parseBrief(q);
    const people = await prisma.person.findMany({ where: { tenantId: user.tenantId }, include: { relationships: true, evidence: true, conversations: { where: { approvalStatus: "APPROVED" }, select: { id: true } } } });
    const inputs: BriefPerson[] = people.map((p) => ({ id: p.id, capabilities: p.capabilities, sectors: p.sectors, seniority: p.seniority, engagementPreferences: p.engagementPreferences, primaryCity: p.primaryCity, primaryCountry: p.primaryCountry, targetLocations: p.targetLocations, availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate, rateExpectation: p.rateExpectation, salaryExpectation: p.salaryExpectation, relationships: p.relationships.map((r) => ({ relationshipType: r.relationshipType, workedTogether: r.workedTogether, wouldWorkTogetherAgain: r.wouldWorkTogetherAgain, yearsKnown: r.yearsKnown })), evidence: p.evidence.map((e) => ({ evidenceType: e.evidenceType, confidence: e.confidence, context: e.context })), approvedConversations: p.conversations.length, workRights: p.workRights, relocationInterest: p.relocationInterest }));
    const results = matchBrief(brief, inputs, 10);
    const groups = ["meets", "conversation", "stretch"].map((tier) => ({ tier, rows: results.filter((r) => r.tier === tier) })).filter((g) => g.rows.length);
    const kindHint: AccountKind | null = /\b(agency|recruiter|agencies)\b/i.test(q) ? "AGENCY" : /\b(amana|expert call|expert network|sow|proposal|bid)\b/i.test(q) ? "EXPERT_NETWORK" : /\b(client|we want|we need)\b/i.test(q) ? "CLIENT" : null;
    const named = accounts.find((a) => q.toLowerCase().includes(a.name.split(" ·")[0].toLowerCase()));
    const def = named ?? accounts.find((a) => a.kind === kindHint) ?? accounts.find((a) => a.kind === "CLIENT") ?? accounts[0];
    copilot = { brief, groups, people: new Map(people.map((p) => [p.id, p])), defaultAccountId: def?.id ?? null };
  }
  const defAccount = copilot ? accounts.find((a) => a.id === copilot!.defaultAccountId) : null;
  const defModel = copilot && defAccount ? defaultFeeModel(copilot.brief.engagementRoute, defAccount.kind) : null;
  const defEst = copilot && defAccount && defModel ? estimateFee(copilot.brief, { ...defaultTerms(card, defModel), ...((defAccount.terms as object | null) ?? {}) }, card, null) : null;
  const open = briefs.filter((b) => !["FILLED", "CLOSED"].includes(b.status));
  const proposed = briefs.reduce((a, b) => a + b.shortlist.filter((s) => PORTAL_VISIBLE.includes(s.decision)).length, 0);

  return (
    <>
      <PageHeader title="Requirements" description={money ? "Clients, agencies and Amana tell us what they need. We structure it, you decide who to propose, and the fee is worked out as you go." : "Clients, agencies and Amana tell us what they need. We structure it and you decide who to propose."} actions={<NewAccountDrawer defaultCurrency={card.currency} />} />
      <NextStep step={await requirementsStep(user.tenantId)} />
      <StatStrip>
        <Stat icon={ListChecks} label="Open requirements" value={open.length} hint={`${briefs.filter((b) => b.submittedVia === "PORTAL").length} came through the portal`} />
        <Stat icon={Send} label="Proposed to clients" value={proposed} hint="anonymised until introduced" />
        {money ? <>
          <Stat icon={TrendingUp} label="Forecast fees" value={summary.forecast} hint="if the open briefs fill · only you see this" />
          <Stat icon={Wallet} label="Agreed, invoiced and paid" value={[summary.agreed, summary.paid].filter((v) => v !== "—").join(" · ") || "—"} hint="only you see this" />
        </> : <>
          <Stat icon={Building2} label="Accounts" value={accounts.length} hint="clients, agencies and Amana" />
          <Stat icon={CheckCheck} label="Filled" value={briefs.filter((b) => b.status === "FILLED").length} hint="requirements closed with a placement" />
        </>}
      </StatStrip>
      <Tabs items={[{ key: "briefs", label: "Requirements", count: briefs.length }, { key: "accounts", label: "Accounts", count: accounts.length }, ...(money ? [{ key: "fees", label: "Fees", count: fees.length }] : [])]} current={tab} base="/requirements" />
      {tab === "briefs" ? (<>
      {enquiries.length ? (
        <Card className="mb-5" id="enquiries">
          <CardHeader title={`${enquiries.length} ${enquiries.length === 1 ? "need" : "needs"} from your public page`} description="Sent in by someone with no login. Reading one puts it in the box below; closing it deletes what they sent." />
          <CardBody className="pt-0">
            <ul className="divide-y divide-line">
              {enquiries.map((e) => (
                <li key={e.id} className="py-3.5 first:pt-1" data-enquiry>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><b className="block text-[14px] font-semibold">{e.organisation ?? e.name}</b><span className="block text-[12px] text-ink-faint">{e.name} · {e.email}</span></div>
                    <div className="flex flex-none gap-1.5">
                      <form action={handlePublicRequest}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="decision" value="read" /><SubmitButton size="sm" pendingText="…">Read this need</SubmitButton></form>
                      <form action={handlePublicRequest}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="decision" value="decline" /><SubmitButton size="sm" variant="ghost" pendingText="…">Close</SubmitButton></form>
                    </div>
                  </div>
                  <p className="mt-2 text-[13px] leading-[1.55] text-ink-muted whitespace-pre-line max-w-[90ch]">{e.message}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {!q && !sp.paste ? (
        <div className="mb-5">
          <Guide
            intro="Raise a requirement for a client or agency. One question at a time, then I search the network for it."
            action={raiseBrief}
            compose={{ name: "text", parts: ["role", "route", "where", "when", "budget", "more"] }}
            submit="Raise requirement"
            pending="Raising…"
            review="Here is the requirement"
            steps={[
              { name: "accountId", kind: "choice", ask: "Who is it for?", short: "For", options: [...accounts.map((a) => ({ value: a.id, label: a.name, hint: KIND_LABEL[a.kind] })), { value: "new", label: "Someone new", hint: "A client or agency we have not set up yet" }] },
              { name: "newName", kind: "text", ask: "What are they called?", short: "New account", when: { name: "accountId", in: ["new"] }, placeholder: "Company or agency name", min: 2, max: 120 },
              { name: "newKind", kind: "choice", ask: "Are they a client or an agency?", short: "Kind", when: { name: "accountId", in: ["new"] }, options: [{ value: "CLIENT", label: "A client", hint: "They hire the person themselves" }, { value: "AGENCY", label: "An agency", hint: "They place the person with their own client" }] },
              { name: "role", kind: "text", ask: "Who do they need?", short: "Who", placeholder: "A fractional CFO for an energy group", min: 4, max: 300 },
              { name: "route", kind: "choice", ask: "How would the person work with them?", short: "How", options: [{ value: "permanent", label: "Permanent" }, { value: "contract", label: "Contract" }, { value: "interim", label: "Interim" }, { value: "fractional", label: "Fractional, a few days a week" }, { value: "advisory", label: "Advisory or an expert call" }, { value: "", label: "Not sure yet" }] },
              { name: "where", kind: "text", ask: "Where?", short: "Where", optional: true, placeholder: "City, or remote", max: 120, picks: ["Dubai", "Abu Dhabi", "Riyadh", "London", "Remote"] },
              { name: "when", kind: "choice", ask: "When do they need them?", short: "When", optional: true, options: [{ value: "start ASAP", label: "As soon as possible" }, { value: `start in ${monthAhead(1)}`, label: "Within a month" }, { value: `start by ${monthAhead(3)}`, label: "In the next three months" }, { value: "", label: "Flexible" }] },
              { name: "budget", kind: "text", ask: "What is the budget or rate?", short: "Budget", optional: true, placeholder: "AED 5,000 a day, or £120k", max: 120 },
              { name: "more", kind: "long", ask: "Anything else?", short: "Also", optional: true, placeholder: "Sector, must-haves, languages, right to work, how long…", max: 2000 },
            ]}
          />
          <p className="mt-2.5 text-[12.5px] text-ink-faint">Have the whole brief in an email? <Link href="/requirements?paste=1" className="font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline">Paste it instead</Link> and I will read it.</p>
        </div>
      ) : (
      <Card className="mb-5 border-navy-400/30 shadow-[var(--shadow-card),0_0_0_4px_rgba(79,111,214,0.06)]">
        <CardBody className="pt-4">
          <form method="get" action="/requirements" className="space-y-3">
            <div className="flex flex-col md:flex-row gap-2.5 md:items-end">
              <div className="relative flex-1"><Sparkles className="absolute left-3.5 top-3 h-4 w-4 text-navy-400 pointer-events-none" /><Textarea name="q" defaultValue={q} rows={2} className="pl-10 text-[14px] min-h-[64px]" placeholder="Describe the need in plain words, e.g. “2 BAs already in Dubai with a visa, perm, retail banking, AED 360k”" aria-label="Describe the requirement" /></div>
              <SubmitButton pendingText="Reading…">Read the need</SubmitButton>
            </div>
            <div className="flex flex-wrap items-center gap-1.5"><span className="text-[12px] text-ink-faint mr-1">Try</span>{EXAMPLES.map((e) => <Link key={e} href={`/requirements?q=${encodeURIComponent(e)}`} className="px-2.5 h-6.5 inline-flex items-center rounded-full border border-line bg-surface text-[12px] text-ink-muted hover:border-line-strong hover:text-ink">{e.length > 46 ? e.slice(0, 44) + "…" : e}</Link>)}</div>
          </form>

          {copilot ? (
            <div className="mt-4 pt-4 border-t border-line grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 space-y-4">
                <ReadCard b={copilot.brief} />
                <Section title={copilot.groups.length ? `${copilot.groups.reduce((a, g) => a + g.rows.length, 0)} people worth looking at` : "No one obvious yet"} description="Retrieved for this brief only. Hard requirements are checked and labelled, never used to hide anyone. You decide who to propose.">
                  {copilot.groups.length === 0 ? <EmptyState title="Nothing retrieved" description="Add capabilities or a location to the brief, or import more of your network." /> : copilot.groups.map((g) => (
                    <div key={g.tier} className="mb-3">
                      <div className="flex items-center gap-2 mb-2 ml-1"><TierBadge tier={g.tier} /><span className="text-[12px] text-ink-faint">{g.rows.length}</span></div>
                      <div className="space-y-2">
                        {g.rows.map((r) => { const p = copilot!.people.get(r.match.personId)!; return (
                          <Card key={p.id}><CardBody className="pt-3 pb-3.5">
                            <div className="flex items-start justify-between gap-3"><PersonLink person={p} sub={p.headline} /><div className="flex items-center gap-3 shrink-0"><AvailabilityBadge status={p.availabilityStatus} confirmedAt={p.availabilityConfirmedAt} nextCheckDate={p.nextCheckDate} /><Score value={r.match.fitScore} /></div></div>
                            <CheckList checks={r.checks} />
                            <p className="text-[12.5px] text-ink-muted mt-2 leading-5">{r.match.fitExplanation}</p>
                          </CardBody></Card>
                        ); })}
                      </div>
                    </div>
                  ))}
                </Section>
              </div>
              <div>
                <Card><CardBody className="pt-4 space-y-3">
                  <div><h3 className="text-[15px] font-semibold text-ink">Save as a requirement</h3><p className="text-[12.5px] text-ink-muted mt-0.5 leading-4">Attach it to who is paying. The fee model is chosen from the route and the account type; you can change it afterwards.</p></div>
                  <form action={createBrief} className="space-y-3">
                    <input type="hidden" name="text" value={q} />
                    <Field label="Account" required><Select name="accountId" defaultValue={copilot.defaultAccountId ?? ""} required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {KIND_LABEL[a.kind]}</option>)}</Select></Field>
                    <Field label="Title"><Input name="title" defaultValue={copilot.brief.title} /></Field>
                    {money && defEst && defModel ? <FeeBox est={defEst} model={defModel} pct={defaultTerms(card, defModel).pct} label={`Estimated fee to us · ${defAccount?.name}`} /> : null}
                    <SubmitButton pendingText="Saving…" className="w-full">Save requirement</SubmitButton>
                  </form>
                </CardBody></Card>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {[["", "All"], ["CLIENT", "Clients"], ["AGENCY", "Agencies"], ["EXPERT_NETWORK", "Amana"]].map(([k, l]) => <Pill key={k} href={`/requirements${k ? `?kind=${k}` : ""}`} active={(sp.kind ?? "") === k}>{l}</Pill>)}
      </div>

          <Card className="overflow-hidden">
            <CardHeader title="Requirements" description={money ? "Every brief, who it is from, and what it is worth if it fills." : "Every brief, who it is from, and where it stands."} />
            {briefs.length === 0 ? <CardBody><EmptyState title="No requirements yet" description="Describe a need above, then save the brief against a client, agency or Amana." /></CardBody> : (
              <table className="data">
                <thead><tr><th>Requirement</th><th>Route</th><th>Status</th>{money ? <th className="text-right">Fee to us</th> : null}</tr></thead>
                <tbody>
                  {await Promise.all(briefs.map(async (b) => { const d = toDomain(b); const est = estimateFee(d, d.terms, card, d.expertHours); const meets = b.shortlist.filter((s) => s.tier === "meets").length; const prop = b.shortlist.filter((s) => PORTAL_VISIBLE.includes(s.decision)).length; return (
                    <tr key={b.id}>
                      <td className="align-top"><Link href={`/requirements/${b.id}`} className="font-medium text-ink hover:underline underline-offset-4">{b.title}</Link><div className="text-[12px] text-ink-faint mt-0.5 flex flex-wrap items-center gap-1.5"><KindBadge kind={b.account.kind} />{b.account.name}{b.submittedVia === "PORTAL" ? " · via portal" : ""} · <DateText date={b.updatedAt} relative /></div></td>
                      <td className="align-top text-xs">{routeLabel(b.engagementRoute)}{b.headcount > 1 ? ` × ${b.headcount}` : ""}<div className="text-[12px] text-ink-faint">{b.locations[0] ?? "location to confirm"}{b.mustBeLocal ? " · already there" : ""}{b.workRights ? " · visa" : ""}</div></td>
                      <td className="align-top"><BriefStatusBadge status={b.status} /><div className="text-[12px] text-ink-faint">{b.shortlist.length ? `${meets} meet the brief · ${prop} proposed` : "not searched yet"}</div></td>
                      {money ? <td className="align-top text-right">{est.confident ? <><div className="font-semibold tabular">{fmt(est.ourTake, est.currency)}</div><div className="text-[12px] text-ink-faint">{FEE_MODEL_LABELS[d.terms.model].split(" (")[0]}</div></> : <span className="text-xs text-ink-faint">needs a budget</span>}</td> : null}
                    </tr>
                  ); }))}
                </tbody>
              </table>
            )}
          </Card>
      </>) : null}
      {tab === "accounts" ? (
          <Card>
            <CardHeader title="Accounts" description="Who pays, and on what terms." action={money ? <Link href="/settings/commercials" className="text-[12px] text-ink-muted hover:text-ink">Rate card →</Link> : undefined} />
            <CardBody><ul className="divide-y divide-line">{accounts.map((a) => <li key={a.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2"><div><div className="text-[13px] font-medium">{a.name}</div><div className="text-[12px] text-ink-faint">{KIND_LABEL[a.kind]} · {a._count.briefs} requirements{money && a.monthlyFee ? ` · ${fmt(Number(a.monthlyFee), a.currency)}/mo access` : ""}{a.portalTenantId ? " · portal login" : ""}</div></div><Badge tone={a.status === "ACTIVE" ? "teal" : "amber"}>{a.status.toLowerCase()}</Badge>{user.role === "OWNER" && a.kind !== "EXPERT_NETWORK" && a.portalEnabled ? <form action={setAccountSearch} className="flex-none"><input type="hidden" name="accountId" value={a.id} /><input type="hidden" name="on" value={a.searchEnabled ? "0" : "1"} /><SubmitButton size="sm" variant={a.searchEnabled ? "ghost" : "secondary"} pendingText="…">{a.searchEnabled ? "Search on · switch off" : "Give search access"}</SubmitButton></form> : null}</li>)}</ul></CardBody>
          </Card>
      ) : null}
      {tab === "fees" && money ? (
<Card>
            <CardHeader title="Fee pipeline" description="Our revenue: forecast, agreed, invoiced, paid." />
            <CardBody>{fees.length === 0 ? <div className="text-xs text-ink-muted">Fees appear as briefs are saved and people are placed.</div> : <ul className="divide-y divide-line">{fees.map((f) => <li key={f.id} className="py-2.5 first:pt-0 last:pb-0"><div className="flex items-center justify-between"><span className="text-[13px] font-semibold tabular">{fmt(Number(f.ourTake), f.currency)}</span><FeeStatusBadge status={f.status} /></div><div className="text-[12px] text-ink-faint">{f.account.name} · <Link href={`/requirements/${f.briefId}`} className="hover:underline">{f.brief.title}</Link>{f.person ? ` · ${fullName(f.person)}` : ""}</div><div className="text-[12px] text-ink-faint">{f.basis}</div></li>)}</ul>}</CardBody>
          </Card>
      ) : null}
    </>
  );
}
