import Link from "next/link";
import { ArrowUp, MessageCircle, Send, Check, UserPlus } from "lucide-react";
import type { BoardPostKind, EngagementRoute } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Guide } from "@/components/ui/guide";
import { DateText } from "@/components/domain/date";
import { ROUTE_LABELS } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import { closePost, interestedInPost, referToPost, connect, replyToPost, createPost } from "@/server/actions/community";

export const KIND: Record<BoardPostKind, { label: string; tone: string }> = {
  WORK: { label: "Work I know about", tone: "is-mint" },
  HELP: { label: "Looking for someone", tone: "is-gold" },
  AVAILABLE: { label: "Free for work", tone: "is-blue" },
  UPDATE: { label: "Sharing", tone: "" },
};

type Who = { id: string; firstName: string; lastName: string };
export type FeedPost = {
  id: string; kind: BoardPostKind; title: string; body: string; route: EngagementRoute | null; location: string | null; briefId: string | null; createdAt: Date; authorPersonId: string;
  author: Who & { headline: string | null };
  replies: { id: string; body: string; createdAt: Date; authorPersonId: string; author: Who }[];
};

/**
 * One post on the members' board, read like a post anywhere else on the web: who said it, what they
 * said, and the conversation under it. Work and asks carry the network's ways to help; everyone can reply.
 */
