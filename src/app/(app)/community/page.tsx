import Link from "next/link";
import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { isInternal } from "@/lib/authz";
import { privacyOf } from "@/lib/privacy";
import { mayInvite } from "@/server/invites";
import { resolveMemberPerson, loadFeatures } from "@/server/queries";
import { standardFor } from "@/lib/standard-for";
import { TRUST_SELECT } from "@/lib/trust-include";
import { fullName } from "@/lib/utils";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProofPips } from "@/components/domain/standard";
import { DateText } from "@/components/domain/date";
import { PostItem, ShareGuide } from "@/components/domain/board";
import { connect, answerConnection, setDirectory, sendMessage } from "@/server/actions/community";
import { ArrowUp, Lock, Mail, Phone, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Community" };

const NOTICE: Record<string, string> = {
  "reply-details": "Write a few words before sending.",
  "message-details": "Write something before sending.",
  "not-connected": "You can message members once you are connected.",
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
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ tab?: string; notice?: string; with?: string }> }) {
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
    !board ? Promise.resolve([]) : prisma.boardPost.findMany({ where: { tenantId, status: "OPEN" }, include: { author: { select: { id: true, firstName: true, lastName: true, headline: true } }, replies: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" }, take: 50 } }, orderBy: { createdAt: "desc" }, take: 60 }),
    me && links ? prisma.connection.findMany({ where: { OR: [{ fromPersonId: me.id }, { toPersonId: me.id }] }, include: { from: { select: { id: true, firstName: true, lastName: true, headline: true, email: true, phone: true, linkedinUrl: true } }, to: { select: { id: true, firstName: true, lastName: true, headline: true, email: true, phone: true, linkedinUrl: true } } }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  const mine = me ? await prisma.pitch.findMany({ where: { personId: me.id, briefId: { in: posts.map((p) => p.briefId).filter((x): x is string => !!x) } }, select: { briefId: true } }) : [];
  const pitched = new Set(mine.map((m) => m.briefId));
  const empty = !internal && posts.length === 0; // nothing to read yet: the guide leads on its own
  const incoming = connections.filter((c) => me && c.toPersonId === me.id && c.status === "PENDING");
  const accepted = connections.filter((c) => c.status === "ACCEPTED");
  const linkWith = (id: string) => connections.find((c) => c.fromPersonId === id || c.toPersonId === id);

  // Conversations with connections: who has written, what is unread, and the open thread.
  const ids = accepted.map((c) => c.id);
  const [unreadBy, lastBy] = me && ids.length ? await Promise.all([
    prisma.memberMessage.groupBy({ by: ["connectionId"], where: { connectionId: { in: ids }, fromPersonId: { not: me.id }, readAt: null }, _count: { _all: true } }),
    prisma.memberMessage.findMany({ where: { connectionId: { in: ids } }, orderBy: { createdAt: "desc" }, distinct: ["connectionId"], select: { connectionId: true, body: true, fromPersonId: true, createdAt: true } }),
  ]) : [[], []];
  const unread = new Map(unreadBy.map((u) => [u.connectionId, u._count._all]));
  const last = new Map(lastBy.map((m) => [m.connectionId, m]));
  const unreadTotal = [...unread.values()].reduce((a, n) => a + n, 0);
  const sorted = [...accepted].sort((a, b) => (last.get(b.id)?.createdAt.getTime() ?? b.createdAt.getTime()) - (last.get(a.id)?.createdAt.getTime() ?? a.createdAt.getTime()));
  const open = tab === "connections" ? sorted.find((c) => c.id === sp.with) ?? sorted[0] ?? null : null;
  const thread = open && me ? await prisma.memberMessage.findMany({ where: { connectionId: open.id }, orderBy: { createdAt: "asc" }, take: 200 }) : [];
  // Opening a conversation reads it.
  if (open && me && unread.get(open.id)) { await prisma.memberMessage.updateMany({ where: { connectionId: open.id, fromPersonId: { not: me.id }, readAt: null }, data: { readAt: new Date() } }); unread.delete(open.id); }

  // Only members who have chosen to be seen, and only for members who have chosen the same.
  const members = me && listed && tab === "members"
    ? (await prisma.person.findMany({ where: { tenantId, id: { not: me.id }, memberUser: { isNot: null } }, select: { id: true, firstName: true, lastName: true, headline: true, memberSince: true, ...TRUST_SELECT }, orderBy: { memberSince: "asc" }, take: 200 }))
        .filter((p) => mayInvite(p) && privacyOf({ privacy: p.privacy }).consents.memberDirectory)
    : [];

  return (
    <>
      <PageHeader title="Community" description={internal ? "What members are sharing. Work and asks posted here are already leads in Requirements. You can take a post down." : !board ? "Find other members who chose to be seen, and connect. Free for members." : !links ? "Share work you know about, ask for someone, and say when you are free. Free for members." : "Share work you know about, ask for someone, say when you are free, and connect with other members. Free for members."} />
      {sp.notice && NOTICE[sp.notice] ? <div role="status" className="mb-4 rounded-[12px] border border-teal/30 bg-teal-50 px-4 py-3 text-[13px]">{sp.notice === "referred" && !earnings ? "Thank you. We will tell you how it goes." : NOTICE[sp.notice]}</div> : null}
      {internal || !board || !links ? null : <Tabs items={[{ key: "board", label: "Board", count: posts.length }, { key: "members", label: "Members" }, { key: "connections", label: "Connections", count: incoming.length + unreadTotal || undefined }]} current={tab} base="/community" />}
      {!internal && !board ? <Tabs items={[{ key: "members", label: "Members" }, { key: "connections", label: "Connections", count: incoming.length + unreadTotal || undefined }]} current={tab} base="/community" /> : null}

      {tab === "board" ? (
        <div className={empty ? "max-w-[760px]" : "grid grid-cols-1 xl:grid-cols-3 gap-4"}>
          {empty ? null : <div className="xl:col-span-2">
            <Card>
              <CardBody className="pt-2">
                {posts.length === 0 ? <div className="py-6"><EmptyState title="Nothing on the board yet" description={internal ? "When members share work, ask for someone or say they are free, it shows here." : "Be the first: share a piece of work you know about, or say when you are free."} /></div> : (
                  <ul className="divide-y divide-line">
                    {posts.map((p) => (
                      <li key={p.id}>
                        <PostItem p={p} me={me} internal={internal} pitched={!!p.briefId && pitched.has(p.briefId)} link={linkWith(p.authorPersonId) ?? null} canConnect={listed && links} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>}
          {internal ? null : (
            <div>
              <ShareGuide earnings={earnings} intro={empty ? "The board is empty, so you would be first. Your name is shown with what you share." : "Share something with members. Your name is shown with it."} />
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
          {accepted.length === 0 ? <EmptyState title="No connections yet" description="Find people under Members, or connect with someone who says they are available on the board. Once you are connected you can message each other here." /> : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]" data-messages>
              <ul className="space-y-0.5 self-start rounded-[16px] border border-line bg-surface p-1.5" aria-label="Your connections">
                {sorted.map((c) => { const o = c.fromPersonId === me!.id ? c.to : c.from; const l = last.get(c.id); const n = unread.get(c.id) ?? 0; return (
                  <li key={c.id} data-connection>
                    <Link href={`/community?tab=connections&with=${c.id}`} aria-current={open?.id === c.id ? "true" : undefined} className={cn("flex items-center gap-3 rounded-[12px] px-2.5 py-2 transition-colors", open?.id === c.id ? "bg-surface-muted" : "hover:bg-surface-muted/60")}>
                      <Avatar person={o} />
                      <span className="min-w-0 flex-1"><b className="block truncate text-[13.5px] font-semibold">{fullName(o)}</b><span className="block truncate text-[12px] text-ink-faint">{l ? `${l.fromPersonId === me!.id ? "You: " : ""}${l.body}` : o.headline ?? "Say hello"}</span></span>
                      {n ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-teal-400)] px-1.5 text-[11px] font-semibold text-white">{n}</span> : null}
                    </Link>
                  </li>
                ); })}
              </ul>
              {open ? (() => { const o = open.fromPersonId === me!.id ? open.to : open.from; return (
                <section className="flex min-h-[460px] flex-col rounded-[16px] border border-line bg-surface" aria-label={`Conversation with ${fullName(o)}`} data-thread>
                  <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
                    <Avatar person={o} />
                    <div className="min-w-0 flex-1"><b className="block text-[14.5px] font-semibold">{fullName(o)}</b><span className="block truncate text-[12.5px] text-ink-muted">{o.headline ?? ""}</span></div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
                      {o.email ? <a className="inline-flex items-center gap-1 hover:text-ink" href={`mailto:${o.email}`}><Mail className="h-3.5 w-3.5" aria-hidden="true" />{o.email}</a> : null}
                      {o.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" aria-hidden="true" />{o.phone}</span> : null}
                      {o.linkedinUrl ? <a className="inline-flex items-center gap-1 hover:text-ink" href={o.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />LinkedIn</a> : null}
                    </div>
                  </header>
                  <ol className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4" aria-label="Messages">
                    {thread.length === 0 ? <li className="m-auto max-w-[36ch] text-center text-[13px] text-ink-muted">Say hello to {o.firstName}. Only the two of you can read this.</li> : thread.map((m) => { const mineMsg = m.fromPersonId === me!.id; return (
                      <li key={m.id} className={cn("max-w-[78%]", mineMsg ? "self-end text-right" : "self-start")} data-message>
                        <span className={cn("inline-block whitespace-pre-line rounded-[16px] px-3.5 py-2 text-left text-[13.5px] leading-[1.5]", mineMsg ? "bg-ink text-canvas" : "bg-surface-muted text-ink")}>{m.body}</span>
                        <span className="mt-0.5 block text-[11px] text-ink-faint"><DateText date={m.createdAt} relative /></span>
                      </li>
                    ); })}
                  </ol>
                  <form action={sendMessage} className="border-t border-line p-3">
                    <input type="hidden" name="connectionId" value={open.id} />
                    <div className="composer flex items-center gap-2 p-1 pl-4">
                      <input name="body" required maxLength={2000} placeholder={`Message ${o.firstName}…`} aria-label={`Message ${o.firstName}`} className="h-10 min-w-0 flex-1 text-[14px]" autoComplete="off" />
                      <button type="submit" className="send-btn" aria-label="Send message"><ArrowUp className="h-4 w-4" /></button>
                    </div>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-ink-faint"><Lock className="h-3 w-3" aria-hidden="true" />Only the two of you see this conversation in Amana.</p>
                  </form>
                </section>
              ); })() : null}
            </div>
          )}
        </div>
      )}
    </>
  );
}
