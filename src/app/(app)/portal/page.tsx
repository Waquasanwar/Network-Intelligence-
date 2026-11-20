import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { isInternal, redactForPartner, containsForbiddenPartnerFields } from "@/lib/authz";
import { partnerRef } from "@/lib/refs";
import { mayShowCard, shortlistNameVisible } from "@/lib/reveal";
import { partnerHidden } from "@/lib/privacy";
import { EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { DateText } from "@/components/domain/date";
import { BriefChips, ReadCard, AnonCard, KIND_LABEL } from "@/components/domain/demand";
import { portalSubmitBrief, portalRespond, portalAcceptTerms } from "@/server/actions/demand";
import { toDomain } from "@/lib/brief-domain";
import { loadRateCard } from "@/server/queries";
import { resolvePortalAccount } from "@/server/queries";
import { parseBrief, fmt, PORTAL_VISIBLE, BRIEF_STATUS_LABELS, type HardCheck, type Terms, type RateCard } from "@/lib/demand";
import { fullName } from "@/lib/utils";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Tracker, stepsFrom } from "@/components/ui/tracker";
import { Constellation } from "@/components/ui/constellation";
import { Fold } from "@/components/ui/fold";
import { AgentPulse, type PulseLine } from "@/components/ui/agent-pulse";

export const metadata = { title: "Client & agency portal" };

function termsText(t: Terms, card: RateCard) {
  switch (t.model) {
    case "PERM_PCT": return `Success fee of ${t.pct}% of first-year base salary, invoiced on start date.`;
    case "AGENCY_REFERRAL": return `Referral share of ${t.pct}% of your placement fee (assumed ${card.agencyPermPct}% of salary), invoiced when your client pays.`;
    case "CONTRACT_MARGIN": return `${t.pct}% of the billed day rate for the length of the engagement.`;
    case "AGENCY_CONTRACT_SHARE": return `${t.pct}% of your margin on the day rate for the length of the engagement.`;
    case "EXPERT_HOURLY": return `${t.pct}% platform take on the expert's hourly rate; the expert receives the rest.`;
    case "SOW_SHARE": return `${t.pct}% of the SOW value for people we bring to the team.`;
    default: return `Flat introduction fee of ${fmt(t.flat ?? 0, t.currency)} per introduction.`;
  }
}

/**
 * What a client or agency sees. Every person passes through redactForPartner() and a defensive
 * check that no forbidden field reached the page. Names appear only after introduction.
 */
