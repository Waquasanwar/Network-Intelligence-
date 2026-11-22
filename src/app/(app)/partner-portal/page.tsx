import { requireUser } from "@/server/session";
import { NotOpen } from "@/components/domain/not-open";
import { isReleased } from "@/server/queries";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isPartner, redactForPartner, containsForbiddenPartnerFields } from "@/lib/authz";
import { partnerRef, opaqueKey } from "@/lib/refs";
import { introNameVisible, mayShowCard } from "@/lib/reveal";
import { partnerHidden } from "@/lib/privacy";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Chip } from "@/components/ui/badge";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { RouteBadge } from "@/components/domain/badges";
import { ProofLine } from "@/components/domain/standard";
import { DateText } from "@/components/domain/date";
import { submitPartnerRequirement, requestIntroductionFromPortal } from "@/server/actions/partners";
import { REQUIREMENT_STATUS_LABELS, ROUTE_LABELS, SENIORITY_LABELS } from "@/lib/labels";

export const metadata = { title: "Partner portal" };

/**
 * Restricted partner view. Every person shown here passes through redactForPartner() and a
 * defensive check that no forbidden field reached the page. Names appear only after an
 * internal human has approved an introduction and the person has consented.
 */
// What happened, in words a person would use. Anything not listed reads as its own name, tidied.
const ACTIONS: Record<string, string> = {
  "auth.login": "Signed in", "auth.login_failed": "Sign-in attempt failed", "partner.requirement": "Submitted a requirement",
  "portal.brief_submitted": "Submitted a requirement", "portal.response": "Replied about a proposal", "introduction.request": "Asked for an introduction",
  "terms.accept": "Accepted terms", "brief.search": "Searched the network", "identity.reveal": "A name was shared with you", "user.mfa_enable": "Turned on two-step sign-in",
};
const plainAction = (a: string) => ACTIONS[a] ?? (a.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase()));

