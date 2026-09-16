import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { PageHeader, Tabs, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { PersonLink } from "@/components/domain/person-link";
import { DateText } from "@/components/domain/date";
import { CaptureConversationDrawer } from "@/components/domain/person-drawers";
import { approveSummary, rejectSummary, regenerateSummary, cancelScheduled } from "@/server/actions/conversations";
import { AVAILABILITY_LABELS, ROUTE_LABELS } from "@/lib/labels";
import type { ExtractedSummary } from "@/lib/ai";
import { fullName } from "@/lib/utils";

export const metadata = { title: "Conversations" };

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ tab?: string; open?: string }> }) {
  const user = await requireInternal();
  const { tab = "upcoming", open } = await searchParams;
  const now = new Date();

  const [upcoming, followUps, review, completed, peopleLite] = await Promise.all([
    prisma.scheduledConversation.findMany({ where: { tenantId: user.tenantId, status: "SCHEDULED", startAt: { gte: new Date(now.getTime() - 3600_000) } }, include: { person: true }, orderBy: { startAt: "asc" } }),
    prisma.conversation.findMany({ where: { person: { tenantId: user.tenantId }, followUpDate: { not: null, lte: new Date(now.getTime() + 14 * 86_400_000) } }, include: { person: true }, orderBy: { followUpDate: "asc" } }),
    prisma.conversation.findMany({ where: { person: { tenantId: user.tenantId }, approvalStatus: { in: ["NEEDS_REVIEW", "DRAFT"] } }, include: { person: true, conductedBy: { select: { name: true } } }, orderBy: { date: "desc" } }),
    prisma.conversation.findMany({ where: { person: { tenantId: user.tenantId }, approvalStatus: "APPROVED" }, include: { person: true, conductedBy: { select: { name: true } }, approvedBy: { select: { name: true } } }, orderBy: { date: "desc" }, take: 50 }),
    prisma.person.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
  ]);

  const opened = open ? review.find((c) => c.id === open) ?? null : review[0] ?? null;
  const draft = (opened?.aiSummary ?? null) as ExtractedSummary | null;

  const tabs = [
    { key: "upcoming", label: "Upcoming", count: upcoming.length },
    { key: "followups", label: "Follow-ups", count: followUps.length },
    { key: "review", label: "Needs review", count: review.length },
    { key: "completed", label: "Completed", count: completed.length },
  ];

  return (
    <>
      <PageHeader title="Conversations" description="Natural conversations, structured by AI, approved by you. Nothing becomes authoritative until reviewed." actions={<QuickCapture people={peopleLite} />} />
      <Tabs items={tabs} current={tab} base="/conversations" />

      {tab === "upcoming" ? (
        upcoming.length === 0 ? <EmptyState title="Nothing booked" description="Book a conversation from a person's profile." /> : (
          <div className="rounded-lg border border-line bg-surface overflow-hidden">
            <table className="data">
              <thead><tr><th>When</th><th>Person</th><th>Type</th><th>Provider</th><th></th></tr></thead>
              <tbody>
                {upcoming.map((u) => (
                  <tr key={u.id}>
                    <td><div className="font-medium"><DateText date={u.startAt} relative /></div><div className="text-[11px] text-ink-faint">{u.startAt.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div></td>
                    <td><PersonLink person={u.person} /></td>
                    <td className="text-xs">{u.meetingType.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="text-xs">{u.provider === "MANUAL" ? "Manual" : u.provider === "CALENDLY" ? "Calendly" : "Outlook / Teams"}{u.eventUrl ? <> · <a className="text-navy hover:underline" href={u.eventUrl} target="_blank" rel="noreferrer noopener">join</a></> : null}</td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <CaptureConversationDrawer personId={u.personId} scheduledEventId={u.id} label="Capture" />
                        <form action={cancelScheduled}><input type="hidden" name="scheduledId" value={u.id} /><Button variant="ghost" size="sm" type="submit">Cancel</Button></form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "followups" ? (
        followUps.length === 0 ? <EmptyState title="No follow-ups due" /> : (
          <div className="rounded-lg border border-line bg-surface overflow-hidden">
            <table className="data"><thead><tr><th>Due</th><th>Person</th><th>From conversation</th><th></th></tr></thead>
              <tbody>{followUps.map((c) => <tr key={c.id}><td><DateText date={c.followUpDate} relative className={c.followUpDate! < now ? "text-amber font-medium" : ""} /></td><td><PersonLink person={c.person} /></td><td className="text-xs text-ink-muted"><DateText date={c.date} /> · {c.type.replace(/_/g, " ").toLowerCase()}</td><td className="text-right"><CaptureConversationDrawer personId={c.personId} label="Log follow-up" /></td></tr>)}</tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === "review" ? (
        review.length === 0 ? <EmptyState title="Nothing to review" description="Captured conversations appear here with a structured draft for approval." /> : (
          <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4">
            <div className="rounded-lg border border-line bg-surface overflow-hidden self-start">
              <ul className="divide-y divide-line">
                {review.map((c) => (
                  <li key={c.id}>
                    <Link href={`/conversations?tab=review&open=${c.id}`} className={`block px-3 py-2.5 hover:bg-surface-muted ${opened?.id === c.id ? "bg-navy-100" : ""}`}>
                      <div className="text-[13px] font-medium">{fullName(c.person)}</div>
                      <div className="text-[11px] text-ink-faint flex items-center gap-1.5"><DateText date={c.date} /> · {c.conductedBy.name.split(" ")[0]} <Badge tone={c.approvalStatus === "DRAFT" ? "neutral" : "amber"}>{c.approvalStatus === "DRAFT" ? "draft" : "AI draft"}</Badge></div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {opened ? (
              <Card>
                <CardHeader title={`Review: ${fullName(opened.person)}`} description={`${opened.type.replace(/_/g, " ").toLowerCase()} on ${opened.date.toLocaleDateString("en-GB")}. Edit anything that is wrong. Approving makes it authoritative.`} action={<Link href={`/network/${opened.personId}`} className="text-xs text-navy hover:underline">Open profile</Link>} />
                <CardBody>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div>
                      <div className="text-[11px] uppercase text-ink-faint mb-1">Source material</div>
                      <div className="rounded-md border border-line bg-surface-muted p-3 text-xs whitespace-pre-wrap max-h-[420px] overflow-y-auto">{opened.rawNotes || "(no notes)"}{opened.transcript ? `\n\n--- transcript ---\n${opened.transcript}` : ""}</div>
                      {!draft ? (
                        <form action={regenerateSummary} className="mt-3"><input type="hidden" name="conversationId" value={opened.id} /><SubmitButton variant="secondary" pendingText="Structuring…">Structure with AI</SubmitButton></form>
                      ) : null}
                    </div>
                    <form action={approveSummary} className="space-y-3">
                      <input type="hidden" name="conversationId" value={opened.id} />
                      <Field label="Headline"><Input name="headline" defaultValue={draft?.headline ?? ""} /></Field>
                      <Field label="Summary"><Textarea name="summary" defaultValue={draft?.summary ?? ""} /></Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Capabilities" hint="comma separated"><Textarea name="capabilities" defaultValue={draft?.capabilities.join(", ") ?? ""} className="min-h-[56px]" /></Field>
                        <Field label="Sectors" hint="comma separated"><Textarea name="sectors" defaultValue={draft?.sectors.join(", ") ?? ""} className="min-h-[56px]" /></Field>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-ink-muted mb-1">Engagement preferences</div>
                        <div className="flex flex-wrap gap-3">{Object.entries(ROUTE_LABELS).map(([k, v]) => <Checkbox key={k} name="engagementPreferences" value={k} label={v} defaultChecked={draft?.engagementPreferences.includes(k as never)} />)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Location preferences" hint="comma separated"><Input name="locationPreferences" defaultValue={draft?.locationPreferences.join(", ") ?? ""} /></Field>
                        <Field label="Rates / salary"><Input name="ratesOrSalary" defaultValue={draft?.ratesOrSalary ?? ""} /></Field>
                        <Field label="Current status"><Input name="currentStatus" defaultValue={draft?.currentStatus ?? ""} /></Field>
                        <Field label="Availability status"><Select name="suggestedAvailabilityStatus" defaultValue={draft?.suggestedAvailabilityStatus ?? ""}><option value="">Leave unchanged</option>{Object.entries(AVAILABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Strengths" hint="one per line"><Textarea name="strengths" defaultValue={draft?.strengths.join("\n") ?? ""} /></Field>
                        <Field label="Does not want" hint="one per line"><Textarea name="avoid" defaultValue={draft?.avoid.join("\n") ?? ""} /></Field>
                        <Field label="Working characteristics" hint="one per line"><Textarea name="workingCharacteristics" defaultValue={draft?.workingCharacteristics.join("\n") ?? ""} /></Field>
                        <Field label="Constraints" hint="one per line"><Textarea name="constraints" defaultValue={draft?.constraints.join("\n") ?? ""} /></Field>
                      </div>
                      <Field label="Unresolved questions" hint="one per line"><Textarea name="unresolvedQuestions" defaultValue={draft?.unresolvedQuestions.join("\n") ?? ""} /></Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Follow-up (as said)"><Input name="followUpDate" defaultValue={draft?.followUpDate ?? ""} /></Field>
                        <Field label="Follow-up date"><Input type="date" name="followUpISO" /></Field>
                      </div>
                      <Checkbox name="applyToProfile" label="Apply approved fields to the profile (capabilities, preferences, availability)" defaultChecked />
                      <div className="flex items-center justify-between pt-2">
                        <SubmitButton variant="teal" pendingText="Approving…">Approve summary</SubmitButton>
                        <SubmitButton formAction={rejectSummary} variant="ghost" pendingText="…">Discard draft</SubmitButton>
                      </div>
                    </form>
                  </div>
                </CardBody>
              </Card>
            ) : null}
          </div>
        )
      ) : null}

      {tab === "completed" ? (
        completed.length === 0 ? <EmptyState title="No approved conversations yet" /> : (
          <div className="rounded-lg border border-line bg-surface overflow-hidden">
            <table className="data"><thead><tr><th>Date</th><th>Person</th><th>Type</th><th>Summary</th><th>By</th><th>Follow-up</th></tr></thead>
              <tbody>{completed.map((c) => { const s = c.approvedSummary as ExtractedSummary | null; return <tr key={c.id}><td><DateText date={c.date} /></td><td><PersonLink person={c.person} sub={null} /></td><td className="text-xs">{c.type.replace(/_/g, " ").toLowerCase()}</td><td className="text-xs text-ink-muted max-w-[380px]">{s?.summary ?? "—"}</td><td className="text-xs">{c.conductedBy.name.split(" ")[0]}{c.approvedBy ? <div className="text-[11px] text-ink-faint">approved by {c.approvedBy.name.split(" ")[0]}</div> : null}</td><td><DateText date={c.followUpDate} relative /></td></tr>; })}</tbody>
            </table>
          </div>
        )
      ) : null}
    </>
  );
}

function QuickCapture({ people }: { people: { id: string; firstName: string; lastName: string }[] }) {
  // Lightweight entry point: pick a person then capture. Implemented as a small form that jumps to the profile drawer.
  return (
    <form action="/conversations/capture" method="get" className="flex items-center gap-2">
      <Select name="personId" className="w-[220px]" defaultValue="">
        <option value="" disabled>Capture for…</option>
        {people.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
      </Select>
      <Button type="submit" variant="secondary">Go</Button>
    </form>
  );
}