export default async function PortalPage({ searchParams }: { searchParams: Promise<{ account?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const account = await resolvePortalAccount(user, sp.account ?? null);
  const internal = isInternal(user);
  const accounts = internal ? await prisma.commercialAccount.findMany({ where: { tenantId: user.tenantId, portalEnabled: true }, orderBy: { createdAt: "asc" } }) : [];
  if (!account) return <EmptyState title="No portal account" description={internal ? "Enable the portal on an account in Requirements." : "Your account has not been connected to the portal yet. Ask your contact at Amana Network."} />;
  const [briefs, card] = await Promise.all([
    prisma.brief.findMany({ where: { accountId: account.id }, include: { shortlist: { include: { person: { include: { evidence: true, relationships: true, vouches: { select: { wouldRecommend: true, voucherKind: true, knownSince: true } }, conversations: { select: { approvalStatus: true, type: true, approvedById: true } } } } } } }, orderBy: { updatedAt: "desc" } }),
    loadRateCard(account.tenantId),
  ]);
  const preview = sp.q?.trim() ? parseBrief(sp.q) : null;
  const proposedCount = briefs.reduce((a, b) => a + b.shortlist.filter((s) => PORTAL_VISIBLE.includes(s.decision) && mayShowCard(s.person)).length, 0);
  const introCount = briefs.reduce((a, b) => a + b.shortlist.filter((s) => shortlistNameVisible(s, s.person)).length, 0);

  // What we are doing on this account right now, each line a fact.
  const live = briefs.filter((b) => !["FILLED", "CLOSED"].includes(b.status));
  const shown = (b: (typeof briefs)[number]) => b.shortlist.filter((s) => PORTAL_VISIBLE.includes(s.decision) && mayShowCard(s.person));
  const searching = live.filter((b) => shown(b).length === 0);
  const asking = live.reduce((a, b) => a + shown(b).filter((s) => s.decision === "CLIENT_INTERESTED").length, 0);
  const unsigned = live.filter((b) => !b.termsAccepted).length;
  const pulse = ([
    searching[0] ? { text: `Searching people we know for “${searching[0].title}”${searching.length > 1 ? ` and ${searching.length - 1} more` : ""}` } : null,
    proposedCount ? { text: `${proposedCount} ${proposedCount === 1 ? "person" : "people"} proposed. Names stay hidden until they say yes` } : null,
    asking ? { text: `Asking ${asking === 1 ? "the person you liked" : `${asking} people you liked`} whether they are happy to be introduced` } : null,
    unsigned ? { text: `${unsigned} ${unsigned === 1 ? "requirement needs" : "requirements need"} your terms before introductions` } : null,
  ] as (PulseLine | null)[]).filter((x): x is PulseLine => !!x);

  return (
    <>
      <section className="stage-ink mb-6 rounded-[24px] px-5 py-7 sm:px-9 sm:py-9">
        <Constellation focus={0.8} density={0.8} />
        <span className="stage-scrim" aria-hidden="true" />
        <div className="grid grid-cols-1 items-end gap-7 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            {internal ? <div className="mb-3 [&_select]:!bg-white [&_select]:!text-[#0c1b33]">{internal ? <form method="get" action="/portal" className="flex items-center gap-2 mt-2"><Select name="account" defaultValue={account.id} className="h-9 rounded-full bg-surface text-ink border-line-strong max-w-[340px]">{accounts.map((a) => <option key={a.id} value={a.id} className="text-ink">{a.name} · {KIND_LABEL[a.kind]}</option>)}</Select><SubmitButton size="sm" variant="secondary" pendingText="…">Switch</SubmitButton></form> : null}</div> : null}
            <h1 className="hero-title text-[34px] sm:text-[44px]">{account.name}</h1>
            <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.6] stage-muted">People we know first hand, proposed by what they have proven. Names stay hidden until you ask for an introduction and the person says yes.</p>
            <AgentPulse lines={pulse} onInk className="mt-6 max-w-[580px]" />
          </div>
          <dl className="flex flex-wrap gap-x-9 gap-y-4">
            {[["Open requests", briefs.filter((b) => !["FILLED", "CLOSED"].includes(b.status)).length], ["People proposed", proposedCount], ["Introductions", introCount]].map(([l, v]) => <div key={String(l)}><dt className="text-[12.5px] stage-muted">{l}</dt><dd className="figure-num mt-1 text-[34px] leading-none">{v}</dd></div>)}
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Submit a requirement" description="Plain words are fine. We will confirm anything unclear." />
            <CardBody>
              <form method="get" action="/portal" className="flex flex-col md:flex-row gap-2.5 md:items-end mb-3">
                {internal ? <input type="hidden" name="account" value={account.id} /> : null}
                <div className="relative flex-1"><Sparkles className="absolute left-3.5 top-3 h-4 w-4 text-navy-400 pointer-events-none" /><Textarea name="q" defaultValue={sp.q ?? ""} rows={2} className="pl-10 min-h-[64px]" placeholder={account.kind === "AGENCY" ? "e.g. We need 2 BAs already in Dubai with a visa, perm, retail banking, AED 360k" : account.kind === "CLIENT" ? "e.g. We want a permanent senior project manager for our digital programme, London, £95k, start January" : "e.g. Expert call: 2 hours on SAP S/4 go-live assurance for a utility, this week"} aria-label="Describe your requirement" /></div>
                <SubmitButton variant="secondary" pendingText="Reading…">Preview</SubmitButton>
              </form>
              {preview ? <div className="mb-3"><ReadCard b={preview} title="We read this as" /></div> : null}
              <form action={portalSubmitBrief} className="flex items-center justify-between gap-3">
                <input type="hidden" name="accountId" value={account.id} />
                <input type="hidden" name="text" value={sp.q ?? ""} />
                <span className="text-[12px] text-ink-faint">You see how we read it before it is sent. We come back with people we genuinely know, not a database search.</span>
                <SubmitButton disabled={!preview} pendingText="Sending…">Send requirement</SubmitButton>
              </form>
            </CardBody>
          </Card>

          {briefs.length === 0 ? <EmptyState title="No requirements yet" description="Send your first one above." /> : await Promise.all(briefs.map(async (b) => {
            const d = toDomain(b);
            const items = b.shortlist.filter((s) => PORTAL_VISIBLE.includes(s.decision) && mayShowCard(s.person));
            return (
              <Card key={b.id}>
                <CardHeader title={b.title} description={<>{BRIEF_STATUS_LABELS[b.status]} · sent <DateText date={b.createdAt} relative /></>} />
                <CardBody>
                  {(() => {
                    const at = (ds: string[]) => items.filter((x) => ds.includes(x.decision)).length;
                    const interested = at(["CLIENT_INTERESTED", "INTRODUCED", "PLACED"]), introduced = at(["INTRODUCED", "PLACED"]), placed = at(["PLACED"]);
                    return <Tracker className="mb-4" label={`Where "${b.title}" stands`} steps={stepsFrom([
                      { label: "Received", reached: true },
                      { label: "Searching", reached: b.status !== "NEW" },
                      { label: "Proposed", reached: items.length > 0, count: items.length },
                      { label: "Interested", reached: interested > 0, count: interested },
                      { label: "Introduced", reached: introduced > 0, count: introduced },
                      { label: "Placed", reached: placed > 0 || b.status === "FILLED", count: placed },
                    ])} />;
                  })()}
                  <BriefChips b={d} />
                  {b.questions.length && b.status !== "FILLED" ? <div className="mt-3 rounded-[12px] bg-amber-100 border border-amber/30 px-3 py-2.5 text-[12.5px]"><div className="label-caps tracking-wide font-medium text-amber mb-1">We will confirm with you</div><ul className="pl-4 list-disc space-y-0.5">{b.questions.map((q) => <li key={q}>{q}</li>)}</ul></div> : null}
                  <div className="mt-3 rounded-[12px] bg-surface-muted px-3 py-2.5 text-[12.5px] flex flex-wrap items-center gap-2"><b>Terms</b> {termsText(d.terms, card)} {b.termsAccepted ? <Badge tone="teal" filled>accepted</Badge> : <form action={portalAcceptTerms}><input type="hidden" name="briefId" value={b.id} /><SubmitButton size="sm" pendingText="…">Accept terms</SubmitButton></form>}</div>
                  <div className="text-[12px] font-medium text-ink-faint mt-4 mb-1">People we propose</div>
                  {items.length === 0 ? <div className="text-xs text-ink-muted">{b.status === "NEW" ? "Received. We are reading it now." : "Searching the network. You will see anonymised cards here first."}</div> : (
                    <ul>{items.map((s) => {
                      const hidden = partnerHidden({ privacy: s.person.privacy as never });
                      const safe = redactForPartner({ ...s.person, tenantId: b.tenantId, evidence: s.person.evidence, relationships: s.person.relationships }, { ref: partnerRef(account.id, s.person.id), hideRegion: hidden.region });
                      const leaked = containsForbiddenPartnerFields(safe);
                      if (leaked.length) throw new Error(`Portal redaction failed: ${leaked.join(", ")}`);
                      const checks = s.checks as HardCheck[];
                      const revealed = shortlistNameVisible(s, s.person);
                      // Why we put this person forward, from facts that never identify them: the brief's
                      // must-haves they meet, who stands behind them, and how we know them.
                      const met = checks.filter((c) => c.state === "met").length;
                      const vouchers = s.person.vouches.filter((v) => v.wouldRecommend).length;
                      const longest = Math.min(...s.person.vouches.filter((v) => v.wouldRecommend && v.knownSince).map((v) => v.knownSince as number));
                      const why = [
                        met ? `Meets ${met} of ${checks.length} of your must-haves` : null,
                        vouchers ? `Vouched for by ${vouchers} ${vouchers === 1 ? "person" : "people"} who would recommend them${Number.isFinite(longest) ? `, ${vouchers === 1 ? "who has" : "one has"} known them since ${longest}` : ""}` : null,
                        s.person.relationships.some((r) => r.introducedById) ? "Came to us through someone we know" : null,
                        s.person.relationships.some((r) => r.workedTogether) ? "We have delivered work alongside them" : null,
                      ].filter((x): x is string => !!x);
                      return <AnonCard key={s.id} refCode={safe.ref} headline={safe.headlineSummary || "Profile"} region={safe.region} availabilityBand={safe.availabilityBand} evidenceSummary={safe.evidenceSummary} proofs={safe.proofs} rights={checks.find((c) => c.label === "Work rights")} rateStated={hidden.rateBand ? null : s.person.rateExpectation ?? s.person.salaryExpectation} tier={s.tier} decision={s.decision} why={why} kind={account.kind} referred={s.referred} clientNote={s.clientNote} revealedName={revealed ? fullName(s.person) : null}
                        actions={s.decision === "PROPOSED" ? <><form action={portalRespond}><input type="hidden" name="itemId" value={s.id} /><input type="hidden" name="response" value="interested" /><SubmitButton size="sm" pendingText="…">Interested — request an introduction</SubmitButton></form><form action={portalRespond}><input type="hidden" name="itemId" value={s.id} /><input type="hidden" name="response" value="pass" /><Button size="sm" variant="ghost" type="submit">Not for us</Button></form></> : s.decision === "CLIENT_INTERESTED" ? <span className="text-[12px] text-ink-muted">Introduction requested. We are asking the person for consent{b.termsAccepted ? "" : " — accept the terms above to proceed"}.</span> : null} />;
                    })}</ul>
                  )}
                </CardBody>
              </Card>
            );
          }))}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="How this works" />
            <CardBody><ol className="pl-5 list-decimal space-y-2 text-[12.5px] text-ink-muted"><li><b className="text-ink">Describe the need</b> in plain words. We structure it and confirm what is unclear.</li><li><b className="text-ink">We search people we know</b>, not a database. Every card is someone a person in our network has seen deliver.</li><li><b className="text-ink">You see anonymised cards</b>: capability, region, availability, work-rights status, rate band.</li><li><b className="text-ink">Request an introduction.</b> The person is asked first. Names are revealed only with consent.</li><li><b className="text-ink">Fees are on success</b>, on the terms shown against each requirement.</li></ol><Fold className="mt-5 border-t border-line pt-4" summary={<span className="text-[13px] font-semibold text-ink">What you can and cannot see</span>}><div className="mt-3"><div className="grid grid-cols-2 gap-4 text-[12.5px]"><div><div className="font-semibold text-teal mb-1">Can</div><ul className="pl-4 list-disc space-y-0.5 text-ink-muted"><li>Your own requirements</li><li>Anonymised capability cards</li><li>Availability and work-rights status</li><li>Rate or salary band</li><li>Request an introduction</li></ul></div><div><div className="font-semibold text-risk mb-1">Cannot</div><ul className="pl-4 list-disc space-y-0.5 text-ink-muted"><li>Names before consent</li><li>Relationship notes</li><li>Who else is in the network</li><li>Other clients&apos; requirements</li><li>Export anything</li></ul></div></div></div></Fold></CardBody>
          </Card>
          {internal ? <div className="text-[12px] text-ink-faint">Internal preview. <Link href="/requirements" className="text-navy hover:underline">Back to requirements →</Link></div> : null}
        </div>
      </div>
    </>
  );
}
