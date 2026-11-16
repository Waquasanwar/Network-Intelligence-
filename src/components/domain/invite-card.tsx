"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Copy, Check } from "lucide-react";

/** The one link the owner shares so people can join. Shown ready-to-copy — no steps. */
export function InviteCard({ token, className }: { token: string; className?: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setUrl(`${window.location.origin}/join?t=${token}`); }, [token]);

  function copy() {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  return (
    <div className={`widget px-6 py-5 flex flex-col ${className ?? ""}`}>
      <div className="label-caps text-ink-faint flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> Invite link</div>
      <div className="font-display is-small text-[16px] leading-[1.25] text-ink mt-3">Bring someone into the network</div>
      <div className="text-[12.5px] text-ink-muted mt-1.5 leading-[1.5]">They register and do their screening; you review before they go live.</div>
      <div className="flex items-center gap-2 pt-4">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 h-9 rounded-[12px] border border-line bg-surface-muted px-3 text-[12px] text-ink-muted outline-none truncate" aria-label="Your invite link" />
        <Button type="button" onClick={copy} className="flex-none">{copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}</Button>
      </div>
    </div>
  );
}
