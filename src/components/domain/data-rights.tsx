"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { exportMyData, requestMyErasure, cancelMyErasure } from "@/server/actions/privacy";
import { CONSENTS, type Privacy } from "@/lib/privacy";
import { Download, ShieldCheck, Trash2, Check, AlertTriangle } from "lucide-react";

/**
 * A member's own data rights, in one place: a copy to take away, control over each permission, and
 * the right to be deleted. Export and erasure are the two that need a client round-trip (a file
 * download and a typed confirmation); consent toggles post straight to the server action.
 */
export function DataRights({ privacy, firstName, asPersonId }: { privacy: Privacy; firstName: string; asPersonId?: string }) {
  const erasing = !!privacy.erasureRequestedAt;
  const [exporting, startExport] = useTransition();
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);

  function download() {
    startExport(async () => {
      const json = await exportMyData(asPersonId);
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `my-network-data.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  if (erasing) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-[12px] border border-amber/30 bg-amber-50 px-3.5 py-3 text-[12.5px] text-ink">
          <AlertTriangle className="h-4 w-4 text-amber flex-none mt-0.5" />
          <div>Deletion requested. You&apos;re no longer shown to anyone, and the network owner removes your profile within 30 days. Fee and audit records the law requires us to keep are anonymised, not deleted.</div>
        </div>
        <form action={cancelMyErasure}>
          {asPersonId ? <input type="hidden" name="asPersonId" value={asPersonId} /> : null}
          <SubmitButton size="sm" variant="secondary" pendingText="…">Changed your mind? Keep my profile</SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <Button type="button" variant="secondary" size="sm" onClick={download} disabled={exporting}>
          <Download className="h-3.5 w-3.5" /> {exporting ? "Preparing…" : "Download my data"}
        </Button>
        <p className="text-[11.5px] text-ink-faint leading-[1.5]">A machine-readable copy of everything we hold about you — your profile, screening, vouches and where you&apos;ve been proposed.</p>
      </div>

      <div className="border-t border-line pt-3.5">
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-risk">
            <Trash2 className="h-3.5 w-3.5" /> Delete my data
          </button>
        ) : (
          <form action={requestMyErasure} className="space-y-2.5 rounded-[12px] border border-risk/25 bg-risk-100/50 p-3.5">
            {asPersonId ? <input type="hidden" name="asPersonId" value={asPersonId} /> : null}
            <div className="text-[12.5px] text-ink leading-[1.5]">{firstName}, this removes you from the network. You stop being shown immediately; your profile and screening are deleted within 30 days. This can&apos;t be undone once it&apos;s carried out.</div>
            <input type="text" name="reason" placeholder="Reason (optional)" className="w-full h-9 rounded-[10px] border border-line bg-surface px-3 text-[12.5px] outline-none focus:border-navy-400" />
            <label className="block text-[11.5px] text-ink-muted">Type <b className="text-risk">DELETE</b> to confirm</label>
            <input type="text" name="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full h-9 rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-mono outline-none focus:border-risk" autoComplete="off" />
            <div className="flex items-center gap-2">
              <SubmitButton size="sm" variant="danger" disabled={confirm !== "DELETE"} pendingText="…">Request deletion</SubmitButton>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setConfirm(""); }}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** Granular consent toggles — each one the person can switch on or off, effective immediately. */
export function ConsentToggles({ privacy, update, asPersonId }: { privacy: Privacy; update: (fd: FormData) => void; asPersonId?: string }) {
  return (
    <form action={update} className="space-y-1.5">
      {asPersonId ? <input type="hidden" name="asPersonId" value={asPersonId} /> : null}
      {CONSENTS.filter((c) => !c.required).map((c) => (
        <label key={c.key} className="flex items-start gap-2.5 px-3 py-2 rounded-[11px] border border-line hover:border-line-strong cursor-pointer">
          <input type="checkbox" name={c.key} defaultChecked={privacy.consents[c.key]} className="mt-0.5 h-3.5 w-3.5 rounded border-line-strong accent-navy flex-none" />
          <span className="min-w-0"><span className="block text-[12.5px] text-ink font-medium">{c.label}</span><span className="block text-[11px] text-ink-faint leading-[1.45]">{c.detail}</span></span>
        </label>
      ))}
      <div className="flex items-center justify-between gap-2 pt-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-faint"><ShieldCheck className="h-3.5 w-3.5 text-teal" /> Effective immediately</span>
        <SubmitButton size="sm" variant="secondary" pendingText="…">Save permissions</SubmitButton>
      </div>
    </form>
  );
}
