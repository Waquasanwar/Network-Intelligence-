"use client";
import { useState, useTransition } from "react";
import { Input, Select, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { registerMember } from "@/server/actions/members";
import { enrichSelfDraft } from "@/server/actions/enrich";
import { fullName } from "@/lib/utils";
import { Sparkles, Check } from "lucide-react";

type Member = { id: string; firstName: string; lastName: string };

export function JoinForm({ members, referrer, tenantInvite = false, inviteToken, error }: { members: Member[]; referrer: Member | null; tenantInvite?: boolean; inviteToken?: string; error: string | null }) {
  const [fields, setFields] = useState({ firstName: "", lastName: "", headline: "", linkedinUrl: "" });
  const [source, setSource] = useState("");
  const [autofilled, setAutofilled] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));

  function autofill() {
    setAiError(null);
    const isUrl = /linkedin\.com/i.test(source);
    start(async () => {
      const res = await enrichSelfDraft(isUrl ? { linkedinUrl: source } : { text: source });
      if (!res.ok) { setAiError(res.error); return; }
      const d = res.draft;
      setFields((f) => ({ firstName: d.firstName || f.firstName, lastName: d.lastName || f.lastName, headline: d.headline || f.headline, linkedinUrl: isUrl ? source : f.linkedinUrl }));
      setAutofilled(true);
    });
  }

  return (
    <div className="mt-8 rounded-[12px] border border-line bg-surface shadow-[var(--shadow-card)] p-6 sm:p-7">
      {(referrer || tenantInvite) ? (
        <div className="flex justify-center mb-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 text-teal text-[12px] font-medium px-3 py-1"><Check className="h-3.5 w-3.5" /> {referrer ? `Invited by ${fullName(referrer)}` : "You've been invited to join"}</span>
        </div>
      ) : null}
      {error ? <div className="mb-4 rounded-[10px] border border-amber/30 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-ink">{error}</div> : null}

      <div className="rounded-[10px] border border-line bg-surface-muted/40 p-3.5 mb-5">
        <label className="text-[12px] font-medium text-ink inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-navy" /> Save typing — paste your LinkedIn</label>
        <div className="flex gap-2 mt-2">
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="linkedin.com/in/…  or a one-line bio" />
          <Button type="button" variant="secondary" onClick={autofill} disabled={pending || source.trim().length < 3} className="flex-none">{pending ? "…" : "Autofill"}</Button>
        </div>
        {aiError ? <div className="text-[11.5px] text-risk mt-1.5">{aiError}</div> : null}
        {autofilled && !aiError ? <div className="text-[11.5px] text-teal mt-1.5 inline-flex items-center gap-1"><Check className="h-3 w-3" /> Filled in — check it below.</div> : null}
      </div>

      <form action={registerMember} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required><Input name="firstName" value={fields.firstName} onChange={set("firstName")} required autoComplete="given-name" /></Field>
          <Field label="Last name" required><Input name="lastName" value={fields.lastName} onChange={set("lastName")} required autoComplete="family-name" /></Field>
        </div>
        <Field label="Email" required><Input name="email" type="email" required autoComplete="email" /></Field>
        <Field label="Password" required hint="At least 8 characters — this is your login."><Input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>

        <input type="hidden" name="headline" value={fields.headline} />
        <input type="hidden" name="linkedinUrl" value={fields.linkedinUrl} />
        {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
        {referrer ? (
          <input type="hidden" name="referrerId" value={referrer.id} />
        ) : tenantInvite ? null : (
          <Field label="Who invited you?" required hint="Only members can invite. If you were not invited, ask the person who told you about us."><Select name="referrerId" defaultValue="" required><option value="">— choose —</option>{members.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}</Select></Field>
        )}

        <label className="flex items-start gap-2.5 text-[12px] text-ink-muted leading-[1.5] pt-1 cursor-pointer">
          <input type="checkbox" name="consent" required className="mt-0.5 h-3.5 w-3.5 rounded border-line-strong accent-navy flex-none" />
          <span>I agree to Network Intelligence holding my details to put me forward for work that suits me — fractional, contract or permanent. My profile stays anonymous to clients until I say yes to a specific introduction, and I can see, export or delete my data at any time.</span>
        </label>
        <SubmitButton className="w-full" size="lg" pendingText="Creating your account…">Create account &amp; start screening</SubmitButton>
        <p className="text-[11px] text-ink-faint text-center leading-[1.5]">Held under UK GDPR and the UAE PDPL · Delete your data in one click from your profile, any time.</p>
      </form>
    </div>
  );
}
