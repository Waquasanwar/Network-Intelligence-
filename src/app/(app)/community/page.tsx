import Link from "next/link";
import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { isInternal } from "@/lib/authz";
import { privacyOf } from "@/lib/privacy";
import { mayInvite } from "@/server/invites";
import { resolveMemberPerson, loadFeatures } from "@/server/queries";
import { standardFor } from "@/lib/standard-for";
import { TRUST_SELECT } from "@/lib/trust-include";
import { ROUTE_LABELS } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProofPips } from "@/components/domain/standard";
import { DateText } from "@/components/domain/date";
import { Guide } from "@/components/ui/guide";
import { createPost, closePost, interestedInPost, referToPost, connect, answerConnection, setDirectory } from "@/server/actions/community";
import type { BoardPostKind, EngagementRoute } from "@prisma/client";

export const metadata = { title: "Community" };

const KIND: Record<BoardPostKind, { label: string; tone: string }> = {
  WORK: { label: "Work I know about", tone: "bg-teal-50 text-ink" },
  HELP: { label: "Looking for someone", tone: "bg-amber-100 text-ink" },
  AVAILABLE: { label: "Available", tone: "bg-navy-100 text-ink" },
};
const NOTICE: Record<string, string> = {
  off: "That part of the community is not open yet.",
  posted: "Posted. Work you shared also reached the network team, who match it against everyone.",
  interested: "Done. The team has your interest and will come back to you.",
  referred: "Thank you. If they are placed, you receive a share of the fee.",
  asked: "Request sent. Your contact details are shared only if they accept.",
  "post-terms": "Please tick the box: work shared here is introduced through the network.",
  "post-details": "Give your post a short title and a few lines of detail.",
  "refer-details": "Add their name and how you know their work.",
  "too-many": "You have 10 open posts. Close one before adding another.",
  "slow-down": "That is a lot at once. Wait a minute and carry on.",
  "directory-off": "Switch on “Show me to other members” first, so they can see who is asking.",
  "not-available": "That member is not taking requests at the moment.",
  "post-gone": "That post is no longer open.",
};

