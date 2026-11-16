"use client";
import { useState, useTransition } from "react";
import { Input, Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { registerMember } from "@/server/actions/invites";
import { enrichSelfDraft } from "@/server/actions/enrich";
import { PASSWORD_MIN } from "@/lib/password";
import { Sparkles, Check } from "lucide-react";

export function JoinForm({ inviteToken, invitedBy, network, prefill, claiming, error }: { inviteToken: string; invitedBy: string | null; network: string; prefill: { firstName: string; lastName: string; email: string }; claiming: boolean; error: string | null }) {
  const [fields, setFields] = useState({ firstName: prefill.firstName, lastName: prefill.lastName, headline: "", linkedinUrl: "" });
  const [source, setSource] = useState("");
  const [autofilled, setAutofilled] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));

  function autofill() {
    setAiError(null);
    const isUrl = /linkedin\.com/i.test(source);
    start(async () => {
      const res = await enrichSelfDraft(isUrl ? { linkedinUrl: source, inviteToken } : { text: source, inviteToken });
      if (!res.ok) { setAiError(res.error); return; }
      const d = res.draft;
      setFields((f) => ({ firstName: d.firstName || f.firstName, lastName: d.lastName || f.lastName, headline: d.headline || f.headline, linkedinUrl: isUrl ? source : f.linkedinUrl }));
      setAutofilled(true);
    });
  }

  return (
    <div className="mt-8 widget p-6 sm:p-7">
      <div className="flex justify-center mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 text-teal text-[12.5px] font-semibold px-3 py-1.5"><Check className="h-3.5 w-3.5" /> {invitedBy ? `Invited by ${invitedBy}` : `You've been invited to join ${network}`}</span>
      </div>
      {error ? <div role="alert" className="mb-4 rounded-[12px] border border-amber/30 bg-amber-50 px-3.5 py-2.5 text-[13px] text-ink">{error}</div> : null}
      {claiming ? <p className="mb-4 text-[13px] text-ink-muted leading-[1.5]">We already know you a little. Creating your account puts you in charge of your profile: what we hold, who sees it, and when you are free.</p> : null}

      <div className="rounded-[12px] bg-surface-muted p-4 mb-5">
        <label htmlFor="join-source" className="text-[12.5px] font-semibold text-ink inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-navy" /> Save typing: paste your LinkedIn</label>
        <div className="flex gap-2 mt-2">
          <Input id="join-source" value={source} onChange={(e) => setSource(e.target.value)} maxLength={1500} placeholder="linkedin.com/in/…  or a one-line bio" />
          <Button type="button" variant="secondary" onClick={autofill} disabled={pending || source.trim().length < 3} className="flex-none">{pending ? "Reading…" : "Autofill"}</Button>
        </div>
        {aiError ? <div role="alert" className="text-[12.5px] text-risk mt-1.5">{aiError}</div> : null}
        {autofilled && !aiError ? <div className="text-[12.5px] text-teal mt-1.5 inline-flex items-center gap-1"><Check className="h-3 w-3" /> Filled in. Check it below.</div> : null}
      </div>

      <form action={registerMember} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required><Input name="firstName" value={fields.firstName} onChange={set("firstName")} required maxLength={60} autoComplete="given-name" /></Field>
          <Field label="Last name" required><Input name="lastName" value={fields.lastName} onChange={set("lastName")} required maxLength={60} autoComplete="family-name" /></Field>
        </div>
        <Field label="Email" required><Input name="email" type="email" required maxLength={200} defaultValue={prefill.email} autoComplete="email" /></Field>
        <Field label="Password" required hint={`At least ${PASSWORD_MIN} characters. A short phrase works well.`}><Input name="password" type="password" required minLength={PASSWORD_MIN} maxLength={200} autoComplete="new-password" /></Field>

        <input type="hidden" name="headline" value={fields.headline} />
        <input type="hidden" name="linkedinUrl" value={fields.linkedinUrl} />
        <input type="hidden" name="inviteToken" value={inviteToken} />

        <label className="flex items-start gap-2.5 text-[12.5px] text-ink-muted leading-[1.5] pt-1 cursor-pointer">
          <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 rounded border-line-strong accent-navy flex-none" />
          <span>I agree to {network} holding my details to put me forward for work that suits me: fractional, contract or permanent. My profile stays anonymous to clients until I say yes to a specific introduction, and I can see, export or delete my data at any time.</span>
        </label>
        <SubmitButton className="w-full" size="lg" pendingText="Creating your account…">Create account and start screening</SubmitButton>
        <p className="text-[12px] text-ink-faint text-center leading-[1.5]">Held under UK GDPR and the UAE PDPL. Delete your data from your profile, any time.</p>
      </form>
    </div>
  );
}
