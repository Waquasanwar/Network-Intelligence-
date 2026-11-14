"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Input, Select, Textarea, Field, Checkbox } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { addPerson } from "@/server/actions/people";
import { enrichProfileDraft } from "@/server/actions/enrich";
import { SOURCE_LABELS, RELATIONSHIP_LABELS } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import { Sparkles, Wand2, PencilLine } from "lucide-react";
import type { ProfileDraft } from "@/lib/ai";

type Fields = {
  firstName: string; lastName: string; headline: string; currentCompany: string; currentRole: string;
  primaryCity: string; primaryCountry: string; capabilities: string; email: string;
};
const EMPTY: Fields = { firstName: "", lastName: "", headline: "", currentCompany: "", currentRole: "", primaryCity: "", primaryCountry: "", capabilities: "", email: "" };

const CONFIDENCE: Record<ProfileDraft["confidence"], { label: string; cls: string }> = {
  high: { label: "High confidence", cls: "bg-teal/10 text-teal" },
  medium: { label: "Some signal", cls: "bg-navy-50 text-navy" },
  low: { label: "Low — check carefully", cls: "bg-amber/10 text-amber" },
};

export function AiAddPersonForm({ people }: { people: { id: string; firstName: string; lastName: string }[] }) {
  const [stage, setStage] = useState<"intake" | "review">("intake");
  const [source, setSource] = useState("");
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));

  function runDraft() {
    setError(null);
    const isUrl = /linkedin\.com/i.test(source);
    start(async () => {
      const res = await enrichProfileDraft(isUrl ? { linkedinUrl: source } : { text: source });
      if (!res.ok) { setError(res.error); return; }
      const d = res.draft;
      setDraft(d);
      setFields({
        firstName: d.firstName, lastName: d.lastName, headline: d.headline,
        currentCompany: d.currentCompany, currentRole: d.currentRole,
        primaryCity: d.primaryCity, primaryCountry: d.primaryCountry,
        capabilities: d.capabilities.join(", "), email: "",
      });
      setStage("review");
    });
  }

  if (stage === "intake") {
    return (
      <div className="space-y-4">
        <div className="ai-surface rounded-[10px] bg-[linear-gradient(135deg,var(--color-navy-50),color-mix(in_srgb,var(--color-surface)_55%,var(--color-navy-50)))] p-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-navy"><Sparkles className="h-4 w-4" /> Add with AI</div>
          <p className="text-[12.5px] text-ink-muted mt-1">Paste their LinkedIn URL, or a few lines about them. The assistant drafts the profile — you check it before saving.</p>
          <Textarea value={source} onChange={(e) => setSource(e.target.value)} rows={4} className="mt-3" placeholder="https://linkedin.com/in/…  — or —  Priya Natarajan, programme director at Majid Al Futtaim in Dubai, led two large transformations, open to advisory work." />
          {error ? <div className="mt-2 text-[12px] text-risk">{error}</div> : null}
          <div className="flex items-center gap-2 mt-3">
            <Button type="button" onClick={runDraft} disabled={pending || source.trim().length < 3}>
              <Wand2 className="h-3.5 w-3.5" /> {pending ? "Drafting…" : "Draft profile"}
            </Button>
            <button type="button" onClick={() => { setFields(EMPTY); setDraft(null); setStage("review"); }} className="text-[12.5px] text-ink-muted hover:text-ink inline-flex items-center gap-1">
              <PencilLine className="h-3.5 w-3.5" /> or fill in manually
            </button>
          </div>
        </div>
        <Link href="/network/intake" className="text-[12.5px] text-navy hover:underline inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> or interview them in a conversation →</Link>
      </div>
    );
  }

  return (
    <form action={addPerson} className="space-y-4">
      {draft ? (
        <div className="rounded-[10px] border border-line bg-surface-muted/60 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink"><Sparkles className="h-3.5 w-3.5 text-navy" /> AI draft — confirm before saving</span>
            <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${CONFIDENCE[draft.confidence].cls}`}>{CONFIDENCE[draft.confidence].label}</span>
          </div>
          {draft.unresolved.length ? <ul className="mt-2 space-y-0.5">{draft.unresolved.map((u, i) => <li key={i} className="text-[11.5px] text-amber flex gap-1.5"><span>•</span>{u}</li>)}</ul> : null}
          <button type="button" onClick={() => { setStage("intake"); }} className="text-[11.5px] text-navy hover:underline mt-2">← redraft from different text</button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" required><Input name="firstName" value={fields.firstName} onChange={set("firstName")} required autoFocus /></Field>
        <Field label="Last name" required><Input name="lastName" value={fields.lastName} onChange={set("lastName")} required /></Field>
      </div>
      <Field label="Headline" hint="One line on what they are known for"><Input name="headline" value={fields.headline} onChange={set("headline")} placeholder="e.g. Programme director who stabilises troubled transformations" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Current company"><Input name="currentCompany" value={fields.currentCompany} onChange={set("currentCompany")} /></Field>
        <Field label="Current role"><Input name="currentRole" value={fields.currentRole} onChange={set("currentRole")} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City"><Input name="primaryCity" value={fields.primaryCity} onChange={set("primaryCity")} placeholder="London" /></Field>
        <Field label="Country"><Input name="primaryCountry" value={fields.primaryCountry} onChange={set("primaryCountry")} placeholder="UK" /></Field>
      </div>
      <Field label="Expertise" hint="Comma separated. Refined later from conversations."><Input name="capabilities" value={fields.capabilities} onChange={set("capabilities")} placeholder="Transformation, PMO, cyber security" /></Field>
      <Field label="Email"><Input name="email" type="email" value={fields.email} onChange={set("email")} /></Field>

      <div className="border-t border-line pt-4">
        <div className="text-xs font-semibold text-ink mb-2">Relationship provenance</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source" required><Select name="sourceType" required defaultValue="PERSONAL_NETWORK">{Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="How you know them" required><Select name="relationshipType" required defaultValue="DIRECT">{Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <Field label="Introduced by" className="mt-3" hint="Pick a person already in the network">
          <Select name="introducedById" defaultValue="">
            <option value="">— nobody / direct —</option>
            {people.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </Select>
        </Field>
        <div className="mt-3"><Checkbox name="workedTogether" label="I have worked with them directly" /></div>
        <Field label="Private relationship notes" className="mt-3" hint="Never shown to partners or clients."><Textarea name="relationshipNotes" placeholder="Who knows them, what you have seen, anything to remember." /></Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <SubmitButton pendingText="Adding…">Add person</SubmitButton>
      </div>
    </form>
  );
}