export default async function PartnerPortal() {
  const user = await requireUser();
  // Nothing reaches clients or agencies until the owner releases it (Settings → Release).
  if (!(await isReleased(user, "agencyPortal"))) return <NotOpen />;
  if (!isPartner(user)) redirect("/forbidden");
  const partner = await prisma.partner.findUnique({ where: { tenantId: user.tenantId }, include: { requirements: { orderBy: { createdAt: "desc" } }, introductions: { orderBy: { createdAt: "desc" }, include: { opportunity: { select: { title: true } }, person: { select: { id: true, firstName: true, lastName: true, privacy: true, referralConsent: true } } } } } });
  if (!partner) redirect("/forbidden");
  const networkTenantId = partner.networkTenantId;

  const results = await Promise.all(
    partner.requirements.map(async (r) => {
      if (!networkTenantId || !r.linkedOpportunityId || !["RESULTS_SHARED", "INTRO_REQUESTED"].includes(r.status)) return { requirement: r, results: [] as ReturnType<typeof redactForPartner>[] };
      const opp = await prisma.opportunity.findFirst({ where: { id: r.linkedOpportunityId, tenantId: networkTenantId }, include: { matches: { where: { humanDecision: { in: ["RECOMMEND", "POSSIBLE"] } }, include: { person: { include: { evidence: { select: { evidenceType: true, visibility: true, description: true, context: true } }, relationships: { select: { sourceType: true, introducedById: true, workedTogether: true, wouldWorkTogetherAgain: true } }, vouches: { select: { wouldRecommend: true, voucherKind: true } }, conversations: { select: { approvalStatus: true, type: true, approvedById: true } } } } } } } });
      // Only people who are happy to be shown anonymously; the reference is keyed to this agency.
      const safe = opp ? opp.matches.filter((m) => mayShowCard(m.person)).map((m) => redactForPartner(m.person, { ref: partnerRef(partner.id, m.person.id), hideRegion: partnerHidden({ privacy: m.person.privacy as never }).region })) : [];
      const leaks = containsForbiddenPartnerFields(safe);
      if (leaks.length) throw new Error(`Partner data boundary violated: ${leaks.join(", ")}`);
      return { requirement: r, results: safe };
    }),
  );
  const audit = await prisma.auditLog.findMany({ where: { tenantId: user.tenantId }, select: { id: true, action: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 15 });
  // What reaches the page about an introduction: a name only when it may be shown, otherwise the
  // same keyed reference as the card. Never a database id.
  const intros = partner.introductions.map((i) => {
    const revealed = introNameVisible(i, i.person);
    return { key: opaqueKey(partner.id, i.id), revealed, label: revealed ? `${i.person.firstName} ${i.person.lastName}` : partnerRef(partner.id, i.person.id), title: i.opportunity.title, route: i.route, status: i.status };
  });

  return (
    <>
      <PageHeader eyebrow={partner.name} title="Partner portal" description="Submit requirements and receive anonymised capability summaries. Identities are shared only after the network owner approves an introduction and the person consents." />
      <div className="flex items-center gap-2 mb-5 text-xs">
        <Badge tone={partner.subscriptionStatus === "ACTIVE" ? "teal" : partner.subscriptionStatus === "TRIAL" ? "navy" : "amber"}>{partner.subscriptionStatus.toLowerCase()} subscription</Badge>
        <span className="text-ink-faint">{partner.subscriptionTier ?? ""} · {partner.commercialModel.replace(/_/g, " ").toLowerCase()}{partner.commercialSharePct ? ` at ${Number(partner.commercialSharePct)}%` : ""}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          {results.length === 0 ? <EmptyState title="No requirements yet" description="Submit your first requirement on the right." /> : results.map(({ requirement: r, results: rows }) => (
            <Card key={r.id}>
              <CardHeader title={r.title} description={`${r.location ?? ""}${r.seniority ? ` · ${SENIORITY_LABELS[r.seniority]}` : ""}${r.budget ? ` · ${r.budget}` : ""}`} action={<div className="flex items-center gap-1.5"><RouteBadge route={r.engagementRoute} /><Badge tone={r.status === "RESULTS_SHARED" ? "teal" : "neutral"}>{REQUIREMENT_STATUS_LABELS[r.status]}</Badge></div>} />
              <CardBody>
                <p className="text-xs text-ink-muted mb-3">{r.description}</p>
                {rows.length === 0 ? <div className="text-xs text-ink-faint">{r.status === "SUBMITTED" || r.status === "REVIEWING" ? "The network owner is reviewing this requirement." : "No shareable results yet."}</div> : (
                  <table className="data">
                    <thead><tr><th>Ref</th><th>Profile</th><th>Capabilities</th><th>Region</th><th>Availability</th><th>On record</th><th></th></tr></thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.ref}>
                          <td className="font-mono text-[12px] text-navy">{p.ref}</td>
                          <td className="text-xs">{p.headlineSummary}</td>
                          <td><div className="flex flex-wrap gap-1 max-w-[240px]">{p.capabilities.slice(0, 4).map((c) => <Chip key={c}>{c}</Chip>)}</div></td>
                          <td className="text-xs">{p.region ?? "undisclosed"}</td>
                          <td><Badge tone={p.availabilityBand === "near-term" ? "teal" : "neutral"}>{p.availabilityBand}</Badge></td>
                          <td className="min-w-[220px]">{p.proofs.length ? <ProofLine proofs={p.proofs} className="flex-col gap-y-0.5" /> : <span className="text-xs text-ink-muted">{p.evidenceSummary}</span>}</td>
                          <td className="text-right"><form action={requestIntroductionFromPortal}><input type="hidden" name="requirementId" value={r.id} /><input type="hidden" name="ref" value={p.ref} /><SubmitButton size="sm" variant="secondary" pendingText="…">Request introduction</SubmitButton></form></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardBody>
            </Card>
          ))}

          <Card>
            <CardHeader title="Your introductions" description="Names appear only once identity has been revealed with consent." />
            <CardBody>
              {intros.length === 0 ? <div className="text-xs text-ink-faint">None yet.</div> : (
                <ul className="space-y-2">{intros.map((i) => <li key={i.key} className="text-xs border border-line rounded-md px-2.5 py-2 flex items-center justify-between gap-2"><div><div className="font-medium text-[13px]">{i.revealed ? i.label : <span className="font-mono text-navy">{i.label}</span>}</div><div className="text-ink-faint">{i.title} · {ROUTE_LABELS[i.route]}</div></div><Badge tone={i.revealed ? "teal" : "amber"}>{i.revealed ? i.status.toLowerCase().replace(/_/g, " ") : ["REQUESTED", "DECLINED", "WITHDRAWN"].includes(i.status) ? i.status.toLowerCase() : "awaiting consent"}</Badge></li>)}</ul>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Submit a requirement" />
            <CardBody>
              <form action={submitPartnerRequirement} className="space-y-3">
                <Field label="Title" required><Input name="title" required /></Field>
                <Field label="What the client needs" required><Textarea name="description" required placeholder="The problem, the context, what good looks like." /></Field>
                <Field label="Route"><Select name="engagementRoute" defaultValue="PERMANENT">{Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Location"><Input name="location" /></Field>
                  <Field label="Seniority"><Select name="seniority" defaultValue=""><option value="">—</option>{Object.entries(SENIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                </div>
                <Field label="Required capabilities" hint="Comma separated"><Input name="requiredCapabilities" /></Field>
                <Field label="Budget"><Input name="budget" /></Field>
                <SubmitButton className="w-full" pendingText="Submitting…">Submit requirement</SubmitButton>
              </form>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Your activity" />
            <CardBody className="pt-0"><ul className="divide-y divide-line">{audit.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-[13px]"><span className="text-ink">{plainAction(a.action)}</span><DateText date={a.createdAt} relative className="flex-none text-[12px] text-ink-faint" /></li>)}</ul></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
