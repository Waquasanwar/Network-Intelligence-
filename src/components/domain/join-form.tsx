"use client";
import { useState, useTransition } from "react";
import { Input, Select, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { registerMember } from "@/server/actions/members";
import { enrichSelfDraft } from "@/server/actions/enrich";
import { fullName } from "@/lib/utils";
import { Sparkles, Wand2, Check } from "lucide-react";

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
      setFields((f) => ({
        firstName: d.firstName || f.firstName,
        lastName: d.lastName || f.lastName,
        headline: d.headline || f.headline,
        linkedinUrl: isUrl ? source : f.linkedinUrl,
      }));
      setAutofilled(true);
    });
  }

  return (
    <div className="rounded-[20px] border border-line bg-surface shadow-[var(--shadow-card)] p-7">
      <h2 className="text-[18px] font-semibold">Register</h2>
      <p className="text-[12.5px] text-ink-muted mt-0.5">Takes a minute. Your screening comes next.</p>
      {referrer ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal/10 text-teal text-[12px] font-medium px-2.5 py-1"><Check className="h-3.5 w-3.5" /> Invited by {fullName(referrer)}</div>
      ) : tenantInvite ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal/10 text-teal text-[12px] font-medium px-2.5 py-1"><Check className="h-3.5 w-3.5" /> You&apos;ve been invited to join the network</div>
      ) : null}
      {error ? <div className="mt-3 rounded-[12px] border border-amber/30 bg-amber-100 px-3 py-2 text-[12.5px]">{error}</div> : null}

      <div className="ai-surface mt-4 rounded-[14px] bg-navy-50 p-3.5">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-navy"><Sparkles className="h-3.5 w-3.5" /> Save typing</div>
        <p className="text-[12px] text-ink-muted mt-0.5">Paste your LinkedIn link or a one-line bio and we&apos;ll fill the basics in. You can edit everything.</p>
        <div className="flex gap-2 mt-2">
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://linkedin.com/in/…  or  your one-line bio" />
          <Button type="button" onClick={autofill} disabled={pending || source.trim().length < 3} className="flex-none"><Wand2 className="h-3.5 w-3.5" /> {pending ? "…" : "Autofill"}</Button>
        </div>
        {aiError ? <div className="text-[11.5px] text-risk mt-1.5">{aiError}</div> : null}
        {autofilled && !aiError ? <div className="text-[11.5px] text-teal mt-1.5 inline-flex items-center gap-1"><Check className="h-3 w-3" /> Filled in — check it over below.</div> : null}
      </div>

      <form action={registerMember} className="mt-4 space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required><Input name="firstName" value={fields.firstName} onChange={set("firstName")} required /></Field>
          <Field label="Last name" required><Input name="lastName" value={fields.lastName} onChange={set("lastName")} required /></Field>
        </div>
        <Field label="Email" required><Input name="email" type="email" required /></Field>
        <Field label="Password" required hint="At least 8 characters. This is your login."><Input name="password" type="password" required minLength={8} /></Field>
        <Field label="What you are known for"><Input name="headline" value={fields.headline} onChange={set("headline")} placeholder="One line" /></Field>
        <Field label="LinkedIn profile" hint="Optional. We can import recommendations from here."><Input name="linkedinUrl" value={fields.linkedinUrl} onChange={set("linkedinUrl")} placeholder="https://linkedin.com/in/…" /></Field>
        {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
        {referrer ? (
          <input type="hidden" name="referrerId" value={referrer.id} />
        ) : tenantInvite ? null : (
          <Field label="Who invited you?" required hint="Only members can invite. If you were not invited, ask the person who told you about us."><Select name="referrerId" defaultValue="" required><option value="">— choose —</option>{members.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}</Select></Field>
        )}
        <Checkbox name="consent" label="I understand my profile is anonymous to clients until I consent to an introduction" defaultChecked />
        <SubmitButton className="w-full" pendingText="Registering…">Register and start screening</SubmitButton>
      </form>
    </div>
  );
}
