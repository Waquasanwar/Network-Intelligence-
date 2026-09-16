import { requireUser } from "@/server/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isPartner, redactForPartner, containsForbiddenPartnerFields, opaqueRef } from "@/lib/authz";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Chip } from "@/components/ui/badge";
import { Input, Select, Textarea, Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { RouteBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { submitPartnerRequirement, requestIntroductionFromPortal } from "@/server/actions/partners";
import { REQUIREMENT_STATUS_LABELS, ROUTE_LABELS, SENIORITY_LABELS } from "@/lib/labels";

export const metadata = { title: "Partner portal" };

/**
 * Restricted partner view. Every person shown here passes through redactForPartner() and a
 * defensive check that no forbidden field reached the page. Names appear only after an
 * internal human has approved an introduction and the person has consented.
 */
export default async function PartnerPortal() {
  const user = await requireUser();
  if (!isPartner(user)) redirect("/forbidden");
  const partner = await prisma.partner.findUnique({ where: { tenantId: user.tenantId }, include: { requirements: { orderBy: { createdAt: "desc" } }, introductions: { include: { opportunity: { select: { title: true } }, person: { select: { id: true, firstName: true, lastName: true, headline: true } } } } } });
  if (!partner) redirect("/forbidden");

  const results = await Promise.all(
    partner.requirements.map(async (r) => {
      if (!r.linkedOpportunityId || !["RESULTS_SHARED", "INTRO_REQUESTED"].includes(r.status)) return { requirement: r, results: [] as ReturnType<typeof redactForPartner>[] };
      const opp = await prisma.opportunity.findUnique({ where: { id: r.linkedOpportunityId }, include: { matches: { where: { humanDecision: { in: ["RECOMMEND", "POSSIBLE"] } }, include: { person: { include: { evidence: { select: { evidenceType: true, visibility: true, description: true, context: true } } } } } } } });
      const safe = opp ? opp.matches.map((m) => redactForPartner(m.person)) : [];
      const leaks = containsForbiddenPartnerFields(safe);
      if (leaks.length) throw new Error(`Partner data boundary violated: ${leaks.join(", ")}`);
      return { requirement: r, results: safe };
    }),
  );
  const [audit] = await Promise.all([prisma.auditLog.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: "desc" }, take: 15 })]);

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
                    <thead><tr><th>Ref</th><th>Profile</th><th>Capabilities</th><th>Region</th><th>Availability</th><th>Evidence</th><th></th></tr></thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.ref}>
                          <td className="font-mono text-[11px] text-navy">{p.ref}</td>
                          <td className="text-xs">{p.headlineSummary}</td>
                          <td><div className="flex flex-wrap gap-1 max-w-[240px]">{p.capabilities.slice(0, 4).map((c) => <Chip key={c}>{c}</Chip>)}</div></td>
                          <td className="text-xs">{p.region ?? "undisclosed"}</td>
                          <td><Badge tone={p.availabilityBand === "near-term" ? "teal" : "neutral"}>{p.availabilityBand}</Badge></td>
                          <td className="text-xs text-ink-muted">{p.evidenceSummary}</td>
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
              {partner.introductions.length === 0 ? <div className="text-xs text-ink-faint">None yet.</div> : (
                <ul className="space-y-2">{partner.introductions.map((i) => { const revealed = ["IDENTITY_REVEALED", "INTRODUCED", "IN_PROGRESS", "ENGAGED"].includes(i.status); return <li key={i.id} className="text-xs border border-line rounded-md px-2.5 py-2 flex items-center justify-between gap-2"><div><div className="font-medium text-[13px]">{revealed ? `${i.person.firstName} ${i.person.lastName}` : <span className="font-mono text-navy">{opaqueRef(i.person.id)}</span>}</div><div className="text-ink-faint">{i.opportunity.title} · {ROUTE_LABELS[i.route]}</div></div><Badge tone={revealed ? "teal" : "amber"}>{i.status.toLowerCase().replace(/_/g, " ")}</Badge></li>; })}</ul>
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
            <CardBody><ul className="text-xs space-y-1">{audit.map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="font-mono text-[11px]">{a.action}</span><DateText date={a.createdAt} relative className="text-ink-faint" /></li>)}</ul></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
