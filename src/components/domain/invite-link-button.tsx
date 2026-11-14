"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createInviteLink } from "@/server/actions/members";
import { Link2, Check, Copy } from "lucide-react";

/** Mint + copy a shareable invite link so a member can let someone register themselves. */
export function InviteLinkButton({ asPersonId }: { asPersonId?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function copy(link: string) {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => {});
  }

  function make() {
    setErr(null);
    start(async () => {
      const res = await createInviteLink(asPersonId);
      if (!res.ok) { setErr(res.error); return; }
      const link = `${window.location.origin}/join?t=${res.token}`;
      setUrl(link);
      copy(link);
    });
  }

  return (
    <div className="text-right">
      <Button type="button" variant="secondary" size="sm" onClick={make} disabled={pending}>
        <Link2 className="h-3.5 w-3.5" /> {pending ? "…" : "Invite link"}
      </Button>
      {err ? <div className="text-[11.5px] text-risk mt-1">{err}</div> : null}
      {url ? (
        <div className="mt-2 flex items-center gap-1.5 rounded-[8px] border border-line bg-surface-muted/60 px-2 py-1.5 max-w-[320px]">
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="flex-1 bg-transparent text-[11.5px] text-ink-muted outline-none truncate" />
          <button type="button" onClick={() => copy(url)} className="flex-none text-navy hover:text-navy-600" aria-label="Copy link">
            {copied ? <Check className="h-3.5 w-3.5 text-teal" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      ) : null}
    </div>
  );
}