/**
 * The members' community: a board for work, asks and availability; a directory of members who
 * chose to be seen; and connections. The team sees the board too, to read it and to take a post
 * down, and every piece of work shared here is already a lead in Requirements.
 */
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ tab?: string; notice?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const internal = isInternal(user);
  const base = internal ? null : await resolveMemberPerson(user, null);
  const me = base ? await prisma.person.findUnique({ where: { id: base.id }, select: { id: true, tenantId: true, memberSince: true, screeningStatus: true, screenedAt: true, privacy: true } }) : null;
  const tenantId = internal ? user.tenantId : me?.tenantId;
  // What the owner has switched on in Settings → Features: the board, member connections, and earnings.
  const features = tenantId ? await loadFeatures(tenantId) : null;
  const earnings = !!features?.earnings;
  const board = internal || features?.communityBoard !== false;
  const links = !internal && features?.memberConnections !== false;

  if (!board && !links) {
    return (
      <>
        <PageHeader title="Community" description="Share work, ask for someone, say when you are free, and connect with other members." />
        <EmptyState title="The community is not open yet" description="The network will open it soon. Until then, refer people and see work open to you from your profile." action={<Link href="/member" className="inline-flex h-10 items-center rounded-full bg-navy px-5 text-[13.5px] font-semibold text-white dark:text-canvas">Back to my profile</Link>} />
      </>
    );
  }

  if (!internal && (!me || !mayInvite(me))) {
    return (
      <>
        <PageHeader title="Community" description="Share work, ask for someone, say when you are free, and connect with other members." />
        <EmptyState title="Opens once your screening is accepted" description="The community is for members the network knows. Finish your screening and you can take part straight away." action={<Link href="/member" className="inline-flex h-10 items-center rounded-full bg-navy px-5 text-[13.5px] font-semibold text-white dark:text-canvas">Back to my profile</Link>} />
      </>
    );
  }

  const listed = me ? privacyOf({ privacy: me.privacy }).consents.memberDirectory : false;
  const wanted = internal ? "board" : sp.tab === "members" ? "members" : sp.tab === "connections" ? "connections" : "board";
  const tab = wanted === "board" && !board ? "members" : wanted !== "board" && !links ? "board" : wanted;
  const [posts, connections] = await Promise.all([
    !board ? Promise.resolve([]) : prisma.boardPost.findMany({ where: { tenantId, status: "OPEN" }, include: { author: { select: { id: true, firstName: true, lastName: true, headline: true } } }, orderBy: { createdAt: "desc" }, take: 60 }),
    me && links ? prisma.connection.findMany({ where: { OR: [{ fromPersonId: me.id }, { toPersonId: me.id }] }, include: { from: { select: { id: true, firstName: true, lastName: true, headline: true, email: true, phone: true, linkedinUrl: true } }, to: { select: { id: true, firstName: true, lastName: true, headline: true, email: true, phone: true, linkedinUrl: true } } }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  const mine = me ? await prisma.pitch.findMany({ where: { personId: me.id, briefId: { in: posts.map((p) => p.briefId).filter((x): x is string => !!x) } }, select: { briefId: true } }) : [];
  const pitched = new Set(mine.map((m) => m.briefId));
  const empty = !internal && posts.length === 0; // nothing to read yet: the guide leads on its own
  const incoming = connections.filter((c) => me && c.toPersonId === me.id && c.status === "PENDING");
  const accepted = connections.filter((c) => c.status === "ACCEPTED");
  const linkWith = (id: string) => connections.find((c) => c.fromPersonId === id || c.toPersonId === id);

  // Only members who have chosen to be seen, and only for members who have chosen the same.
  const members = me && listed && tab === "members"
    ? (await prisma.person.findMany({ where: { tenantId, id: { not: me.id }, memberUser: { isNot: null } }, select: { id: true, firstName: true, lastName: true, headline: true, memberSince: true, ...TRUST_SELECT }, orderBy: { memberSince: "asc" }, take: 200 }))
        .filter((p) => mayInvite(p) && privacyOf({ privacy: p.privacy }).consents.memberDirectory)
    : [];

  return (
    <>
      <PageHeader title="Community" description={internal ? "What members are sharing. Work and asks posted here are already leads in Requirements. You can take a post down." : !board ? "Find other members who chose to be seen, and connect. Free for members." : !links ? "Share work you know about, ask for someone, and say when you are free. Free for members." : "Share work you know about, ask for someone, say when you are free, and connect with other members. Free for members."} />
      {sp.notice && NOTICE[sp.notice] ? <div role="status" className="mb-4 rounded-[12px] border border-teal/30 bg-teal-50 px-4 py-3 text-[13px]">{sp.notice === "referred" && !earnings ? "Thank you. We will tell you how it goes." : NOTICE[sp.notice]}</div> : null}
      {internal || !board || !links ? null : <Tabs items={[{ key: "board", label: "Board", count: posts.length }, { key: "members", label: "Members" }, { key: "connections", label: "Connections", count: incoming.length || undefined }]} current={tab} base="/community" />}
      {!internal && !board ? <Tabs items={[{ key: "members", label: "Members" }, { key: "connections", label: "Connections", count: incoming.length || undefined }]} current={tab} base="/community" /> : null}

      {tab === "board" ? (
        <div className={empty ? "max-w-[760px]" : "grid grid-cols-1 xl:grid-cols-3 gap-4"}>
          {empty ? null : <div className="xl:col-span-2">
            <Card>
              <CardBody className="pt-2">
                {posts.length === 0 ? <div className="py-6"><EmptyState title="Nothing on the board yet" description={internal ? "When members share work, ask for someone or say they are free, it shows here." : "Be the first: share a piece of work you know about, or say when you are free."} /></div> : (
                  <ul className="divide-y divide-line">
                    {posts.map((p) => {
                      const own = me?.id === p.authorPersonId;
                      return (
                        <li key={p.id} className="py-4" data-post={p.kind}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${KIND[p.kind].tone}`}>{KIND[p.kind].label}</span>
                              <h3 className="mt-1.5 text-[15px] font-semibold leading-snug">{p.title}</h3>
                              <div className="mt-0.5 text-[12px] text-ink-faint">{own ? "You" : fullName(p.author)}{p.author.headline ? ` · ${p.author.headline}` : ""} · <DateText date={p.createdAt} relative /></div>
                            </div>
                            {own || internal ? <form action={closePost}><input type="hidden" name="postId" value={p.id} /><SubmitButton size="sm" variant="ghost" pendingText="…">{internal ? "Take down" : "Close"}</SubmitButton></form> : null}
                          </div>
                          <p className="mt-2 text-[13.5px] leading-[1.55] text-ink-muted whitespace-pre-line max-w-[75ch]">{p.body}</p>
                          {p.route || p.location ? <div className="mt-2 flex flex-wrap gap-1">{p.route ? <Chip>{ROUTE_LABELS[p.route]}</Chip> : null}{p.location ? <Chip>{p.location}</Chip> : null}</div> : null}
                          {internal && p.briefId ? <Link href={`/requirements/${p.briefId}`} className="mt-2 inline-block text-[12.5px] font-semibold text-ink underline underline-offset-2">Open the lead in Requirements</Link> : null}
                          {!own && !internal && p.kind !== "AVAILABLE" ? (
                            <div className="mt-3 flex flex-wrap items-start gap-2">
                              {p.briefId && pitched.has(p.briefId) ? <span className="inline-flex h-8 items-center text-[12.5px] font-semibold text-teal">You said you are interested</span> : <form action={interestedInPost}><input type="hidden" name="postId" value={p.id} /><SubmitButton size="sm" pendingText="…">I&apos;m interested</SubmitButton></form>}
                              <details className="min-w-0 flex-1"><summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden inline-flex h-8 items-center rounded-full border border-line bg-surface px-3 text-[12px] font-semibold">Refer someone</summary>
                                <form action={referToPost} className="mt-3 space-y-2.5 max-w-[520px]">
                                  <input type="hidden" name="postId" value={p.id} />
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"><Field label="Their name" required><Input name="name" required minLength={2} maxLength={120} /></Field><Field label="Email or LinkedIn"><Input name="email" maxLength={200} /></Field></div>
                                  <Field label="How you know their work" required><Input name="context" required minLength={5} maxLength={600} placeholder="Ran the data migration on our programme last year" /></Field>
                                  <SubmitButton size="sm" pendingText="Sending…">Send referral</SubmitButton>
                                </form>
                              </details>
                            </div>
                          ) : null}
                          {!own && !internal && p.kind === "AVAILABLE" && listed && links ? (() => { const c = linkWith(p.authorPersonId); return c ? <div className="mt-3 text-[12.5px] font-semibold text-ink-muted">{c.status === "ACCEPTED" ? "Connected" : c.status === "PENDING" ? "Request sent" : null}</div> : <form action={connect} className="mt-3"><input type="hidden" name="personId" value={p.authorPersonId} /><SubmitButton size="sm" variant="secondary" pendingText="…">Connect</SubmitButton></form>; })() : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>}
          {internal ? null : (
            <div>
              <Guide
                intro={empty ? "The board is empty, so you would be first. Your name is shown with what you share." : "Share something with members. Your name is shown with it."}
                action={createPost}
                submit="Post"
                pending="Posting…"
                review="Here is your post"
                steps={[
                  { name: "kind", kind: "choice", ask: "What would you like to share?", short: "What", options: [
                    { value: "WORK", label: "Work I know about", hint: "A role or project someone needs filled" },
                    { value: "HELP", label: "I am looking for someone", hint: "A specialist you need yourself" },
                    { value: "AVAILABLE", label: "I am free for work", hint: "Let members know you can take something on" },
                  ] },
                  { name: "title", kind: "text", ask: "Give it a one-line title", short: "Title", placeholder: "Interim CFO, energy group, Dubai", min: 4, max: 120 },
                  { name: "body", kind: "long", ask: "Tell members a little more", short: "Details", hint: "What it is, for how long, and anything fixed like budget or start date.", min: 10, max: 2000 },
                  { name: "route", kind: "choice", ask: "What kind of work is it?", short: "Type", optional: true, options: [{ value: "", label: "Any, or not sure" }, ...(Object.keys(ROUTE_LABELS) as EngagementRoute[]).map((r) => ({ value: r, label: ROUTE_LABELS[r] }))] },
                  { name: "location", kind: "text", ask: "Where is it?", short: "Where", optional: true, max: 120, placeholder: "City, or remote", picks: ["Dubai", "Abu Dhabi", "Riyadh", "London", "Remote"] },
                  { name: "terms", kind: "confirm", ask: "One thing before it goes up", short: "Through the network", when: { name: "kind", in: ["WORK", "HELP"] }, hint: earnings ? "Work shared here is introduced through the network, so nobody is cut out. If someone you bring in is placed, you receive a share of the fee." : "Work shared here is introduced through the network, so nobody is cut out.", yes: "That is fine" },
                ]}
              />
            </div>
          )}
        </div>
      ) : tab === "members" ? (
        !listed ? (
          <Card>
            <CardHeader title="Members who chose to be seen" description="To see other members and connect with them, switch on being seen yourself. They see your name, headline and the proofs you hold; your email and phone only go to people whose request you accept." />
            <CardBody className="pt-0"><form action={setDirectory}><input type="hidden" name="on" value="1" /><SubmitButton pendingText="…">Show me to other members</SubmitButton></form></CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title={`${members.length} ${members.length === 1 ? "member" : "members"} you can connect with`} description="Members who chose to be seen. Ask to connect, and contact details are shared once they accept." action={<form action={setDirectory}><input type="hidden" name="on" value="0" /><SubmitButton size="sm" variant="ghost" pendingText="…">Hide me</SubmitButton></form>} />
            <CardBody className="pt-0">
              {members.length === 0 ? <EmptyState title="Nobody else yet" description="As other members switch on being seen, they appear here." /> : (
                <ul className="divide-y divide-line">
                  {members.map((m) => {
                    const s = standardFor(m, "outside"); const c = linkWith(m.id);
                    return (
                      <li key={m.id} className="flex flex-wrap items-center gap-3 py-3.5" data-member>
                        <Avatar person={m} />
                        <div className="min-w-0 flex-1"><b className="block text-[14px] font-semibold">{fullName(m)}</b><span className="block truncate text-[12.5px] text-ink-muted">{m.headline ?? ""}</span><span className="mt-1 flex items-center gap-2 text-[12px] text-ink-faint"><ProofPips s={s} />{s.line}{m.capabilities.length ? ` · ${m.capabilities.slice(0, 3).join(", ")}` : ""}</span></div>
                        {c?.status === "ACCEPTED" ? <span className="text-[12.5px] font-semibold text-teal">Connected</span>
                          : c?.status === "PENDING" && c.fromPersonId === me!.id ? <span className="text-[12.5px] font-semibold text-ink-muted">Request sent</span>
                          : c?.status === "DECLINED" ? null
                          : <form action={connect}><input type="hidden" name="personId" value={m.id} /><SubmitButton size="sm" variant={c ? "primary" : "secondary"} pendingText="…">{c ? "Accept" : "Connect"}</SubmitButton></form>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        )
      ) : (
        <div className="space-y-4">
          {incoming.length ? (
            <Card>
              <CardHeader title={`${incoming.length} ${incoming.length === 1 ? "request" : "requests"} to connect`} description="Accepting shares your email and phone with them, and theirs with you." />
              <CardBody className="pt-0">
                <ul className="divide-y divide-line">
                  {incoming.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Avatar person={c.from} />
                      <div className="min-w-0 flex-1"><b className="block text-[14px] font-semibold">{fullName(c.from)}</b><span className="block text-[12.5px] text-ink-muted">{c.message ?? c.from.headline ?? ""}</span></div>
                      <form action={answerConnection}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="answer" value="accept" /><SubmitButton size="sm" pendingText="…">Accept</SubmitButton></form>
                      <form action={answerConnection}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="answer" value="decline" /><SubmitButton size="sm" variant="ghost" pendingText="…">Decline</SubmitButton></form>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Your connections" description="Members who accepted, or whose request you accepted." />
            <CardBody className="pt-0">
              {accepted.length === 0 ? <EmptyState title="No connections yet" description="Find people under Members, or connect with someone who says they are available on the board." /> : (
                <ul className="divide-y divide-line">
                  {accepted.map((c) => { const o = c.fromPersonId === me!.id ? c.to : c.from; return (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 py-3" data-connection>
                      <Avatar person={o} />
                      <div className="min-w-0 flex-1"><b className="block text-[14px] font-semibold">{fullName(o)}</b><span className="block text-[12.5px] text-ink-muted">{o.headline ?? ""}</span></div>
                      <div className="text-[12.5px] text-ink-muted flex flex-wrap gap-x-4">{o.email ? <a className="underline underline-offset-2" href={`mailto:${o.email}`}>{o.email}</a> : null}{o.phone ? <span>{o.phone}</span> : null}{o.linkedinUrl ? <a className="underline underline-offset-2" href={o.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow">LinkedIn</a> : null}</div>
                    </li>
                  ); })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
