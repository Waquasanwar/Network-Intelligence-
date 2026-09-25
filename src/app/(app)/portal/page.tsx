import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { isInternal, redactForPartner, containsForbiddenPartnerFields } from "@/lib/authz";
import { EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { DateText } from "@/components/domain/date";
import { BriefChips, ReadCard, AnonCard, KIND_LABEL } from "@/components/domain/demand";
import { portalSubmitBrief, portalRespond, portalAcceptTerms, toDomain } from "@/server/actions/demand";
import { loadRateCard } from "@/server/queries";
import { resolvePortalAccount } from "@/server/queries";
import { parseBrief, fmt, PORTAL_VISIBLE, BRIEF_STATUS_LABELS, type HardCheck, type Terms, type RateCard } from "@/lib/demand";
import { fullName } from "@/lib/utils";
import Link from "next/link";
import { Sparkles } from "lucide-react";

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
  if (!account) return <EmptyState title="No portal account" description={internal ? "Enable the portal on an account in Requirements." : "Your account has not been connected to the portal yet. Ask your contact at Network Intelligence."} />;
  const [briefs, card] = await Promise.all([
    prisma.brief.findMany({ where: { accountId: account.id }, include: { shortlist: { include: { person: { include: { evidence: true, relationships: true } } } } }, orderBy: { updatedAt: "desc" } }),
    loadRateCard(account.tenantId),
  ]);
  const preview = sp.q?.trim() ? parseBrief(sp.q) : null;
  const proposedCount = briefs.reduce((a, b) => a + b.shortlist.filter((s) => PORTAL_VISIBLE.includes(s.decision)).length, 0);
  const introCount = briefs.reduce((a, b) => a + b.shortlist.filter((s) => ["INTRODUCED", "PLACED"].includes(s.decision)).length, 0);

  return (
    <>
      <div className="relative rounded-[22px] px-8 py-7 mb-5 text-white bg-[radial-gradient(900px_400px_at_10%_0%,#163a52_0%,#0b1226_60%)] shadow-[var(--shadow-card)] grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/55">Client & agency portal{internal ? " · viewing as" : ""}</div>
          {internal ? <form method="get" action="/portal" className="flex items-center gap-2 mt-2"><Select name="account" defaultValue={account.id} className="h-9 rounded-full bg-white/10 text-white border-white/20 max-w-[340px]">{accounts.map((a) => <option key={a.id} value={a.id} className="text-ink">{a.name} · {KIND_LABEL[a.kind]}</option>)}</Select><SubmitButton size="sm" variant="secondary" pendingText="…">Switch</SubmitButton></form> : null}
          <h1 className="text-[30px] font-semibold tracking-[-0.03em] mt-2">{account.name}</h1>
          <p className="text-white/70 max-w-[60ch] mt-2 text-[13.5px] leading-5">What {account.kind === "AGENCY" ? "an agency" : account.kind === "CLIENT" ? "a client" : "Amana"} sees. Names are hidden until an introduction is requested and the person consents. Relationship notes never leave the network.</p>
        </div>
        <div className="flex gap-2.5">
          {[["Open requirements", briefs.filter((b) => !["FILLED", "CLOSED"].includes(b.status)).length], ["People proposed", proposedCount], ["Introductions", introCount]].map(([l, v]) => <div key={String(l)} className="min-w-[130px] rounded-[16px] bg-white/[0.07] border border-white/[0.12] px-4 py-3"><div className="text-[12px] text-white/60">{l}</div><div className="text-[24px] font-semibold tabular leading-8">{v}</div></div>)}
        </div>
      </div>

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
            const d = await toDomain(b);
            const items = b.shortlist.filter((s) => PORTAL_VISIBLE.includes(s.decision));
            return (
              <Card key={b.id}>
                <CardHeader title={b.title} description={<>{BRIEF_STATUS_LABELS[b.status]} · sent <DateText date={b.createdAt} relative /></>} />
                <CardBody>
                  <BriefChips b={d} />
                  {b.questions.length && b.status !== "FILLED" ? <div className="mt-3 rounded-[12px] bg-amber-100 border border-amber/30 px-3 py-2.5 text-[12.5px]"><div className="text-[10.5px] uppercase tracking-wide font-medium text-amber mb-1">We will confirm with you</div><ul className="pl-4 list-disc space-y-0.5">{b.questions.map((q) => <li key={q}>{q}</li>)}</ul></div> : null}
                  <div className="mt-3 rounded-[12px] bg-surface-muted px-3 py-2.5 text-[12.5px] flex flex-wrap items-center gap-2"><b>Terms</b> {termsText(d.terms, card)} {b.termsAccepted ? <Badge tone="teal" filled>accepted</Badge> : <form action={portalAcceptTerms}><input type="hidden" name="briefId" value={b.id} /><SubmitButton size="sm" pendingText="…">Accept terms</SubmitButton></form>}</div>
                  <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint mt-4 mb-1">People we propose</div>
                  {items.length === 0 ? <div className="text-xs text-ink-muted">{b.status === "NEW" ? "Received. We are reading it now." : "Searching the network. You will see anonymised cards here first."}</div> : (
                    <ul>{items.map((s) => {
                      const safe = redactForPartner({ ...s.person, tenantId: b.tenantId, evidence: s.person.evidence, relationships: s.person.relationships });
                      const leaked = containsForbiddenPartnerFields(safe);
                      if (leaked.length) throw new Error(`Portal redaction failed: ${leaked.join(", ")}`);
                      const checks = s.checks as HardCheck[];
                      const revealed = ["INTRODUCED", "PLACED"].includes(s.decision);
                      return <AnonCard key={s.id} refCode={safe.ref} headline={safe.headlineSummary || "Profile"} region={safe.region} availabilityBand={safe.availabilityBand} evidenceSummary={safe.evidenceSummary} rights={checks.find((c) => c.label === "Work rights")} rateStated={s.person.rateExpectation ?? s.person.salaryExpectation} tier={s.tier} decision={s.decision} kind={account.kind} referred={s.referred} clientNote={s.clientNote} revealedName={revealed ? fullName(s.person) : null}
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
            <CardBody><ol className="pl-5 list-decimal space-y-2 text-[12.5px] text-ink-muted"><li><b className="text-ink">Describe the need</b> in plain words. We structure it and confirm what is unclear.</li><li><b className="text-ink">We search people we know</b>, not a database. Every card is someone a person in our network has seen deliver.</li><li><b className="text-ink">You see anonymised cards</b>: capability, region, availability, work-rights status, rate band.</li><li><b className="text-ink">Request an introduction.</b> The person is asked first. Names are revealed only with consent.</li><li><b className="text-ink">Fees are on success</b>, on the terms shown against each requirement.</li></ol></CardBody>
          </Card>
          <Card>
            <CardHeader title="What you can and cannot see" />
            <CardBody><div className="grid grid-cols-2 gap-4 text-[12.5px]"><div><div className="font-semibold text-teal mb-1">Can</div><ul className="pl-4 list-disc space-y-0.5 text-ink-muted"><li>Your own requirements</li><li>Anonymised capability cards</li><li>Availability and work-rights status</li><li>Rate or salary band</li><li>Request an introduction</li></ul></div><div><div className="font-semibold text-risk mb-1">Cannot</div><ul className="pl-4 list-disc space-y-0.5 text-ink-muted"><li>Names before consent</li><li>Relationship notes</li><li>Who else is in the network</li><li>Other clients&apos; requirements</li><li>Export anything</li></ul></div></div></CardBody>
          </Card>
          {internal ? <div className="text-[12px] text-ink-faint">Internal preview. <Link href="/requirements" className="text-navy hover:underline">Back to requirements →</Link></div> : null}
        </div>
      </div>
    </>
  );
}
