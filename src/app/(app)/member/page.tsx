import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { isInternal, redactForPartner } from "@/lib/authz";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState, Tabs } from "@/components/ui/page";
import { AvailabilityBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { TrustCard, FitCard, ScreeningBadge } from "@/components/domain/trust";
import { BookScreeningDrawer, PitchDrawer } from "@/components/domain/member-drawers";
import { trustFor, fitFor, startScreening, setConsent, submitReferral } from "@/server/actions/members";
import { resolveMemberPerson } from "@/server/queries";
import { TRUST_INCLUDE } from "@/lib/trust-include";
import { TRUST_BAND_LABEL } from "@/lib/trust";
import { fitHighlights, ATTRIBUTES } from "@/lib/fit";
import { rateBand } from "@/lib/demand";
import { SCREENING_MINUTES, SCREENING_SCRIPT } from "@/lib/screening";
import { ROUTE_LABELS } from "@/lib/labels";
import { fullName } from "@/lib/utils";

export const metadata = { title: "My network profile" };

const REF_STATUS: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", SCREENING: "Screening booked", ACCEPTED: "In the network", DECLINED: "Not now" };
const PITCH_STATUS: Record<string, string> = { SUBMITTED: "Submitted", SHORTLISTED: "On the shortlist", DECLINED: "Not this time" };

export default async function MemberPage({ searchParams }: { searchParams: Promise<{ tab?: string; person?: string; sent?: string; screened?: string; welcome?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const internal = isInternal(user);
  const base = await resolveMemberPerson(user, sp.person ?? null);
  if (!base) return <EmptyState title="No member profile" description={internal ? "Nobody has joined as a member yet. Share the join link." : "Your login is not linked to a profile yet. Ask your contact at Network Intelligence."} />;
  const p = await prisma.person.findUnique({ where: { id: base.id }, include: { ...TRUST_INCLUDE, referralsMade: { include: { brief: { select: { title: true } } }, orderBy: { createdAt: "desc" } }, pitches: { include: { brief: { select: { id: true, roles: true } } } } } });
  if (!p) redirect("/forbidden");
  const [members, open] = await Promise.all([
    internal ? prisma.person.findMany({ where: { tenantId: p.tenantId, memberSince: { not: null } }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }) : Promise.resolve([]),
    prisma.brief.findMany({ where: { tenantId: p.tenantId, openToMembers: true, status: { notIn: ["FILLED", "CLOSED"] } }, orderBy: { updatedAt: "desc" } }),
  ]);
  const tab = sp.tab ?? "home";
  const t = await trustFor(p); const fit = await fitFor(p);
  const screened = p.screeningStatus === "APPROVED" || !!p.screenedAt; const submitted = p.screeningStatus === "SUBMITTED";
  const anon = redactForPartner({ ...p, evidence: p.evidence, relationships: p.relationships });
  const highlights = fitHighlights(fit); const band = rateBand(p.rateExpectation ?? p.salaryExpectation);
  const accepted = p.referralsMade.filter((r) => r.status === "ACCEPTED").length;

  const OppCard = ({ b }: { b: (typeof open)[number] }) => { const pitched = p.pitches.find((x) => x.briefId === b.id); const refd = p.referralsMade.filter((r) => r.briefId === b.id).length; const summary = `${b.roles[0] ?? "Requirement"}${b.headcount > 1 ? ` × ${b.headcount}` : ""} · ${b.engagementRoute ? ROUTE_LABELS[b.engagementRoute] : "route to confirm"} · ${b.locations.join(" / ") || "location flexible"}`; return (
    <Card key={b.id}>
      <CardBody className="pt-4">
        <div className="flex items-start justify-between gap-3"><div><div className="text-[14px] font-semibold">{b.roles[0] ?? "Requirement"}{b.headcount > 1 ? ` × ${b.headcount}` : ""}</div><div className="text-[11.5px] text-ink-faint">{b.engagementRoute ? ROUTE_LABELS[b.engagementRoute] : "route to confirm"} · {b.locations.join(" / ") || "location flexible"} · {b.sectors.join(", ") || "any sector"}</div></div><Badge filled>client name hidden</Badge></div>
        <p className="text-[13.5px] leading-6 my-2.5">{b.memberSummary ?? b.rawText}</p>
        <div className="flex flex-wrap gap-1 mb-3">{b.capabilities.map((c) => <Chip key={c}>{c}</Chip>)}{b.workRights ? <Chip>{b.workRights}</Chip> : null}</div>
        <div className="flex flex-wrap items-center gap-2">{pitched ? <Badge tone={pitched.status === "SHORTLISTED" ? "teal" : "navy"} filled>You pitched · {PITCH_STATUS[pitched.status]}</Badge> : screened ? <PitchDrawer briefId={b.id} asPersonId={internal ? p.id : undefined} summary={summary} /> : <small className="text-ink-faint">Complete your screening to pitch.</small>}<Link href={`/member?tab=refer&for=${b.id}${internal ? `&person=${p.id}` : ""}`}><Button size="sm" variant="secondary" type="button">Refer someone</Button></Link>{refd ? <Badge tone="teal" filled>{refd} referred</Badge> : null}</div>
      </CardBody>
    </Card>
  ); };

  return (
    <>
      {internal ? <div className="flex items-center gap-2 mb-3 text-[12px] text-ink-faint">Internal preview of the member portal. Viewing as <form method="get" action="/member" className="inline-flex items-center gap-1.5"><Select name="person" defaultValue={p.id} className="h-7 text-xs w-[220px]">{members.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}</Select><SubmitButton size="sm" variant="secondary" pendingText="…">Switch</SubmitButton></form></div> : null}
      {sp.welcome ? <div className="mb-4 rounded-[14px] border border-teal/30 bg-teal-50 px-4 py-3 text-[13px]">Welcome. {p.firstName}, your registration has reached the network owner. Your screening is the next step, and it is what puts you on the radar.</div> : null}
      {sp.screened ? <div className="mb-4 rounded-[14px] border border-teal/30 bg-teal-50 px-4 py-3 text-[13px]">Thank you. A person will review your screening and confirm your profile.</div> : null}
      {sp.sent ? <div className="mb-4 rounded-[14px] border border-teal/30 bg-teal-50 px-4 py-3 text-[13px]">Thank you. Your referral is with us to review.</div> : null}

      <div className="rounded-[22px] px-8 py-7 mb-5 text-white bg-[radial-gradient(900px_400px_at_10%_0%,#163a52_0%,#0b1226_60%)] shadow-[var(--shadow-card)] grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
        <div className="flex items-center gap-4"><Avatar person={p} size="xl" ring /><div><div className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/55">Network member{p.memberSince ? ` since ${p.memberSince.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : ""}</div><h1 className="text-[28px] font-semibold tracking-[-0.03em] mt-1">{fullName(p)}</h1><p className="text-white/70 text-[13.5px] mt-1">{p.headline ?? "Add a headline in your screening"}</p><div className="flex flex-wrap gap-2 mt-2.5"><ScreeningBadge status={p.screeningStatus} /><AvailabilityBadge status={p.availabilityStatus} confirmedAt={p.availabilityConfirmedAt} nextCheckDate={p.nextCheckDate} />{p.referralConsent === "yes" ? <Badge tone="teal" filled>on the radar</Badge> : p.referralConsent === "no" ? <Badge filled>not being referred</Badge> : <Badge tone="amber" filled>asked each time</Badge>}</div></div></div>
        <div className="flex flex-wrap gap-2.5">{[["Trust", t.score, TRUST_BAND_LABEL[t.band]], ["Vouched by", t.vouchedBy, "people"], ["Referrals", p.referralsMade.length, `${accepted} accepted`], ["Open to you", open.length, "opportunities"]].map(([l, v, h]) => <div key={String(l)} className="min-w-[120px] rounded-[16px] bg-white/[0.07] border border-white/[0.12] px-4 py-3"><div className="text-[12px] text-white/60">{l}</div><div className="text-[24px] font-semibold tabular leading-8">{v}</div><div className="text-[11px] text-white/45">{h}</div></div>)}</div>
      </div>

      <Tabs items={[{ key: "home", label: "Home" }, { key: "opportunities", label: "Opportunities", count: open.length }, { key: "refer", label: "Refer someone" }]} current={tab} base={internal ? `/member?person=${p.id}` : "/member"} />

      {tab === "opportunities" ? (
        <><div className="mb-3"><h2 className="text-[15px] font-semibold">Opportunities open to members</h2><p className="text-[12.5px] text-ink-muted">Anonymised. Pitch with your own profile, or refer someone you would put your name behind. You are only ever named to a client with your consent.</p></div>{open.length ? <div className="space-y-3">{open.map((b) => <OppCard key={b.id} b={b} />)}</div> : <EmptyState title="Nothing open right now" description="When a requirement is opened to members, it appears here." />}</>
      ) : tab === "refer" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2"><Card><CardHeader title="Refer someone" description="This is what makes the network compound." /><CardBody>
            <form action={submitReferral} className="space-y-4">
              {internal ? <input type="hidden" name="asPersonId" value={p.id} /> : null}
              <p className="text-[12.5px] text-ink-muted">Only people you would genuinely stand behind. Your referral is anonymous to clients; we tell the person you sent them only if you say we can.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="Full name" required><Input name="name" required /></Field><Field label="Email or LinkedIn"><Input name="email" placeholder="so we can reach them" /></Field></div>
              <Field label="How you know them and what you have seen them do" required><Textarea name="context" required className="min-h-[90px]" placeholder="e.g. Ran the requirements workstream for me on the payments hub. Precise, calm, well liked by the business." /></Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="For an open opportunity?"><Select name="briefId" defaultValue={""}><option value="">— general referral —</option>{open.map((b) => <option key={b.id} value={b.id}>{b.roles[0] ?? "Requirement"} · {b.locations[0] ?? ""}</option>)}</Select></Field><Field label="Anything else"><Input name="note" /></Field></div>
              <Checkbox name="tell" label="You may tell them I referred them" defaultChecked />
              <div className="flex justify-end"><SubmitButton pendingText="Sending…">Send referral</SubmitButton></div>
            </form>
          </CardBody></Card></div>
          <Card><CardHeader title="Your referrals" description={`${accepted} accepted into the network`} /><CardBody>{p.referralsMade.length ? <ul className="divide-y divide-line text-[12.5px]">{p.referralsMade.map((r) => <li key={r.id} className="py-2 first:pt-0 last:pb-0"><div className="flex justify-between gap-2"><b>{r.name}</b><Badge tone={r.status === "ACCEPTED" ? "teal" : r.status === "DECLINED" ? "neutral" : "amber"} filled>{REF_STATUS[r.status]}</Badge></div><div className="text-ink-muted">{r.context}</div></li>)}</ul> : <div className="text-xs text-ink-muted">None yet.</div>}</CardBody></Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <Card><CardHeader title="Your screening" description="A real conversation, structured. Nothing goes live until a person has reviewed it." /><CardBody>
              {screened ? <div className="flex items-center justify-between gap-3"><div><ScreeningBadge status="APPROVED" /><div className="text-[11.5px] text-ink-faint mt-1">Completed <DateText date={p.screenedAt ?? p.memberSince} relative />. Your profile is live in the network.</div></div><form action={startScreening}><input type="hidden" name="personId" value={p.id} /><input type="hidden" name="restart" value="1" /><SubmitButton size="sm" variant="ghost" pendingText="…">Redo screening</SubmitButton></form></div>
                : submitted ? <div><ScreeningBadge status="SUBMITTED" /><div className="text-[11.5px] text-ink-faint mt-1">A person is reviewing your answers. You will be on the radar for opportunities as soon as it is confirmed.</div></div>
                : <div className="space-y-3"><div><b className="text-[15px]">Do your {SCREENING_MINUTES}-minute screening</b><p className="text-[13px] text-ink-muted mt-1 max-w-[60ch]">{SCREENING_SCRIPT.length} short sections: {SCREENING_SCRIPT.map((s) => s.title.toLowerCase()).join(", ")}. It is the one thing every member does, and it is what puts you on the radar for opportunities.</p></div><div className="flex flex-wrap gap-2"><form action={startScreening}><input type="hidden" name="personId" value={p.id} /><SubmitButton pendingText="Starting…">Start the AI screening</SubmitButton></form><BookScreeningDrawer personId={p.id} label="Book a real call instead" /></div></div>}
            </CardBody></Card>
            <div className="flex items-end justify-between"><div><h2 className="text-[15px] font-semibold">Open to members</h2><p className="text-[12.5px] text-ink-muted">Requirements you can pitch for or refer into. Client names stay hidden.</p></div><Link href={`/member?tab=opportunities${internal ? `&person=${p.id}` : ""}`} className="text-[12.5px] text-ink-muted hover:text-ink">All →</Link></div>
            {open.length ? <div className="space-y-3">{open.slice(0, 2).map((b) => <OppCard key={b.id} b={b} />)}</div> : <EmptyState title="Nothing open right now" />}
            <FitCard rows={fit} self />
          </div>
          <div className="space-y-4">
            <TrustCard t={t} firstName={p.firstName} self screened={screened} workedWith={p.relationships.some((r) => r.workedTogether)} />
            <Card><CardHeader title="How the network sees you" description="This is the anonymised card a client or agency sees. Your name only after you consent." /><CardBody>
              <div className="flex items-center gap-2 min-w-0"><code className="text-[11px] bg-surface-muted rounded px-1.5 py-0.5">{anon.ref}</code><b className="text-[13px] truncate">{anon.headlineSummary || p.headline || "Profile"}</b></div>
              <div className="flex flex-wrap gap-1 mt-1.5"><Chip>{anon.region ?? "region undisclosed"}</Chip><Chip>availability: {anon.availabilityBand}</Chip><Chip>vouched by {t.vouchedBy}</Chip>{highlights.map((h) => <Chip key={h}>{h}</Chip>)}{band ? <Chip>{band}</Chip> : null}</div>
              <div className="text-[12px] text-ink-muted mt-1.5">{anon.evidenceSummary}</div>
            </CardBody></Card>
            <Card><CardHeader title="Your consent" description="You decide whether you are on the radar." /><CardBody>
              <form action={setConsent} className="space-y-2"><input type="hidden" name="personId" value={p.id} />{[["yes", "Refer me for opportunities"], ["ask", "Ask me each time"], ["no", "Not for now"]].map(([k, l]) => <label key={k} className={`flex items-center gap-2.5 px-3 py-2 rounded-[12px] border text-[12.5px] cursor-pointer ${(p.referralConsent ?? "ask") === k ? "border-navy-400 bg-navy-100/60" : "border-line"}`}><input type="radio" name="referralConsent" value={k} defaultChecked={(p.referralConsent ?? "ask") === k} className="accent-navy-400" /><span>{l}</span></label>)}<div className="flex justify-end"><SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton></div></form>
            </CardBody></Card>
            <Card><CardHeader title="Your referrals and pitches" action={<Link href={`/member?tab=refer${internal ? `&person=${p.id}` : ""}`} className="text-[12px] text-ink-muted hover:text-ink">Refer</Link>} /><CardBody>
              <ul className="divide-y divide-line text-[12.5px]">{p.referralsMade.slice(0, 4).map((r) => <li key={r.id} className="py-1.5 flex justify-between gap-2"><span><b>{r.name}</b><small className="block text-ink-faint">referral</small></span><Badge tone={r.status === "ACCEPTED" ? "teal" : "amber"} filled>{REF_STATUS[r.status]}</Badge></li>)}{p.pitches.map((x) => <li key={x.id} className="py-1.5 flex justify-between gap-2"><span><b>{x.brief.roles[0] ?? "Requirement"}</b><small className="block text-ink-faint">pitch</small></span><Badge tone={x.status === "SHORTLISTED" ? "teal" : "navy"} filled>{PITCH_STATUS[x.status]}</Badge></li>)}{!p.referralsMade.length && !p.pitches.length ? <li className="text-ink-muted py-1">None yet. Refer someone or pitch for an opportunity.</li> : null}</ul>
            </CardBody></Card>
            <div className="text-[11px] text-ink-faint">Attributes we track: {ATTRIBUTES.map((a) => a.label.toLowerCase()).join(", ")}. Never nationality or any protected characteristic.</div>
          </div>
        </div>
      )}
    </>
  );
}
