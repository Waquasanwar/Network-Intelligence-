"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { draftOutreach } from "@/server/actions/opportunities";
import { Sparkles, Copy, Check } from "lucide-react";

/** Agentic outreach: draft a short note to a matched person. Owner edits and sends it themselves. */
export function OutreachButton({ opportunityId, personId }: { opportunityId: string; personId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function gen() {
    setErr(null);
    start(async () => {
      const r = await draftOutreach(opportunityId, personId);
      if (!r.ok) { setErr(r.error); return; }
      setText(r.text);
    });
  }

  if (text === null) {
    return (
      <span className="inline-flex items-center gap-2">
        <Button size="sm" variant="ghost" type="button" onClick={gen} disabled={pending}><Sparkles className="h-3.5 w-3.5" /> {pending ? "Drafting…" : "Draft outreach"}</Button>
        {err ? <span className="text-[11px] text-risk">{err}</span> : null}
      </span>
    );
  }

  return (
    <div className="mt-3 rounded-[10px] border border-line bg-surface-muted/50 p-3 w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-ink inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-navy" /> Draft message — yours to edit before sending. The client is never named.</span>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {}); }} className="text-[11.5px] text-navy inline-flex items-center gap-1 hover:underline">
          {copied ? <Check className="h-3.5 w-3.5 text-teal" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}
        </button>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[156px] text-[12.5px] leading-5" />
      <div className="mt-2 flex justify-end"><Button size="sm" variant="ghost" type="button" onClick={gen} disabled={pending}>{pending ? "…" : "Redraft"}</Button></div>
    </div>
  );
}