export function PostItem({ p, me, internal = false, pitched = false, link = null, canConnect = false }: {
  p: FeedPost; me: { id: string } | null; internal?: boolean; pitched?: boolean;
  /** Where the reader stands with the author, for "free for work" posts. */
  link?: { id: string; status: string } | null; canConnect?: boolean;
}) {
  const own = me?.id === p.authorPersonId;
  const lead = p.kind === "WORK" || p.kind === "HELP";
  return (
    <article className="post" data-post={p.kind}>
      <header className="flex items-start gap-3">
        <Avatar person={p.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            <b className="font-semibold text-ink">{own ? "You" : fullName(p.author)}</b>
            {p.kind !== "UPDATE" ? <span className={`tag ${KIND[p.kind].tone}`}>{KIND[p.kind].label}</span> : null}
            <span className="text-ink-faint"><DateText date={p.createdAt} relative /></span>
          </div>
          {p.author.headline ? <div className="truncate text-[12px] text-ink-faint">{p.author.headline}</div> : null}
        </div>
        {own || internal ? <form action={closePost}><input type="hidden" name="postId" value={p.id} /><SubmitButton size="sm" variant="ghost" pendingText="…">{internal ? "Take down" : "Close"}</SubmitButton></form> : null}
      </header>
      <h3 className="mt-3 text-[16px] font-semibold leading-snug text-ink">{p.title}</h3>
      <p className="mt-1.5 max-w-[75ch] whitespace-pre-line text-[14px] leading-[1.6] text-ink-muted">{p.body}</p>
      {p.route || p.location ? <div className="mt-2.5 flex flex-wrap gap-1">{p.route ? <Chip>{ROUTE_LABELS[p.route]}</Chip> : null}{p.location ? <Chip>{p.location}</Chip> : null}</div> : null}
      {internal && p.briefId ? <Link href={`/requirements/${p.briefId}`} className="mt-2 inline-block text-[12.5px] font-semibold text-ink underline underline-offset-2">Open the lead in Requirements</Link> : null}

      {!own && !internal ? (
        <div className="post-actions">
          {lead ? (p.briefId && pitched
            ? <span className="post-act is-done"><Check className="h-3.5 w-3.5" aria-hidden="true" />You said you are interested</span>
            : <form action={interestedInPost}><input type="hidden" name="postId" value={p.id} /><SubmitButton size="sm" pendingText="…">I&apos;m interested</SubmitButton></form>) : null}
          {link?.status === "ACCEPTED"
            ? <Link href={`/community?tab=connections&with=${link.id}`} className="post-act"><Send className="h-3.5 w-3.5" aria-hidden="true" />Message {p.author.firstName}</Link>
            : link?.status === "PENDING" ? <span className="post-act is-done">Request sent</span>
            : canConnect && (p.kind === "AVAILABLE" || p.kind === "HELP") ? <form action={connect}><input type="hidden" name="personId" value={p.authorPersonId} /><button type="submit" className="post-act"><UserPlus className="h-3.5 w-3.5" aria-hidden="true" />Connect</button></form> : null}
          {lead ? (
            <details className="w-full sm:w-auto sm:flex-1"><summary className="post-act list-none [&::-webkit-details-marker]:hidden">Refer someone</summary>
              <Guide
                className="mt-3 max-w-[560px]"
                intro="Refer someone you would stand behind. Credited to you if they are placed."
                action={referToPost}
                hidden={{ postId: p.id }}
                submit="Send referral"
                review="Here is your referral"
                steps={[
                  { name: "name", kind: "text", ask: "Who would you refer?", short: "Who", placeholder: "Their full name", min: 2, max: 120 },
                  { name: "context", kind: "text", ask: "How do you know {name}'s work?", short: "How you know them", placeholder: "Ran the data migration on our programme last year", min: 5, max: 600 },
                  { name: "email", kind: "text", ask: "How can we reach {name}?", short: "Contact", optional: true, placeholder: "Email or LinkedIn", max: 200 },
                ]}
              />
            </details>
          ) : null}
        </div>
      ) : null}

      <div id={`post-${p.id}`} className="mt-3 space-y-2" data-replies>
        {p.replies.length ? <div className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{p.replies.length} {p.replies.length === 1 ? "reply" : "replies"}</div> : null}
        {p.replies.map((r) => (
          <div key={r.id} className="flex items-start gap-2.5" data-reply>
            <Avatar person={r.author} size="sm" />
            <div className="min-w-0 rounded-[14px] bg-surface-muted px-3 py-2">
              <div className="text-[12px] text-ink-faint"><b className="font-semibold text-ink">{me?.id === r.authorPersonId ? "You" : fullName(r.author)}</b> · <DateText date={r.createdAt} relative /></div>
              <p className="mt-0.5 whitespace-pre-line text-[13.5px] leading-[1.5] text-ink">{r.body}</p>
            </div>
          </div>
        ))}
        {internal ? null : (
          <form action={replyToPost} className="composer flex items-center gap-2 p-1 pl-4">
            <input type="hidden" name="postId" value={p.id} />
            <input name="body" required minLength={2} maxLength={1000} placeholder={own ? "Add to your post…" : `Reply to ${p.author.firstName}…`} aria-label={`Reply to ${own ? "your post" : p.author.firstName}`} className="h-9 min-w-0 flex-1 text-[13.5px]" />
            <button type="submit" className="send-btn !h-8 !w-8" aria-label="Send reply"><ArrowUp className="h-4 w-4" /></button>
          </form>
        )}
      </div>
    </article>
  );
}

/** Share something with members, one question at a time. Work and asks go through the network. */
export function ShareGuide({ intro, earnings = false, className }: { intro: string; earnings?: boolean; className?: string }) {
  const work = { name: "kind", in: ["WORK", "HELP", "AVAILABLE"] };
  return (
    <Guide
      className={className}
      intro={intro}
      action={createPost}
      submit="Post"
      pending="Posting…"
      review="Here is your post"
      steps={[
        { name: "kind", kind: "choice", ask: "What would you like to share?", short: "What", options: [
          { value: "UPDATE", label: "Just sharing", hint: "News, a thought, something useful you came across" },
          { value: "WORK", label: "Work I know about", hint: "A role or project someone needs filled" },
          { value: "HELP", label: "I am looking for someone", hint: "A specialist you need yourself" },
          { value: "AVAILABLE", label: "I am free for work", hint: "Let members know you can take something on" },
        ] },
        { name: "title", kind: "text", ask: "Give it a one-line title", short: "Title", placeholder: "Interim CFO, energy group, Dubai", min: 4, max: 120 },
        { name: "body", kind: "long", ask: "Tell members a little more", short: "Details", hint: "A few lines is plenty.", min: 10, max: 2000 },
        { name: "route", kind: "choice", ask: "What kind of work is it?", short: "Type", optional: true, when: work, options: [{ value: "", label: "Any, or not sure" }, ...(Object.keys(ROUTE_LABELS) as EngagementRoute[]).map((r) => ({ value: r, label: ROUTE_LABELS[r] }))] },
        { name: "location", kind: "text", ask: "Where is it?", short: "Where", optional: true, when: work, max: 120, placeholder: "City, or remote", picks: ["Dubai", "Abu Dhabi", "Riyadh", "London", "Remote"] },
        { name: "terms", kind: "confirm", ask: "One thing before it goes up", short: "Through the network", when: { name: "kind", in: ["WORK", "HELP"] }, hint: earnings ? "Work shared here is introduced through the network, so nobody is cut out. If someone you bring in is placed, you receive a share of the fee." : "Work shared here is introduced through the network, so nobody is cut out.", yes: "That is fine" },
      ]}
    />
  );
}

/** The feed's composer: one quiet line until you want it, then the share guide. */
export function ShareBox({ me, earnings = false }: { me: Who; earnings?: boolean }) {
  return (
    <details className="share-box" data-share>
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <Avatar person={me} />
        <span className="flex-1 text-[14.5px] text-ink-faint">Share something with the network…</span>
        <span className="chip !h-8 font-semibold text-ink">Share</span>
      </summary>
      <ShareGuide className="mt-4" earnings={earnings} intro="Your name is shown with what you share." />
    </details>
  );
}
