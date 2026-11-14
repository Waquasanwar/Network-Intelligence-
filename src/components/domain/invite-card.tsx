"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Copy, Check } from "lucide-react";

/** The one link the owner shares so people can join. Shown ready-to-copy — no steps. */
export function InviteCard({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setUrl(`${window.location.origin}/join?t=${token}`); }, [token]);

  function copy() {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  return (
    <div className="rounded-[12px] border border-line bg-surface shadow-[var(--shadow-card)] px-5 py-4 mb-5 flex items-center justify-between gap-5 flex-wrap">
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-ink flex items-center gap-2"><Link2 className="h-4 w-4 text-navy" /> Invite people to your network</div>
        <div className="text-[12.5px] text-ink-muted mt-1 leading-[1.5] max-w-[46ch]">Send anyone this link. They register and do their screening; you review before they go live.</div>
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-[300px] max-w-[540px]">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="flex-1 h-9 rounded-[8px] border border-line bg-surface-muted/50 px-3 text-[12.5px] text-ink-muted outline-none truncate" aria-label="Your invite link" />
        <Button type="button" onClick={copy} className="flex-none">{copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}</Button>
      </div>
    </div>
  );
}
