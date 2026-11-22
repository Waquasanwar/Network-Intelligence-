import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { isInternal, redactForPartner } from "@/lib/authz";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InviteComposer, MyLinkShare, CopyInviteLink } from "@/components/domain/invite-share";
import { revokeInvite } from "@/server/actions/invites";
import { mayInvite } from "@/server/invites";
import { Badge, Chip } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/page";
import { TrustCard, FitCard } from "@/components/domain/trust";
import { BookScreeningDrawer } from "@/components/domain/member-drawers";
import { startScreening, setConsent, submitReferral, confirmMyAvailability } from "@/server/actions/members";
import type { AvailabilityStatus } from "@prisma/client";
import { trustFor, fitFor } from "@/lib/trust-for";
import { standardFor } from "@/lib/standard-for";
import { ReferenceDrawer } from "@/components/domain/reference-request";
import { ProofLine } from "@/components/domain/standard";
import { updateMyConsents } from "@/server/actions/privacy";
import { DataRights, ConsentToggles } from "@/components/domain/data-rights";
import { privacyOf } from "@/lib/privacy";
import { resolveMemberPerson, loadFeatures } from "@/server/queries";
import { UsersRound, ArrowRight } from "lucide-react";
import { TRUST_INCLUDE } from "@/lib/trust-include";
import { TRUST_BAND_LABEL } from "@/lib/trust";
import { fitHighlights, ATTRIBUTES } from "@/lib/fit";
import { rateBand, fmt } from "@/lib/demand";
import { SCREENING_MINUTES, SCREENING_SCRIPT } from "@/lib/screening";
import { ShieldCheck, EyeOff, PenLine } from "lucide-react";
import { AVAILABILITY_LABELS } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import { Constellation } from "@/components/ui/constellation";
import { AgentPulse, type PulseLine } from "@/components/ui/agent-pulse";
import { Guide } from "@/components/ui/guide";
import { KNOWN_HOW } from "@/lib/known";
import { memberNetwork } from "@/server/member-network";
import { notesFor } from "@/server/agent";
import { answerFit } from "@/server/actions/agent-notes";
import { DateText } from "@/components/domain/date";
import { PostItem, ShareBox } from "@/components/domain/board";
import { UserPlus, MessageCircle, BadgeCheck } from "lucide-react";
import { AvailabilityView } from "@/components/domain/availability";
import { AvailabilityGuide } from "@/components/domain/availability-guide";
import { MemberNetwork } from "@/components/domain/member-network";
import { AgentMark } from "@/components/ui/agent-mark";

export const metadata = { title: "My network profile" };

const SELF_STATUSES: AvailabilityStatus[] = ["AVAILABLE_NOW", "OPEN_TO_CONVERSATIONS", "QUIETLY_EXPLORING", "RIGHT_OPPORTUNITY_ONLY", "FINISHING_ENGAGEMENT_SOON", "FRACTIONAL_AVAILABILITY", "HAPPY_WHERE_I_AM", "NOT_LOOKING_KEEP_IN_TOUCH", "TAKING_A_BREAK", "UNAVAILABLE_UNTIL"];

const REF_STATUS: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", SCREENING: "Screening booked", ACCEPTED: "In the network", DECLINED: "Not now" };

