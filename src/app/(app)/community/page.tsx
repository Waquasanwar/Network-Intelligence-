import Link from "next/link";
import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { isInternal } from "@/lib/authz";
import { privacyOf, canShowPhoto } from "@/lib/privacy";
import { mayInvite } from "@/server/invites";
import { resolveMemberPerson, loadFeatures } from "@/server/queries";
import { standardFor } from "@/lib/standard-for";
import { TRUST_SELECT } from "@/lib/trust-include";
import { fullName } from "@/lib/utils";
import { PageHeader, EmptyState, Tabs } from "@/components/ui/page";
import { Avatar } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProofPips } from "@/components/domain/standard";
import { ChatComposer, ChatScroll, ChatSearch, ShortTime, DayLabel } from "@/components/domain/chat";
import { PostItem, ShareGuide, ShareBox } from "@/components/domain/board";
import { connect, answerConnection, setDirectory, sendMessage } from "@/server/actions/community";
import { Lock, Mail, Phone, ExternalLink, MessageCircle, ChevronLeft, PenSquare } from "lucide-react";
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
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ tab?: string; notice?: string; with?: string; kind?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const internal = isInternal(user);
  const base = internal ? null : await resolveMemberPerson(user, null);
  const me = base ? await prisma.person.findUnique({ where: { id: base.id }, select: { id: true, firstName: true, lastName: true, tenantId: true, memberSince: true, screeningStatus: true, screenedAt: true, privacy: true, photoUrl: true } }) : null;
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
    !board ? Promise.resolve([]) : prisma.boardPost.findMany({ where: { tenantId, status: "OPEN" }, include: { author: { select: { id: true, firstName: true, lastName: true, headline: true, photoUrl: true, privacy: true } }, replies: { include: { author: { select: { id: true, firstName: true, lastName: true, photoUrl: true, privacy: true } } }, orderBy: { createdAt: "asc" }, take: 50 } }, orderBy: { createdAt: "desc" }, take: 60 }),
    me && links ? prisma.connection.findMany({ where: { OR: [{ fromPersonId: me.id }, { toPersonId: me.id }] }, include: { from: { select: { id: true, firstName: true, lastName: true, headline: true, email: true, phone: true, linkedinUrl: true, photoUrl: true, privacy: true } }, to: { select: { id: true, firstName: true, lastName: true, headline: true, email: true, phone: true, linkedinUrl: true, photoUrl: true, privacy: true } } }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
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
  const members = me && listed && (tab === "members" || (tab === "board" && links))
    ? (await prisma.person.findMany({ where: { tenantId, id: { not: me.id }, memberUser: { isNot: null } }, select: { id: true, firstName: true, lastName: true, headline: true, memberSince: true, photoUrl: true, ...TRUST_SELECT }, orderBy: { memberSince: "asc" }, take: 200 }))
        .filter((p) => mayInvite(p) && privacyOf({ privacy: p.privacy }).consents.memberDirectory)
    : [];


  const KINDS = ["WORK", "HELP", "AVAILABLE", "UPDATE"] as const;
  const kind = KINDS.find((k) => k === sp.kind) ?? null;
  const shown = kind ? posts.filter((p) => p.kind === kind) : posts;
  const other = (c: (typeof accepted)[number]) => (c.fromPersonId === me!.id ? c.to : c.from);
  const pic = (x: { photoUrl?: string | null; privacy?: unknown }) => (canShowPhoto(x, "internal") ? x.photoUrl ?? null : null);
  const toMeet = members.filter((m) => !linkWith(m.id)).slice(0, 3);
  const notice = sp.notice && NOTICE[sp.notice] ? (sp.notice === "referred" && !earnings ? "Thank you. We will tell you how it goes." : NOTICE[sp.notice]) : null;
  const tabs = [
    ...(board ? [{ key: "board", label: "Feed", count: posts.length || undefined }] : []),
    ...(links ? [{ key: "members", label: "People" }, { key: "connections", label: "Messages", count: incoming.length + unreadTotal || undefined }] : []),
  ];

  return (
    <>
      <div className="community-head">
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-ink">Community</h1>
        {internal ? <p className="mt-1 max-w-[62ch] text-[14px] text-ink-muted">What members are sharing. Work and asks posted here are already leads in Requirements.</p> : null}
      </div>
      {notice ? <div role="status" className="mb-4 rounded-[12px] border border-teal/30 bg-teal-50 px-4 py-3 text-[13px]">{notice}</div> : null}
      {internal || tabs.length < 2 ? null : <Tabs items={tabs} current={tab} base="/community" />}

      {tab === "board" ? (
        <div className={internal ? "max-w-[760px]" : "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"}>
          <div className="min-w-0 space-y-4">
            {internal ? null : empty
              ? <ShareGuide earnings={earnings} intro="The feed is empty, so you would be first. Your name is shown with what you share." />
              : <ShareBox me={me!} earnings={earnings} />}
            {posts.length ? (
              <nav className="flex flex-wrap gap-1.5" aria-label="Show">
                {[[null, "All"], ["WORK", "Work"], ["HELP", "Looking for someone"], ["AVAILABLE", "Free for work"], ["UPDATE", "Sharing"]].map(([k, l]) => (
                  <Link key={l} href={k ? `/community?kind=${k}` : "/community"} aria-current={kind === k ? "page" : undefined} className={cn("feed-filter", kind === k && "is-on")}>{l}</Link>
                ))}
              </nav>
            ) : null}
            {posts.length === 0 ? (internal ? <EmptyState title="Nothing shared yet" description="When members share work, ask for someone or say they are free, it shows here." /> : null) : shown.length === 0 ? (
              <p className="py-8 text-center text-[14px] text-ink-muted">Nothing like that right now. <Link href="/community" className="font-semibold text-ink underline-offset-4 hover:underline">See everything</Link></p>
            ) : (
              <ul className="feed" data-feed>
                {shown.map((p) => (
                  <li key={p.id}>
                    <PostItem p={p} me={me} internal={internal} pitched={!!p.briefId && pitched.has(p.briefId)} link={linkWith(p.authorPersonId) ?? null} canConnect={listed && links} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          {internal ? null : (
            <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start" aria-label="Your people">
              {links ? (
                <section aria-labelledby="rail-msgs">
                  <div className="flex items-baseline justify-between"><h2 id="rail-msgs" className="text-[14px] font-semibold text-ink">Messages</h2><Link href="/community?tab=connections" className="text-[12.5px] font-semibold text-ink-muted hover:text-ink">Open</Link></div>
                  {sorted.length ? (
                    <ul className="mt-2 space-y-0.5">
                      {sorted.slice(0, 4).map((c) => { const o = other(c); const l = last.get(c.id); const n = unread.get(c.id) ?? 0; return (
                        <li key={c.id}><Link href={`/community?tab=connections&with=${c.id}`} className="rail-row"><Avatar person={o} size="sm" src={pic(o)} /><span className="min-w-0 flex-1"><b className="block truncate text-[13px] font-semibold text-ink">{fullName(o)}</b><span className="block truncate text-[12px] text-ink-faint">{l ? `${l.fromPersonId === me!.id ? "You: " : ""}${l.body}` : "Say hello"}</span></span>{n ? <span className="chat-unread">{n}</span> : null}</Link></li>
                      ); })}
                    </ul>
                  ) : <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">Connect with a member to message them here.</p>}
                </section>
              ) : null}
              {links && listed && toMeet.length ? (
                <section aria-labelledby="rail-meet">
                  <div className="flex items-baseline justify-between"><h2 id="rail-meet" className="text-[14px] font-semibold text-ink">People to meet</h2><Link href="/community?tab=members" className="text-[12.5px] font-semibold text-ink-muted hover:text-ink">All</Link></div>
                  <ul className="mt-2 space-y-1">
                    {toMeet.map((m) => (
                      <li key={m.id} className="rail-row"><Avatar person={m} size="sm" src={pic(m)} /><span className="min-w-0 flex-1"><b className="block truncate text-[13px] font-semibold text-ink">{fullName(m)}</b><span className="block truncate text-[12px] text-ink-faint">{m.headline ?? ""}</span></span><form action={connect}><input type="hidden" name="personId" value={m.id} /><SubmitButton size="sm" variant="secondary" pendingText="…">Connect</SubmitButton></form></li>
                    ))}
                  </ul>
                </section>
              ) : links && !listed ? (
                <section aria-labelledby="rail-seen">
                  <h2 id="rail-seen" className="text-[14px] font-semibold text-ink">Meet other members</h2>
                  <p className="mt-1 text-[13px] leading-[1.5] text-ink-muted">Let members see you, and you will see them. Contact details are only shared when you both agree.</p>
                  <form action={setDirectory} className="mt-2.5"><input type="hidden" name="on" value="1" /><SubmitButton size="sm" variant="secondary" pendingText="…">Show me to other members</SubmitButton></form>
                </section>
              ) : null}
            </aside>
          )}
        </div>
      ) : tab === "members" ? (
        !listed ? (
          <div className="max-w-[560px] rounded-[20px] border border-line bg-surface p-6">
            <h2 className="text-[17px] font-semibold text-ink">Meet members who chose to be seen</h2>
            <p className="mt-1.5 text-[14px] leading-[1.55] text-ink-muted">Switch on being seen and you will see them too. They see your name, headline and the proofs you hold. Your email and phone only go to people whose request you accept.</p>
            <form action={setDirectory} className="mt-4"><input type="hidden" name="on" value="1" /><SubmitButton pendingText="…">Show me to other members</SubmitButton></form>
          </div>
        ) : (
          <div className="max-w-[860px]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] text-ink-muted"><b className="font-semibold text-ink">{members.length}</b> {members.length === 1 ? "member" : "members"} you can meet. Contact details are shared once you both agree.</p>
              <form action={setDirectory}><input type="hidden" name="on" value="0" /><SubmitButton size="sm" variant="ghost" pendingText="…">Hide me</SubmitButton></form>
            </div>
            {members.length === 0 ? <EmptyState title="Nobody else yet" description="As other members switch on being seen, they appear here." /> : (
              <ul className="people-grid">
                {members.map((m) => {
                  const s = standardFor(m, "outside"); const c = linkWith(m.id);
                  return (
                    <li key={m.id} className="person-tile" data-member>
                      <div className="flex items-start gap-3"><Avatar person={m} size="lg" src={pic(m)} /><div className="min-w-0 flex-1"><b className="block truncate text-[14.5px] font-semibold text-ink">{fullName(m)}</b><span className="line-clamp-2 text-[12.5px] leading-[1.45] text-ink-muted">{m.headline ?? ""}</span></div></div>
                      <span className="mt-2.5 flex items-center gap-2 text-[12px] text-ink-faint"><ProofPips s={s} /><span className="truncate">{s.line}</span></span>
                      {m.capabilities.length ? <div className="mt-2 flex flex-wrap gap-1">{m.capabilities.slice(0, 3).map((x) => <span key={x} className="tag">{x}</span>)}</div> : null}
                      <div className="mt-auto pt-3.5">
                        {c?.status === "ACCEPTED" ? <Link href={`/community?tab=connections&with=${c.id}`} className="tile-action is-primary"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />Message</Link>
                          : c?.status === "PENDING" && c.fromPersonId === me!.id ? <span className="tile-action is-muted">Request sent</span>
                          : c?.status === "DECLINED" ? null
                          : <form action={connect}><input type="hidden" name="personId" value={m.id} /><SubmitButton size="sm" variant={c ? "primary" : "secondary"} pendingText="…" className="w-full">{c ? "Accept" : "Connect"}</SubmitButton></form>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )
      ) : (
        <div className={cn("chat", sp.with ? "has-thread" : "has-list")} data-messages>
          <div className="chat-side">
            <div className="chat-side-head">
              <h2 className="text-[16px] font-semibold text-ink">Messages</h2>
              <Link href="/community?tab=members" className="chat-new" aria-label="Start a conversation with a member" title="Find someone to message"><PenSquare className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
            {accepted.length > 3 ? <ChatSearch listId="chat-list" /> : null}
            {incoming.length ? (
              <div className="chat-requests" aria-label="Requests to connect">
                <p className="px-3 pb-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{incoming.length} {incoming.length === 1 ? "request" : "requests"}</p>
                {incoming.map((c) => (
                  <div key={c.id} className="chat-request">
                    <Avatar person={c.from} src={pic(c.from)} />
                    <div className="min-w-0 flex-1"><b className="block truncate text-[13.5px] font-semibold text-ink">{fullName(c.from)}</b><span className="block truncate text-[12px] text-ink-muted">{c.message ?? c.from.headline ?? "Wants to connect"}</span>
                      <div className="mt-2 flex gap-1.5">
                        <form action={answerConnection}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="answer" value="accept" /><SubmitButton size="sm" pendingText="…">Accept</SubmitButton></form>
                        <form action={answerConnection}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="answer" value="decline" /><SubmitButton size="sm" variant="ghost" pendingText="…">Decline</SubmitButton></form>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {accepted.length ? (
              <ul id="chat-list" className="chat-list" aria-label="Your conversations">
                {sorted.map((c) => { const o = other(c); const l = last.get(c.id); const n = unread.get(c.id) ?? 0; return (
                  <li key={c.id} data-connection data-name={fullName(o).toLowerCase()}>
                    <Link href={`/community?tab=connections&with=${c.id}`} aria-current={open?.id === c.id ? "true" : undefined} className={cn("chat-row", n && "is-unread")}>
                      <Avatar person={o} size="lg" src={pic(o)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2"><b className="truncate text-[14px] font-semibold text-ink">{fullName(o)}</b>{l ? <span className="flex-none text-[11.5px] text-ink-faint"><ShortTime iso={l.createdAt.toISOString()} /></span> : null}</span>
                        <span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">{l ? `${l.fromPersonId === me!.id ? "You: " : ""}${l.body}` : `Say hello to ${o.firstName}`}</span>{n ? <span className="chat-unread">{n}</span> : null}</span>
                      </span>
                    </Link>
                  </li>
                ); })}
              </ul>
            ) : (
              <div className="px-5 py-10 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-muted text-ink-muted" aria-hidden="true"><MessageCircle className="h-5 w-5" /></span>
                <p className="mt-3 text-[14px] font-semibold text-ink">No conversations yet</p>
                <p className="mt-1 text-[13px] leading-[1.5] text-ink-muted">Connect with a member and you can message each other here.</p>
                <Link href="/community?tab=members" className="mt-4 inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-canvas">Find people</Link>
              </div>
            )}
          </div>
          {open ? (() => { const o = other(open); const groups = groupThread(thread, me!.id); return (
            <section className="chat-main" aria-label={`Conversation with ${fullName(o)}`} data-thread>
              <header className="chat-head">
                <Link href="/community?tab=connections" className="chat-back" aria-label="Back to all messages"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></Link>
                <Avatar person={o} src={pic(o)} />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-semibold text-ink">{fullName(o)}</b>
                  <span className="block truncate text-[12.5px] text-ink-muted">{[o.headline, o.email].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="flex flex-none items-center gap-1">
                  {o.email ? <a className="chat-icon" href={`mailto:${o.email}`} title={`Email ${o.email}`} aria-label={`Email ${o.firstName}`}><Mail className="h-4 w-4" aria-hidden="true" /></a> : null}
                  {o.phone ? <a className="chat-icon" href={`tel:${o.phone.replace(/\s+/g, "")}`} title={o.phone} aria-label={`Call ${o.firstName} on ${o.phone}`}><Phone className="h-4 w-4" aria-hidden="true" /></a> : null}
                  {o.linkedinUrl ? <a className="chat-icon" href={o.linkedinUrl} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${o.firstName} on LinkedIn`}><ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : null}
                </div>
              </header>
              <ChatScroll count={thread.length} label="Messages">
                {thread.length === 0 ? (
                  <li className="m-auto max-w-[34ch] py-10 text-center">
                    <Avatar person={o} size="xl" className="mx-auto" src={pic(o)} />
                    <p className="mt-3 text-[15px] font-semibold text-ink">You and {o.firstName} are connected</p>
                    <p className="mt-1 text-[13px] leading-[1.5] text-ink-muted">Say hello. Only the two of you can read this conversation.</p>
                  </li>
                ) : groups.map((g) => (
                  <li key={g.key} className="chat-day">
                    <p className="chat-day-label"><DayLabel iso={g.iso} /></p>
                    {g.runs.map((r) => (
                      <div key={r.key} className={cn("chat-run", r.mine ? "is-mine" : "is-theirs")}>
                        {r.mine ? null : <Avatar person={o} size="sm" className="chat-run-face" src={pic(o)} />}
                        <div className="chat-run-body">
                          {r.items.map((m) => <p key={m.id} className="chat-bubble" data-message>{m.body}</p>)}
                          <span className="chat-time"><ShortTime iso={r.items[r.items.length - 1].createdAt.toISOString()} mode="clock" /></span>
                        </div>
                      </div>
                    ))}
                  </li>
                ))}
              </ChatScroll>
              <div className="chat-foot">
                <ChatComposer action={sendMessage} connectionId={open.id} name={o.firstName} />
                <p className="mt-1.5 inline-flex items-center gap-1.5 px-1 text-[11.5px] text-ink-faint"><Lock className="h-3 w-3" aria-hidden="true" />Only the two of you see this. Enter to send, Shift+Enter for a new line.</p>
              </div>
            </section>
          ); })() : (
            <section className="chat-main chat-empty" aria-label="No conversation open">
              <MessageCircle className="h-6 w-6 text-ink-faint" aria-hidden="true" />
              <p className="mt-2 text-[14px] text-ink-muted">Pick a conversation, or find someone new under People.</p>
            </section>
          )}
        </div>
      )}
    </>
  );
}

type Msg = { id: string; body: string; createdAt: Date; fromPersonId: string };
/**
 * A thread as days, and each day as runs of messages from the same person sent close together, so
 * it reads like any chat: one face and one time per run, not per message.
 */
function groupThread(thread: Msg[], meId: string) {
  const days: { key: string; iso: string; runs: { key: string; mine: boolean; items: Msg[] }[] }[] = [];
  for (const m of thread) {
    const dayKey = m.createdAt.toISOString().slice(0, 10);
    let d = days[days.length - 1];
    if (!d || d.key !== dayKey) { d = { key: dayKey, iso: m.createdAt.toISOString(), runs: [] }; days.push(d); }
    const mine = m.fromPersonId === meId;
    const r = d.runs[d.runs.length - 1];
    const prev = r?.items[r.items.length - 1];
    if (r && r.mine === mine && prev && m.createdAt.getTime() - prev.createdAt.getTime() < 5 * 60_000) r.items.push(m);
    else d.runs.push({ key: m.id, mine, items: [m] });
  }
  return days;
}
