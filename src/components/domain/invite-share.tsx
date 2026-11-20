"use client";
import { useEffect, useState, useTransition } from "react";
import { KNOWN_HOW, isKnownHow, type KnownHow } from "@/lib/known";
import { Guide } from "@/components/ui/guide";
import { Check, Copy, Mail, MessageCircle, Share2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createInvite, inviteLink, myInviteLink } from "@/server/actions/invites";

const joinUrl = (token: string) => `${window.location.origin}/join?t=${token}`;

/** The words that go with a link. Short, personal, and honest about what joining involves. */
export function inviteMessage({ url, firstName, network, from }: { url: string; firstName?: string; network: string; from?: string }) {
  return `${firstName ? `Hi ${firstName}` : "Hi"}, I'd like you in ${network}: a small, invitation-only network of people we actually know and would put our name behind. When a client needs someone like you (fractional, contract or permanent) we come to you first.\n\nIt takes about two minutes to join, then a short screening conversation:\n${url}${from ? `\n\n${from}` : ""}`;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    const done = () => { setCopied(key); setTimeout(() => setCopied((c) => (c === key ? null : c)), 2200); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => {});
  };
  return { copied, copy };
}

/**
 * Everything needed to get one link in front of one person: the link, and one-tap ways to send it
 * from the tools people already use. Nothing is sent by the platform itself.
 */
export function ShareKit({ url, message, email, compact = false, subject = "An invitation to join our network", linkLabel = "Invitation link", social = true }: { url: string; message: string; email?: string | null; compact?: boolean; subject?: string; linkLabel?: string; social?: boolean }) {
  const { copied, copy } = useCopy();
  const pill = "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[12.5px] font-semibold text-ink hover:bg-surface-hover transition-colors";
  return (
    <div>
      <div className="flex items-center gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={linkLabel} className="min-w-0 flex-1 h-10 rounded-[12px] border border-line bg-surface-muted px-3 text-[12.5px] text-ink-muted outline-none truncate" />
        <Button type="button" onClick={() => copy("link", url)} className="flex-none">{copied === "link" ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}</Button>
      </div>
      <div className={`flex flex-wrap gap-2 ${compact ? "mt-2.5" : "mt-3"}`}>
        <a className={pill} href={`mailto:${email ? encodeURIComponent(email) : ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}><Mail className="h-3.5 w-3.5" /> Email</a>
        <a className={pill} href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
        {social ? <a className={pill} href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer"><Share2 className="h-3.5 w-3.5" /> LinkedIn</a> : null}
        <button type="button" className={pill} onClick={() => copy("msg", message)}>{copied === "msg" ? <><Check className="h-3.5 w-3.5 text-teal" /> Message copied</> : <><Copy className="h-3.5 w-3.5" /> Copy message</>}</button>
      </div>
    </div>
  );
}

/** A reusable link (the network's, or a member's own) shown ready to share. */
export function LinkShare({ token, network, from }: { token: string; network: string; from?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(joinUrl(token)); }, [token]);
  if (!url) return <div className="h-10 rounded-[12px] bg-surface-muted" aria-hidden="true" />;
  return <ShareKit url={url} message={inviteMessage({ url, network, from })} />;
}

/** A member's link is minted on request, once they are approved. */
export function MyLinkShare({ asPersonId, network, from }: { asPersonId?: string; network: string; from?: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { let on = true; myInviteLink(asPersonId).then((r) => { if (!on) return; if (r.ok) setToken(r.token); else setErr(r.error); }).catch(() => on && setErr("Could not load your link. Refresh the page.")); return () => { on = false; }; }, [asPersonId]);
  if (err) return <p className="text-[13px] text-ink-muted">{err}</p>;
  if (!token) return <div className="h-10 rounded-[12px] bg-surface-muted animate-pulse" aria-hidden="true" />;
  return <LinkShare token={token} network={network} from={from} />;
}

/**
 * Invite one named person. Creates a tracked, single-use invitation and then offers the ways to
 * send it. `personId` turns it into "claim the profile we already hold for you".
 */
export function InviteComposer({ network, from, asPersonId, person, onDone }: { network: string; from?: string; asPersonId?: string; person?: { id: string; name: string; email?: string | null }; onDone?: () => void }) {
  const [made, setMade] = useState<{ url: string; name: string; email: string; note: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [pending, start] = useTransition();

  function finish(f: Record<string, string>) {
    setErr(null);
    start(async () => {
      const r = await createInvite({ name: f.name, email: f.email, note: f.note, knownHow: (isKnownHow(f.knownHow) ? f.knownHow : ""), personId: person?.id ?? "", asPersonId: asPersonId ?? "" });
      if (!r.ok) { setErr(r.error); return; }
      setMade({ url: joinUrl(r.token), name: r.name, email: f.email, note: f.note });
      onDone?.();
    });
  }

  if (made) {
    const first = made.name.split(/\s+/)[0];
    const message = inviteMessage({ url: made.url, firstName: first, network, from: made.note ? `${made.note}${from ? `\n\n${from}` : ""}` : from });
    return (
      <div>
        <div className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-ink"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-ink"><Check className="h-3.5 w-3.5" /></span>{first}&apos;s invitation is ready. Send it your way:</div>
        <ShareKit url={made.url} message={message} email={made.email} />
        <p className="mt-3 text-[12px] text-ink-faint">Works once, for 30 days. You will see here when {first} opens it and when they join.</p>
        {person ? null : <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => { setMade(null); setRound((n) => n + 1); }}><UserPlus className="h-3.5 w-3.5" /> Invite someone else</Button>}
      </div>
    );
  }

  return (
    <Guide
      key={round}
      intro={person ? `An invitation for ${person.name}. Three quick questions.` : "Invite someone you trust. A few quick questions, then a link to send."}
      onFinish={finish}
      busy={pending}
      error={err}
      submit={person ? "Create their invitation" : "Create invitation"}
      pending="Creating…"
      review="Here is the invitation"
      steps={[
        { name: "name", kind: "text", ask: "Who would you like to invite?", short: "Who", placeholder: "Their full name", initial: person?.name ?? "", min: 2, max: 120 },
        { name: "knownHow", kind: "choice", ask: "How do you know {name}?", short: "How you know them", optional: true, options: (Object.keys(KNOWN_HOW) as KnownHow[]).map((k) => ({ value: k, label: KNOWN_HOW[k].label })) },
        { name: "email", kind: "text", ask: "What is {name}'s email?", short: "Email", hint: "Optional. It fills in the To line and their form.", optional: true, initial: person?.email ?? "", placeholder: "sara@example.com", max: 200 },
        { name: "note", kind: "long", ask: "Would you like to add a line from you?", short: "Your line", hint: "Optional. It is added to the message.", optional: true, placeholder: "We worked together on the payments programme. You would like it here.", max: 500 },
      ]}
    />
  );
}

/** Copy the link of an invitation sent earlier, for a reminder. */
export function CopyInviteLink({ inviteId }: { inviteId: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink hover:bg-surface-hover disabled:opacity-60"
      onClick={() => start(async () => { const r = await inviteLink(inviteId); if (!r.ok) { setState("error"); return; } try { await navigator.clipboard.writeText(joinUrl(r.token)); setState("copied"); setTimeout(() => setState("idle"), 2200); } catch { setState("error"); } })}>
      {state === "copied" ? <><Check className="h-3.5 w-3.5 text-teal" /> Copied</> : state === "error" ? "Not available" : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
    </button>
  );
}
