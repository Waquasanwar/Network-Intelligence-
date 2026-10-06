"use client";
import { useState, useTransition } from "react";
import Image from "next/image";
import { beginMfaSetup, confirmMfaSetup, disableMfa } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/form";

export function MfaCard({ enabled: initial }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const begin = () => { setErr(null); start(async () => { const r = await beginMfaSetup(); setSetup({ qr: r.qr, secret: r.secret }); }); };
  const confirm = () => { setErr(null); start(async () => { const r = await confirmMfaSetup(code); if (!r.ok) return setErr(r.error ?? "Try again."); setSetup(null); setCode(""); setEnabled(true); setRecovery(r.recoveryCodes ?? []); }); };
  const turnOff = () => { setErr(null); start(async () => { const r = await disableMfa(code); if (!r.ok) return setErr(r.error ?? "Try again."); setEnabled(false); setCode(""); setSetup(null); setRecovery(null); }); };

  if (recovery) {
    return (
      <div className="space-y-3">
        <div className="text-[13px] font-medium text-teal">Multi-factor authentication is on.</div>
        <div className="text-[12px] text-ink-muted">Save these recovery codes somewhere safe. Each works once if you lose your authenticator — they won&apos;t be shown again.</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-line bg-surface-muted p-3 font-mono text-[12px] tabular">
          {recovery.map((c) => <span key={c}>{c}</span>)}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setRecovery(null)}>Done</Button>
      </div>
    );
  }

  if (setup) {
    return (
      <div className="space-y-3">
        <div className="text-[12px] text-ink-muted">Scan this with an authenticator app (Google Authenticator, 1Password, Authy), then enter the 6-digit code it shows.</div>
        <Image src={setup.qr} alt="MFA setup QR code" width={160} height={160} unoptimized className="rounded-lg border border-line" />
        <div className="text-[11px] text-ink-faint">Or enter this key by hand: <span className="font-mono text-ink break-all">{setup.secret}</span></div>
        <Field label="6-digit code"><Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123 456" className="h-9" /></Field>
        {err ? <div className="text-[12px] text-risk">{err}</div> : null}
        <div className="flex gap-2">
          <Button size="sm" onClick={confirm} disabled={pending}>Turn on MFA</Button>
          <Button size="sm" variant="ghost" onClick={() => { setSetup(null); setCode(""); setErr(null); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="space-y-3">
        <div className="text-[13px] font-medium text-teal flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-teal" />Multi-factor authentication is on.</div>
        <div className="text-[12px] text-ink-muted">You enter a code from your authenticator each time you sign in.</div>
        <Field label="Enter a current code to turn it off"><Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123 456" className="h-9" /></Field>
        {err ? <div className="text-[12px] text-risk">{err}</div> : null}
        <Button size="sm" variant="secondary" onClick={turnOff} disabled={pending}>Turn off MFA</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[12px] text-ink-muted">Add a second step at sign-in with an authenticator app. Strongly recommended for every account.</div>
      {err ? <div className="text-[12px] text-risk">{err}</div> : null}
      <Button size="sm" onClick={begin} disabled={pending}>Set up MFA</Button>
    </div>
  );
}
