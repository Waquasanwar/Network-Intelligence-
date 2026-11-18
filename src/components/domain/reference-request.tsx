"use client";
import { useState, useTransition } from "react";
import { Check, Copy, MessageSquareQuote, Send } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ShareKit } from "@/components/domain/invite-share";
import { requestReference, referenceLink, revokeReference } from "@/server/actions/references";

const vouchUrl = (token: string) => `${window.location.origin}/vouch?t=${token}`;

export type OpenReference = { id: string; refereeName: string; opened: boolean; sentLabel: string };

/** What goes with the link. Written as the person asking, since they are the one who sends it. */
function referenceMessage({ url, refereeFirst, about, self }: { url: string; refereeFirst: string; about: string; self: boolean }) {
  return self
    ? `Hi ${refereeFirst}, I've joined a small network of consultants who are known first hand, and they ask for a short reference from someone who has seen my work. Would you mind? It takes about a minute and there is no account to create.\n\n${url}\n\nThank you.`
    : `Hi ${refereeFirst}, ${about} has joined our network of consultants who are known first hand, and named you as someone who has seen their work. Would you say a few words? It takes about a minute and there is no account to create.\n\n${url}\n\nThank you.`;
}

function CopyReferenceLink({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink hover:bg-surface-hover disabled:opacity-60"
      onClick={() => start(async () => { const r = await referenceLink(id); if (!r.ok) { setState("error"); return; } try { await navigator.clipboard.writeText(vouchUrl(r.token)); setState("copied"); setTimeout(() => setState("idle"), 2200); } catch { setState("error"); } })}>
      {state === "copied" ? <><Check className="h-3.5 w-3.5 text-teal" /> Copied</> : state === "error" ? "Not available" : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
    </button>
  );
}

/**
 * Ask for a reference. One form, then the ways to send the link from your own email or phone.
 * `personId` is set when the team asks on a member's behalf; a member asks for themselves.
 */
export function ReferenceDrawer({ personId, about, open = [], variant = "secondary" }: { personId?: string; about: string; open?: OpenReference[]; variant?: "secondary" | "primary" | "ghost" }) {
  const self = !personId;
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [context, setContext] = useState("");
  const [made, setMade] = useState<{ url: string; refereeName: string; email: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    start(async () => {
      const r = await requestReference({ personId: personId ?? "", refereeName: name, refereeEmail: email, context });
      if (!r.ok) { setErr(r.error); return; }
      setMade({ url: vouchUrl(r.token), refereeName: r.refereeName, email });
    });
  }

  return (
    <Drawer trigger={<Button size="sm" variant={variant}><MessageSquareQuote className="h-3.5 w-3.5" /> Ask for a reference</Button>} title={self ? "Ask for a reference" : `Ask for a reference for ${about}`} description={self ? "Name someone who has seen your work. They answer from a link in about a minute, with no account. You send the link yourself." : "Name someone who has seen their work. They answer from a link in about a minute, with no account. Nobody needs to be phoned."}>
      {made ? (
        <div>
          <div className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-ink"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-ink"><Check className="h-3.5 w-3.5" /></span> The link for {made.refereeName.split(/\s+/)[0]} is ready. Send it however you normally talk.</div>
          <ShareKit url={made.url} message={referenceMessage({ url: made.url, refereeFirst: made.refereeName.split(/\s+/)[0], about, self })} email={made.email} subject={self ? "Would you give me a short reference?" : `A short reference for ${about}`} linkLabel="Reference link" social={false} />
          <p className="mt-3 text-[12px] text-ink-faint">Works once, for 30 days. It counts as soon as they answer.</p>
          <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => { setMade(null); setName(""); setEmail(""); setContext(""); }}>Ask someone else</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Their name" required><Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="Helen Marsh" /></Field>
            <Field label="Email" hint="Optional. Fills in the To line."><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} placeholder="helen@example.com" /></Field>
          </div>
          <Field label={self ? "How do they know your work?" : "How do they know the work?"} required hint="They see this line, so they know why they are being asked."><Input value={context} onChange={(e) => setContext(e.target.value)} required minLength={3} maxLength={300} placeholder="Programme sponsor on the payments migration" /></Field>
          {err ? <div role="alert" className="text-[12.5px] text-risk">{err}</div> : null}
          <div className="flex justify-end"><Button type="submit" disabled={pending || name.trim().length < 2 || context.trim().length < 3}><Send className="h-3.5 w-3.5" /> {pending ? "Creating…" : "Create the link"}</Button></div>
        </form>
      )}
      {open.length ? (
        <div className="mt-6 border-t border-line pt-4">
          <div className="label-caps text-ink-faint mb-2">Waiting for an answer</div>
          <ul className="divide-y divide-line">
            {open.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <span className="min-w-0"><b className="block truncate font-semibold">{r.refereeName}</b><span className="block text-[12px] text-ink-faint">{r.opened ? "Opened, not answered yet" : "Not opened yet"} · sent {r.sentLabel}</span></span>
                <span className="flex flex-none items-center gap-1.5"><CopyReferenceLink id={r.id} /><form action={revokeReference}><input type="hidden" name="requestId" value={r.id} /><SubmitButton size="sm" variant="ghost" pendingText="…">Cancel</SubmitButton></form></span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Drawer>
  );
}
