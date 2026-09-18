import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { redactForPartner } from "@/lib/authz";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Chip } from "@/components/ui/badge";
import { Input, Select, Textarea, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { IntroBadge, RouteBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { updatePartner, setRequirementStatus, submitPartnerRequirement } from "@/server/actions/partners";
import { REQUIREMENT_STATUS_LABELS, ROUTE_LABELS, SENIORITY_LABELS } from "@/lib/labels";
import { formatMoney, fullName } from "@/lib/utils";
import { Plus } from "lucide-react";

export const metadata = { title: "Partners" };

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ partner?: string }> }) {
  const user = await requireInternal();
  const sp = await searchParams;
  const partners = await prisma.partner.findMany({ include: { requirements: { orderBy: { createdAt: "desc" } }, introductions: { include: { person: true, opportunity: { select: { title: true } } } }, tenant: { select: { users: { select: { id: true, name: true, email: true, lastLoginAt: true } } } } }, orderBy: { name: "asc" } });
  const selected = partners.find((p) => p.id === sp.partner) ?? partners[0];
  const opportunities = await prisma.opportunity.findMany({ where: { tenantId: user.tenantId }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" } });
  const audit = selected ? await prisma.auditLog.findMany({ where: { tenantId: selected.tenantId }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }) : [];

  // What the partner sees for a linked requirement: anonymised results only.
  const previews = selected
    ? await Promise.all(
        selected.requirements.filter((r) => r.linkedOpportunityId).map(async (r) => {
          const opp = await prisma.opportunity.findUnique({ where: { id: r.linkedOpportunityId! }, include: { matches: { where: { humanDecision: { in: ["RECOMMEND", "POSSIBLE"] } }, include: { person: { include: { evidence: true } } } } } });
          return { requirement: r, results: opp ? opp.matches.map((m) => redactForPartner({ ...m.person, seniority: m.person.seniority, engagementPreferences: m.person.engagementPreferences })) : [] };
        }),
      )
    : [];
  const canEdit = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <>
      <PageHeader title="Partners" description="Licensed recruitment partners get controlled, anonymised access. They never see the black book. Commercial terms are configured per partner." actions={<NewRequirementDrawer partners={partners.map((p) => ({ id: p.id, name: p.name }))} />} />
      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-4">
        <div className="rounded-[16px] border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden self-start">
          <ul className="divide-y divide-line">
            {partners.map((p) => (
              <li key={p.id}>
                <Link href={`/partners?partner=${p.id}`} className={`block px-3 py-2.5 hover:bg-surface-muted ${selected?.id === p.id ? "bg-navy-100" : ""}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium">{p.name}</span><Badge tone={p.subscriptionStatus === "ACTIVE" ? "teal" : p.subscriptionStatus === "TRIAL" ? "navy" : "amber"}>{p.subscriptionStatus.toLowerCase()}</Badge></div>
                  <div className="text-[11px] text-ink-faint">{p.requirements.length} requirements · {p.introductions.length} introductions</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {selected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader title="Subscription & commercial model" description="Configurable. Nothing is hard-coded." />
                <CardBody>
                  <form action={updatePartner} className="space-y-3">
                    <input type="hidden" name="partnerId" value={selected.id} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Status"><Select name="subscriptionStatus" defaultValue={selected.subscriptionStatus} disabled={!canEdit}><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="CANCELLED">Cancelled</option></Select></Field>
                      <Field label="Tier"><Input name="subscriptionTier" defaultValue={selected.subscriptionTier ?? ""} disabled={!canEdit} /></Field>
                      <Field label="Commercial model"><Select name="commercialModel" defaultValue={selected.commercialModel} disabled={!canEdit}><option value="SUCCESS_SHARE">Success share</option><option value="INTRODUCTION_FEE">Introduction fee</option><option value="SUBSCRIPTION_INCLUDED">Included in subscription</option><option value="NONE">None</option></Select></Field>
                      <Field label="Share %" hint="Target 10–20% where lawful and agreed"><Input name="commercialSharePct" type="number" step="0.5" min={0} max={100} defaultValue={selected.commercialSharePct ? Number(selected.commercialSharePct) : ""} disabled={!canEdit} /></Field>
                      <Field label="Monthly fee"><Input name="monthlyFee" defaultValue={selected.monthlyFee ? Number(selected.monthlyFee) : ""} disabled={!canEdit} /></Field>
                      <Field label="Currency"><Select name="currency" defaultValue={selected.currency} disabled={!canEdit}><option>GBP</option><option>AED</option><option>SAR</option><option>USD</option></Select></Field>
                    </div>
                    <Checkbox name="licensedForPermanent" label="Licensed for permanent placements" defaultChecked={selected.licensedForPermanent} disabled={!canEdit} />
                    <Field label="Notes"><Textarea name="notes" defaultValue={selected.notes ?? ""} disabled={!canEdit} /></Field>
                    {canEdit ? <div className="flex justify-end"><SubmitButton>Save terms</SubmitButton></div> : <div className="text-[11px] text-ink-faint">Only owners and admins can change commercial terms.</div>}
                  </form>
                </CardBody>
              </Card>
              <div className="space-y-4">
                <Card>
                  <CardHeader title="Data boundary" description="What this partner can and cannot see" />
                  <CardBody>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><div className="text-teal font-medium mb-1">Can</div><ul className="space-y-0.5 text-ink-muted"><li>Submit requirements</li><li>See anonymised capability summaries</li><li>Request an introduction</li><li>Track their own activity</li></ul></div>
                      <div><div className="text-risk font-medium mb-1">Cannot</div><ul className="space-y-0.5 text-ink-muted"><li>Browse relationship notes</li><li>Export the network</li><li>See who else is in the database</li><li>See other partners or Amana activity</li><li>Contact hidden profiles</li></ul></div>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Partner users" />
                  <CardBody>
                    <ul className="text-xs space-y-1">{selected.tenant.users.map((u) => <li key={u.id} className="flex justify-between"><span>{u.name} <span className="text-ink-faint">{u.email}</span></span><span className="text-ink-faint">{u.lastLoginAt ? <DateText date={u.lastLoginAt} relative /> : "never signed in"}</span></li>)}{!selected.tenant.users.length ? <li className="text-ink-faint">No users provisioned.</li> : null}</ul>
                  </CardBody>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader title="Partner requirements" description="Link a requirement to an opportunity to share anonymised results." />
              <CardBody className="px-0 pb-0">
                {selected.requirements.length === 0 ? <div className="px-4 pb-4"><EmptyState title="No requirements submitted" /></div> : (
                  <table className="data">
                    <thead><tr><th className="pl-4">Requirement</th><th>Route</th><th>Capabilities</th><th>Budget</th><th>Status</th><th>Linked opportunity</th></tr></thead>
                    <tbody>
                      {selected.requirements.map((r) => (
                        <tr key={r.id}>
                          <td className="pl-4"><div className="font-medium">{r.title}</div><div className="text-[11px] text-ink-faint">{r.location ?? "—"} · {r.seniority ? SENIORITY_LABELS[r.seniority] : "—"} · <DateText date={r.createdAt} relative /></div></td>
                          <td><RouteBadge route={r.engagementRoute} /></td>
                          <td><div className="flex flex-wrap gap-1 max-w-[220px]">{r.requiredCapabilities.map((c) => <Chip key={c}>{c}</Chip>)}</div></td>
                          <td className="text-xs">{r.budget ?? "—"}</td>
                          <td><Badge tone={r.status === "INTRO_REQUESTED" ? "amber" : r.status === "CLOSED" ? "neutral" : "navy"}>{REQUIREMENT_STATUS_LABELS[r.status]}</Badge></td>
                          <td>
                            <form action={setRequirementStatus} className="flex items-center gap-1.5">
                              <input type="hidden" name="requirementId" value={r.id} />
                              <Select name="linkedOpportunityId" defaultValue={r.linkedOpportunityId ?? ""} className="h-7 text-[11px] w-[200px]"><option value="">— not linked —</option>{opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</Select>
                              <Select name="status" defaultValue={r.status} className="h-7 text-[11px] w-[150px]">{Object.entries(REQUIREMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                              <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader title="What the partner sees" description="Restricted, anonymised results for linked requirements" />
                <CardBody>
                  {previews.length === 0 ? <div className="text-xs text-ink-faint">Link a requirement to an opportunity with recommended or possible matches.</div> : previews.map(({ requirement, results }) => (
                    <div key={requirement.id} className="mb-3">
                      <div className="text-xs font-medium mb-1">{requirement.title}</div>
                      {results.length === 0 ? <div className="text-[11px] text-ink-faint">No shareable results yet (only Recommend / Possible decisions are shared).</div> : (
                        <ul className="space-y-1.5">{results.map((r) => <li key={r.ref} className="rounded-md border border-line px-2.5 py-2 text-xs"><div className="flex items-center justify-between"><span className="font-mono text-[11px] text-navy">{r.ref}</span><Badge tone={r.availabilityBand === "near-term" ? "teal" : "neutral"}>{r.availabilityBand}</Badge></div><div className="text-ink-muted mt-0.5">{r.headlineSummary} · {r.region ?? "region undisclosed"}</div><div className="text-ink-faint">{r.evidenceSummary}</div></li>)}</ul>
                      )}
                    </div>
                  ))}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Introduction requests & commercial tracking" />
                <CardBody>
                  {selected.introductions.length === 0 ? <div className="text-xs text-ink-faint">No introductions yet.</div> : (
                    <ul className="space-y-2">{selected.introductions.map((i) => <li key={i.id} className="text-xs border border-line rounded-md px-2.5 py-2"><div className="flex items-center justify-between"><span className="font-medium text-[13px]">{fullName(i.person)}</span><IntroBadge status={i.status} /></div><div className="text-ink-faint">{i.opportunity.title}</div><div className="text-ink-muted mt-0.5">{ROUTE_LABELS[i.route]} · {i.commercialModel.replace(/_/g, " ").toLowerCase()}{i.commercialSharePct ? ` ${Number(i.commercialSharePct)}%` : ""}{i.commercialValue ? ` of ${formatMoney(Number(i.commercialValue), i.currency ?? "GBP")} ≈ ${formatMoney(Number(i.commercialValue) * (Number(i.commercialSharePct ?? 0) / 100), i.currency ?? "GBP")}` : ""}</div><div className="text-ink-faint">Consent {i.consentStatus.toLowerCase()} · identity {i.status === "IDENTITY_REVEALED" || i.status === "INTRODUCED" || i.status === "ENGAGED" ? "revealed" : "hidden"}</div></li>)}</ul>
                  )}
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader title="Partner audit activity" />
              <CardBody>
                {audit.length === 0 ? <div className="text-xs text-ink-faint">No activity.</div> : <ul className="text-xs space-y-1">{audit.map((a) => <li key={a.id} className="flex justify-between gap-2"><span>{a.actor?.name ?? "system"} · <span className="font-mono text-[11px]">{a.action}</span></span><DateText date={a.createdAt} relative className="text-ink-faint" /></li>)}</ul>}
              </CardBody>
            </Card>
          </div>
        ) : <EmptyState title="No partners" />}
      </div>
    </>
  );
}

function NewRequirementDrawer({ partners }: { partners: { id: string; name: string }[] }) {
  return (
    <Drawer trigger={<Button><Plus className="h-3.5 w-3.5" /> Log requirement</Button>} title="Log a partner requirement" description="On behalf of a partner (they can also submit from their portal).">
      <form action={submitPartnerRequirement} className="space-y-4">
        <Field label="Partner" required><Select name="partnerId" required defaultValue="">{[<option key="" value="" disabled>Choose…</option>, ...partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)]}</Select></Field>
        <Field label="Title" required><Input name="title" required /></Field>
        <Field label="Description" required><Textarea name="description" required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Route"><Select name="engagementRoute" defaultValue="PERMANENT">{Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Location"><Input name="location" /></Field>
          <Field label="Seniority"><Select name="seniority" defaultValue=""><option value="">—</option>{Object.entries(SENIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Budget"><Input name="budget" /></Field>
        </div>
        <Field label="Required capabilities" hint="Comma separated"><Input name="requiredCapabilities" /></Field>
        <div className="flex justify-end"><SubmitButton>Log requirement</SubmitButton></div>
      </form>
    </Drawer>
  );
}