export default async function MemberPage({ searchParams }: { searchParams: Promise<{ tab?: string; person?: string; sent?: string; screened?: string; welcome?: string; name?: string; brief?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const internal = isInternal(user);
  const base = await resolveMemberPerson(user, sp.person ?? null);
  if (!base) return <EmptyState title="No member profile" description={internal ? "Nobody has joined as a member yet. Share the join link." : "Your login is not linked to a profile yet. Ask your contact at Amana Network."} />;
  const p = await prisma.person.findUnique({ where: { id: base.id }, include: { ...TRUST_INCLUDE, referralsMade: { include: { brief: { select: { title: true } } }, orderBy: { createdAt: "desc" } }, pitches: { include: { brief: { select: { id: true, roles: true } } } } } });
  if (!p) redirect("/forbidden");
  const [members, myInvites] = await Promise.all([
    internal ? prisma.person.findMany({ where: { tenantId: p.tenantId, memberSince: { not: null } }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }) : Promise.resolve([]),
    prisma.invite.findMany({ where: { inviterPersonId: p.id }, select: { id: true, name: true, status: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const openRefs = (await prisma.referenceRequest.findMany({ where: { personId: p.id, status: "SENT", expiresAt: { gt: new Date() } }, select: { id: true, refereeName: true, openedAt: true, createdAt: true }, orderBy: { createdAt: "desc" } })).map((r) => ({ id: r.id, refereeName: r.refereeName, opened: !!r.openedAt, sentLabel: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(r.createdAt) }));
  // Who they can meet, who they are connected with, where they stand, and what is switched on.
  const [peers, myConnections, myShortlist, features] = await Promise.all([
    prisma.person.findMany({ where: { tenantId: p.tenantId, id: { not: p.id }, memberUser: { isNot: null } }, select: { memberSince: true, screeningStatus: true, screenedAt: true, privacy: true } }),
    prisma.connection.count({ where: { status: "ACCEPTED", OR: [{ fromPersonId: p.id }, { toPersonId: p.id }] } }),
    // Where this member stands on each requirement: the stage only, never the client's name or notes.
    prisma.shortlistItem.findMany({ where: { personId: p.id }, select: { briefId: true, decision: true } }),
    loadFeatures(p.tenantId),
  ]);
  // The member's own screening record, as they gave it: shown on Privacy & data, like a call log.
  const myScreenings = (sp.tab ?? "home") === "privacy" ? await prisma.conversation.findMany({ where: { personId: p.id, type: "SCREENING" }, select: { id: true, createdAt: true, approvalStatus: true, screening: true }, orderBy: { createdAt: "desc" }, take: 5 }) : [];
  const earnings = features.earnings; // off until the owner switches it on in Settings → Features
  const connectable = peers.filter((x) => mayInvite(x) && privacyOf({ privacy: x.privacy }).consents.memberDirectory).length;
  const credits = await prisma.referralCredit.findMany({ where: { personId: p.id }, include: { brief: { select: { title: true } } }, orderBy: { createdAt: "desc" } });
  const canInvite = mayInvite(p);
  const now = new Date();
  const tab = sp.tab ?? "home";
  // Who this member knows here, and what the agent has told them.
  const net = ["home", "profile"].includes(tab) ? await memberNetwork(p.id, p.tenantId) : null;
  const notes = await notesFor({ personId: p.id }, 8);
  const asks = notes.filter((n) => n.question && !n.answer);
  const qp = internal ? `&person=${p.id}` : "";
  const t = trustFor(p, isInternal(user) ? "internal" : "self"); const fit = fitFor(p);
  const screened = p.screeningStatus === "APPROVED" || !!p.screenedAt; const submitted = p.screeningStatus === "SUBMITTED";
  const anon = redactForPartner({ ...p, evidence: p.evidence, relationships: p.relationships });
  const highlights = fitHighlights(fit); const band = rateBand(p.rateExpectation ?? p.salaryExpectation);
  const privacy = privacyOf(p);
  const accepted = p.referralsMade.filter((r) => r.status === "ACCEPTED").length;
  // The members' board, read here like any feed: what people are sharing, and the replies.
  const boardOn = features.communityBoard && canInvite && tab === "home";
  const feed = boardOn ? await prisma.boardPost.findMany({ where: { tenantId: p.tenantId, status: "OPEN" }, include: { author: { select: { id: true, firstName: true, lastName: true, headline: true } }, replies: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" }, take: 30 } }, orderBy: { createdAt: "desc" }, take: 15 }) : [];
  const feedPitched = new Set((feed.length ? await prisma.pitch.findMany({ where: { personId: p.id, briefId: { in: feed.map((x) => x.briefId).filter((x): x is string => !!x) } }, select: { briefId: true } }) : []).map((x) => x.briefId));
  const feedLinks = feed.length ? await prisma.connection.findMany({ where: { OR: [{ fromPersonId: p.id }, { toPersonId: p.id }] }, select: { id: true, fromPersonId: true, toPersonId: true, status: true } }) : [];
  const linkTo = (id: string) => feedLinks.find((c) => c.fromPersonId === id || c.toPersonId === id) ?? null;

  // What the member is told about where they stand, in one plain line.
  const status = screened ? (p.referralConsent === "no" ? "Not being put forward for now" : p.referralConsent === "yes" ? "On the radar. We come to you when work fits" : "On the radar. We ask you before putting you forward")
    : submitted ? "Screening sent. We will confirm it shortly" : "Not on the radar yet";
  // What the agent is doing for this member right now, each line a fact.
  const withClients = myShortlist.filter((x) => ["PROPOSED", "CLIENT_INTERESTED", "INTRODUCED"].includes(x.decision)).length;
  const q = internal ? `&person=${p.id}` : "";
  const pulse = ([
    !screened && !submitted ? { text: `Ready when you are: your ${SCREENING_MINUTES}-minute screening` } : null,
    submitted && !screened ? { text: "Reading your screening. We will confirm it shortly" } : null,
    asks.length ? { text: `${asks.length === 1 ? "A role has come in that fits you" : `${asks.length} roles have come in that fit you`}. Shall I put you forward?`, href: "#from-amana" } : null,
    notes.find((n) => !n.question) ? { text: notes.find((n) => !n.question)!.title, href: "#from-amana" } : null,
    screened && !asks.length ? { text: "Watching for work that fits what you do. I will ask you first" } : null,
    withClients ? { text: `Your anonymous card is with ${withClients} ${withClients === 1 ? "client" : "clients"}. Your name stays hidden` } : null,
    openRefs[0] ? { text: `Waiting on a reference from ${openRefs[0].refereeName}${openRefs[0].opened ? ". They have opened the link" : ""}` } : null,
    features.memberConnections && canInvite && connectable ? { text: `${connectable} ${connectable === 1 ? "member" : "members"} you can connect with`, href: "/community?tab=members" } : null,
    earnings && credits.length ? { text: `Tracking ${credits.length} ${credits.length === 1 ? "placement share" : "placement shares"} for you`, href: `/member?tab=refer${q}` } : null,
  ] as (PulseLine | null)[]).filter((x): x is PulseLine => !!x);

  // The three things a member can do for themselves. Everything else is earned with the network.
  const mine = standardFor(p, "self");
  const has = (k: string) => mine.proofs.find((x) => x.key === k)?.held ?? false;
  const checklist = [
    { key: "screening", done: screened, waiting: submitted && !screened, title: `Your ${SCREENING_MINUTES}-minute screening`,
      detail: screened ? "Done." : submitted ? "Sent. We will confirm it shortly." : "A short, structured conversation about what you do and how you work. In your own time, by voice or in writing.",
      action: screened || submitted ? null : <div className="flex flex-wrap gap-2"><form action={startScreening}><input type="hidden" name="personId" value={p.id} /><SubmitButton pendingText="Starting…">Start my screening</SubmitButton></form><BookScreeningDrawer personId={p.id} label="Book a call instead" /></div> },
    { key: "reference", done: has("vouched"), waiting: !has("vouched") && openRefs.length > 0, title: "A reference from someone who has seen your work",
      detail: has("vouched") ? "Done. Thank you." : openRefs.length ? `Sent to ${openRefs.map((r) => r.refereeName.split(/\s+/)[0]).join(" and ")}. It counts as soon as they answer.` : "They answer from a link in about a minute. No account needed.",
      action: has("vouched") ? null : <ReferenceDrawer personId={internal ? p.id : undefined} about={p.firstName} open={openRefs} variant={screened || submitted ? "primary" : "secondary"} /> },
    { key: "availability", done: has("current"), waiting: false, title: "When you are free",
      detail: has("current") ? `${AVAILABILITY_LABELS[p.availabilityStatus]}. You can change it any time.` : "One tap. You can change it any time.",
      action: <form action={confirmMyAvailability} className="flex flex-wrap items-center gap-2"><input type="hidden" name="personId" value={p.id} /><Select name="status" aria-label="When you are free" defaultValue={SELF_STATUSES.includes(p.availabilityStatus) ? p.availabilityStatus : "OPEN_TO_CONVERSATIONS"} className="h-9 w-[230px] text-[13px]">{SELF_STATUSES.map((k) => <option key={k} value={k}>{AVAILABILITY_LABELS[k]}</option>)}</Select><SubmitButton size="sm" variant="secondary" pendingText="Saving…">{has("current") ? "Update" : "Confirm"}</SubmitButton></form> },
  ];
  const todo = checklist.filter((c) => !c.done && !(screened && c.key === "availability")).length;
  const checklistCard = (
    <Card data-checklist>
      <CardHeader title={screened ? `${todo} ${todo === 1 ? "thing" : "things"} left` : "Three things, then you are on the radar"} description={screened ? undefined : "That is all we need from you. When work comes up that fits, I come to you first, and your name is never shared without your yes."} />
      <CardBody className="pt-0">
        <ol className="divide-y divide-line">
          {checklist.filter((c) => !screened || (!c.done && c.key !== "availability")).map((c, n) => (
            <li key={c.key} className="flex flex-col gap-3 py-4 first:pt-1" data-step={c.key} data-done={c.done || undefined}>
              <div className="flex gap-3 min-w-0">
                <span className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] font-semibold ${c.done ? "bg-teal text-white dark:text-canvas" : c.waiting ? "bg-amber-100 text-ink" : "border border-line-strong text-ink-muted"}`} aria-hidden="true">{c.done ? "✓" : n + 1}</span>
                <div className="min-w-0"><b className={`block text-[14.5px] font-semibold ${c.done ? "text-ink-muted" : "text-ink"}`}>{c.title}<span className="sr-only">{c.done ? " (done)" : ""}</span></b><span className="block text-[13px] text-ink-muted leading-[1.5]">{c.detail}</span></div>
              </div>
              {c.action && !(c.done && c.key !== "availability") ? <div className="pl-9">{c.action}</div> : null}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );


  return (
    <>
      {internal ? <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-3 text-[12px] text-ink-faint"><span>Internal preview of the member portal. Viewing as</span> <form method="get" action="/member" className="inline-flex items-center gap-1.5"><Select name="person" defaultValue={p.id} className="h-7 text-xs w-[200px] max-w-[60vw]">{members.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}</Select><SubmitButton size="sm" variant="secondary" pendingText="…">Switch</SubmitButton></form></div> : null}
      {sp.screened ? <div className="mb-4 rounded-[12px] border border-teal/30 bg-teal-50 px-4 py-3 text-[13px]">Thank you. Your screening is with us.</div> : null}
      {sp.sent ? <div className="mb-4 rounded-[12px] border border-teal/30 bg-teal-50 px-4 py-3 text-[13px]">Thank you. Your referral is with us to review.</div> : null}

      {/* Who you are and what the agent is doing for you, on the brand stage. */}
      <section className="stage-ink mb-6 rounded-[24px] px-5 py-7 sm:px-9 sm:py-8" data-member-hero>
        <Constellation focus={0.8} density={0.7} />
        <span className="stage-scrim" aria-hidden="true" />
        <div className="grid grid-cols-1 items-end gap-7 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar person={p} size="xl" ring />
              <div className="min-w-0">
                <h1 className="hero-title text-[28px] sm:text-[38px]">{sp.welcome && !screened ? `Welcome, ${p.preferredName ?? p.firstName}` : fullName(p)}</h1>
                {p.headline ? <p className="stage-muted text-[15px] mt-1.5">{p.headline}</p> : null}
                <p className="mt-2 inline-flex items-center gap-2 text-[13px] stage-muted" data-member-status><span className={`h-2 w-2 rounded-full ${screened && p.referralConsent !== "no" ? "bg-[var(--color-teal-400)]" : submitted ? "bg-amber" : "bg-white/40"}`} aria-hidden="true" />{status}</p>
              </div>
            </div>
            {screened ? (
              <div className="mt-4 space-y-3" data-step="availability">
                <AvailabilityView p={p} onInk />
                <div className="flex flex-wrap items-center gap-2">
                  <form action={confirmMyAvailability}><input type="hidden" name="personId" value={p.id} /><input type="hidden" name="status" value={SELF_STATUSES.includes(p.availabilityStatus) ? p.availabilityStatus : "OPEN_TO_CONVERSATIONS"} /><SubmitButton size="sm" variant="secondary" pendingText="…">Still right</SubmitButton></form>
                  <details className="avail-edit"><summary className="chip !h-8 cursor-pointer list-none [&::-webkit-details-marker]:hidden">Change</summary><AvailabilityGuide personId={p.id} className="mt-3 max-w-[560px]" /></details>
                </div>
              </div>
            ) : null}
            <form method="get" action="/member" className="composer mt-6 flex max-w-[580px] items-center gap-2 p-1.5 pl-4" data-who-do-you-know>
              <input type="hidden" name="tab" value="refer" />
              {internal ? <input type="hidden" name="person" value={p.id} /> : null}
              <UserPlus className="h-4 w-4 flex-none text-ink-faint" aria-hidden="true" />
              <input name="name" maxLength={120} placeholder="Who do you know who is good? Their name…" aria-label="Who do you know who is good? Their name" className="h-10 min-w-0 flex-1 text-[15px] text-ink" autoComplete="off" />
              <button type="submit" className="send-btn" aria-label="Recommend them"><ArrowRight className="h-4 w-4" /></button>
            </form>
            <AgentPulse lines={pulse} onInk className="mt-3 max-w-[580px]" />
          </div>
          {net && (net.broughtIn.length || net.connected.length || net.broughtMeIn) ? (
            <div className="hidden lg:block text-right">
              <div className="flex justify-end -space-x-1.5">{[...(net.broughtMeIn ? [net.broughtMeIn] : []), ...net.broughtIn, ...net.connected].slice(0, 6).map((x) => <Avatar key={x.id} person={x} className="ring-2 ring-[#0c1d42]" />)}</div>
              <p className="mt-2 text-[13px] stage-muted">You know {[net.broughtMeIn, ...net.broughtIn, ...net.connected].filter(Boolean).length} {([net.broughtMeIn, ...net.broughtIn, ...net.connected].filter(Boolean).length === 1) ? "person" : "people"} here</p>
            </div>
          ) : null}
        </div>
      </section>

      {tab === "profile" ? (
        <div className="space-y-5" data-member-profile>
          {screened ? <dl className="flex flex-wrap gap-x-10 gap-y-4">{[["Trust", t.score, TRUST_BAND_LABEL[t.band]], ["Vouched by", t.vouchedBy, "people"], ["Referrals", p.referralsMade.length, `${accepted} accepted`], ["Connections", myConnections, "members"]].map(([l, v, h]) => <div key={String(l)}><dt className="text-[12.5px] text-ink-muted">{l}</dt><dd className="figure-num mt-1 text-[30px] leading-none">{v}</dd><dd className="mt-1 text-[12px] text-ink-faint">{h}</dd></div>)}</dl> : null}
          {screened ? (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <TrustCard t={t} standard={standardFor(p, internal ? "internal" : "self")} firstName={p.firstName} self action={<ReferenceDrawer personId={internal ? p.id : undefined} about={p.firstName} open={openRefs} />} />
            <div className="space-y-4">
              <Card><CardHeader title="How the network sees you" description="This is the anonymised card a client or agency sees. Your name only after you consent." /><CardBody>
                <div className="flex items-center gap-2 min-w-0"><code className="text-[12px] bg-surface-muted rounded px-1.5 py-0.5">{anon.ref}</code><b className="text-[13px] truncate">{anon.headlineSummary || p.headline || "Profile"}</b></div>
                <div className="flex flex-wrap gap-1 mt-1.5"><Chip>{anon.region ?? "region undisclosed"}</Chip><Chip>availability: {anon.availabilityBand}</Chip>{highlights.map((h) => <Chip key={h}>{h}</Chip>)}{band ? <Chip>{band}</Chip> : null}</div>
                <ProofLine proofs={anon.proofs} className="mt-2" />
                {anon.proofs.length ? null : <div className="text-[12px] text-ink-muted mt-1.5">Nothing on record yet. Your screening and a reference are the quickest two.</div>}
              </CardBody></Card>
              {fit.some((r) => r.combined !== null) ? <FitCard rows={fit} self /> : null}
            </div>
          </div>
          ) : <EmptyState title="Your profile fills in after your screening" description="Start it from Home. It takes about fifteen minutes, by voice or in writing." />}
        </div>
      ) : tab === "refer" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <Card>
              <CardHeader title="Invite someone yourself" description="Send them your link and they can join straight away. They are shown as invited by you." />
              <CardBody>
                {canInvite ? (
                  <div className="space-y-6">
                    <div><div className="label-caps text-ink-faint mb-2.5">Your link, for anyone you trust</div><MyLinkShare asPersonId={internal ? p.id : undefined} network={user.tenantName} from={p.preferredName ?? p.firstName} /></div>
                    <div className="border-t border-line pt-5"><div className="label-caps text-ink-faint mb-3">Or invite one person by name</div><InviteComposer asPersonId={internal ? p.id : undefined} network={user.tenantName} from={p.preferredName ?? p.firstName} /></div>
                  </div>
                ) : (
                  <EmptyState title="Available once you are approved" description={submitted ? "Your screening is with us for review. As soon as it is approved you get your own invitation link here." : `Have your ${SCREENING_MINUTES}-minute screening first. Once a person has reviewed it, you can bring in people you would stand behind.`} />
                )}
              </CardBody>
            </Card>
            <Guide
              intro="Recommend someone good. Only people you would stand behind. I will find the right work for them."
              action={submitReferral}
              hidden={internal ? { asPersonId: p.id } : {}}
              submit="Send referral"
              review="Here is your referral"
              steps={[
                { name: "name", kind: "text", ask: "Who would you like to recommend?", short: "Who", placeholder: "Their full name", initial: sp.name?.slice(0, 120), min: 2, max: 120 },
                { name: "knownHow", kind: "choice", ask: "How do you know {name}?", short: "How you know them", options: (Object.keys(KNOWN_HOW) as (keyof typeof KNOWN_HOW)[]).map((k) => ({ value: k, label: KNOWN_HOW[k].label })) },
                { name: "context", kind: "long", ask: "What have you seen {name} do?", short: "What you have seen", hint: "A line or two is plenty. Specifics help us place them well.", placeholder: "Ran the requirements workstream on our payments hub. Precise, calm, well liked by the business.", min: 5, max: 1000 },
                { name: "email", kind: "text", ask: "How can we reach {name}?", short: "Contact", optional: true, placeholder: "Email or LinkedIn", max: 200 },
                { name: "tell", kind: "confirm", ask: "May we tell {name} you referred them?", short: "Tell them", optional: true, yes: "Yes, tell them" },
              ]}
            />
          </div>
          <div className="space-y-4">
          {earnings && credits.length ? <Card data-member-credits><CardHeader title="Your share of placements" description="When someone you referred, introduced or found work for is placed, you receive this share of the fee." /><CardBody className="pt-0"><ul className="divide-y divide-line text-[12.5px]">{credits.map((c) => <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0"><span className="min-w-0"><b className="font-semibold">{c.brief.title}</b><span className="block text-ink-muted">You {c.reason} · {Number(c.pct)}%</span></span><span className="flex-none text-right"><b className="block tabular">{c.amount !== null ? fmt(Number(c.amount), c.currency) : "To follow"}</b><span className="text-[12px] text-ink-faint">{c.status === "PAID" ? "Paid" : c.status === "OWED" ? "Owed to you" : "Written off"}</span></span></li>)}</ul></CardBody></Card> : null}
          <Card><CardHeader title="Your referrals" description={`${accepted} accepted into the network`} /><CardBody>{p.referralsMade.length ? <ul className="divide-y divide-line text-[12.5px]">{p.referralsMade.map((r) => <li key={r.id} className="py-2 first:pt-0 last:pb-0"><div className="flex justify-between gap-2"><b>{r.name}</b><Badge tone={r.status === "ACCEPTED" ? "teal" : r.status === "DECLINED" ? "neutral" : "amber"} filled>{REF_STATUS[r.status]}</Badge></div><div className="text-ink-muted">{r.context}</div></li>)}</ul> : <div className="text-xs text-ink-muted">None yet.</div>}</CardBody></Card>
          <Card><CardHeader title="Your invitations" description={`${myInvites.filter((i) => i.status === "JOINED").length} joined`} /><CardBody>{myInvites.length ? <ul className="divide-y divide-line">{myInvites.map((i) => { const open = (i.status === "SENT" || i.status === "OPENED") && i.expiresAt > now; return <li key={i.id} className="py-2.5 first:pt-0 last:pb-0"><div className="flex items-center justify-between gap-2"><b className="text-[13.5px]">{i.name}</b><Badge tone={i.status === "JOINED" ? "teal" : open ? (i.status === "OPENED" ? "navy" : "amber") : "neutral"} filled={i.status === "JOINED"}>{i.status === "JOINED" ? "Joined" : i.status === "REVOKED" ? "Cancelled" : !open ? "Expired" : i.status === "OPENED" ? "Opened" : "Sent"}</Badge></div>{open ? <div className="mt-2 flex items-center gap-2"><CopyInviteLink inviteId={i.id} /><form action={revokeInvite}><input type="hidden" name="inviteId" value={i.id} /><SubmitButton size="sm" variant="ghost" pendingText="…">Cancel</SubmitButton></form></div> : null}</li>; })}</ul> : <div className="text-[12.5px] text-ink-muted">Nobody invited yet.</div>}</CardBody></Card>
          </div>
        </div>
      ) : tab === "privacy" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <section aria-labelledby="data-promises" className="rounded-[16px] border border-line bg-surface p-5" data-promises>
              <h2 id="data-promises" className="section-title text-[22px]">Your data stays yours.</h2>
              <ul className="mt-3 divide-y divide-line">
                {[
                  [ShieldCheck, "Never sold, and never used to train AI models.", "We are not in the data business. Your profile is here to find you work."],
                  [EyeOff, "Used for two things only: your profile, and introductions you agree to.", "Clients see what you hold, never your name, until you say yes to that introduction."],
                  [PenLine, "Yours to change or remove at any time.", "Every permission below takes effect at once. Take a copy, or ask us to delete it, from this page."],
                ].map(([Icon, t, d]) => { const I = Icon as typeof ShieldCheck; return (
                  <li key={String(t)} className="flex gap-3.5 py-3 first:pt-1 last:pb-0"><span className="tile is-mint !h-8 !w-8 !rounded-[9px]"><I className="h-4 w-4" aria-hidden="true" /></span><span><b className="block text-[14.5px] font-semibold text-ink">{String(t)}</b><span className="block text-[13px] text-ink-muted">{String(d)}</span></span></li>
                ); })}
              </ul>
            </section>
            <Card data-my-screening><CardHeader title="Your screening" description="What you told us, in your own words. Nothing reaches your profile until a person has read it." /><CardBody className="pt-0">
              {myScreenings.length ? <ul className="divide-y divide-line">{myScreenings.map((c) => {
                const answers = ((c.screening as { answers?: Record<string, unknown> } | null)?.answers ?? {});
                const shown = SCREENING_SCRIPT.flatMap((sec) => sec.questions).map((q) => { const v = answers[q.key]; const text = Array.isArray(v) ? v.map((x) => (typeof x === "object" && x ? (x as { name?: string }).name : String(x))).filter(Boolean).join(", ") : v == null ? "" : String(v); return { q: q.prompt, a: text }; }).filter((x) => x.a);
                const status = c.approvalStatus === "APPROVED" ? "Read and approved" : c.approvalStatus === "NEEDS_REVIEW" ? "With us to read" : c.approvalStatus === "REJECTED" ? "Not used" : "In progress";
                return (
                  <li key={c.id} className="py-3 first:pt-1">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                        <span className="text-[13.5px] text-ink"><b className="font-semibold">{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(c.createdAt)}</b> · {shown.length} answers</span>
                        <span className="flex items-center gap-2"><Badge tone={c.approvalStatus === "APPROVED" ? "teal" : c.approvalStatus === "NEEDS_REVIEW" ? "amber" : "neutral"} filled>{status}</Badge><span className="text-[12.5px] font-medium text-ink-muted group-open:hidden">Show</span><span className="hidden text-[12.5px] font-medium text-ink-muted group-open:inline">Hide</span></span>
                      </summary>
                      <dl className="mt-3 space-y-3 border-l-2 border-teal/30 pl-4">{shown.map((x) => <div key={x.q}><dt className="text-[12.5px] font-semibold text-ink-faint">{x.q}</dt><dd className="mt-0.5 whitespace-pre-line text-[13.5px] text-ink">{x.a}</dd></div>)}</dl>
                    </details>
                  </li>
                );
              })}</ul> : <div className="text-[13px] text-ink-muted">No screening yet. When you have one, what you said appears here, in your own words.</div>}
            </CardBody></Card>
            <Card><CardHeader title="What we may do with your profile" description="Each permission is yours to switch on or off — immediately." /><CardBody>
              <ConsentToggles privacy={privacy} update={updateMyConsents} asPersonId={internal ? p.id : undefined} />
            </CardBody></Card>
          </div>
          <div className="space-y-4">
            <Card><CardHeader title="Your consent" description="You decide whether you are on the radar." /><CardBody>
              <form action={setConsent} className="space-y-2"><input type="hidden" name="personId" value={p.id} />{[["yes", "Refer me for opportunities"], ["ask", "Ask me each time"], ["no", "Not for now"]].map(([k, l]) => <label key={k} className={`flex items-center gap-2.5 px-3 py-2 rounded-[12px] border text-[12.5px] cursor-pointer ${(p.referralConsent ?? "ask") === k ? "border-navy-400 bg-navy-100/60" : "border-line"}`}><input type="radio" name="referralConsent" value={k} defaultChecked={(p.referralConsent ?? "ask") === k} className="accent-navy-400" /><span>{l}</span></label>)}<div className="flex justify-end"><SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton></div></form>
            </CardBody></Card>
            <Card><CardHeader title="Your data & privacy" description="Take a copy, or ask to be removed. Your right under UK GDPR and the UAE PDPL." /><CardBody>
              <DataRights privacy={privacy} firstName={p.firstName} asPersonId={internal ? p.id : undefined} />
            </CardBody></Card>
            <div className="text-[12px] text-ink-faint">Attributes we track: {ATTRIBUTES.map((a) => a.label.toLowerCase()).join(", ")}. Never nationality or any protected characteristic.</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {!screened ? checklistCard : null}
            {notes.length ? (
              <section id="from-amana" aria-labelledby="from-amana-h" data-from-amana>
                <h2 id="from-amana-h" className="section-title text-[18px]">From Amana</h2>
                <ul className="mt-3 space-y-2.5">
                  {notes.map((n) => (
                    <li key={n.id} className={`note-card ${n.question && !n.answer ? "is-ask" : ""}`} data-note={n.kind}>
                      <span className="guide-orb flex-none" aria-hidden="true"><AgentMark size={14} busy={n.question && !n.answer} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold leading-snug text-ink">{n.title}</p>
                        {n.body ? <p className="mt-1 text-[13px] leading-[1.5] text-ink-muted">{n.body}</p> : null}
                        {n.question && !n.answer ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <form action={answerFit}><input type="hidden" name="noteId" value={n.id} /><input type="hidden" name="answer" value="yes" />{internal ? <input type="hidden" name="asPersonId" value={p.id} /> : null}<SubmitButton size="sm" pendingText="…">Yes, put me forward</SubmitButton></form>
                            <form action={answerFit}><input type="hidden" name="noteId" value={n.id} /><input type="hidden" name="answer" value="no" />{internal ? <input type="hidden" name="asPersonId" value={p.id} /> : null}<SubmitButton size="sm" variant="ghost" pendingText="…">Not now</SubmitButton></form>
                          </div>
                        ) : n.answer ? <p className="mt-1.5 text-[12.5px] font-semibold text-teal">{n.answer === "yes" ? "You said yes. I have told the team." : "You said not now."}</p> : null}
                        <p className="mt-1.5 text-[11.5px] text-ink-faint"><DateText date={n.when} relative /></p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {boardOn ? (
              <>
                <ShareBox me={p} earnings={earnings} />
                <section aria-labelledby="feed-h" data-feed>
                  <h2 id="feed-h" className="section-title text-[18px]">What members are sharing</h2>
                  {feed.length ? (
                    <ul className="feed mt-3 divide-y divide-line">
                      {feed.map((x) => <li key={x.id}><PostItem p={x} me={p} pitched={!!x.briefId && feedPitched.has(x.briefId)} link={linkTo(x.authorPersonId)} canConnect={features.memberConnections && privacy.consents.memberDirectory} /></li>)}
                    </ul>
                  ) : <p className="mt-3 text-[14px] text-ink-muted">Quiet so far. Share something above and start the conversation.</p>}
                </section>
              </>
            ) : null}
          </div>
          <aside className="space-y-5">
            {screened && todo ? checklistCard : null}
            {net ? <MemberNetwork compact broughtMeIn={net.broughtMeIn} broughtIn={net.broughtIn} connected={net.connected} inviteHref={`/member?tab=refer${qp}`} /> : null}
            {features.memberConnections && canInvite ? (
              <div className="side-links">
                <Link href="/community?tab=connections" className="side-link"><MessageCircle className="h-4 w-4" aria-hidden="true" /><span className="flex-1">Messages</span><ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
                <Link href="/community?tab=members" className="side-link"><UsersRound className="h-4 w-4" aria-hidden="true" /><span className="flex-1">{connectable ? `${connectable} ${connectable === 1 ? "member" : "members"} to meet` : "Find members"}</span><ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
                <Link href={`/member?tab=profile${qp}`} className="side-link"><BadgeCheck className="h-4 w-4" aria-hidden="true" /><span className="flex-1">Your profile and trust</span><ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </>
  );
}
