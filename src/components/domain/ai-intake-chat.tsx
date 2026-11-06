"use client";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Chip } from "@/components/ui/badge";
import { structureIntake } from "@/server/actions/enrich";
import { AVAILABILITY_LABELS, ROUTE_LABELS } from "@/lib/labels";
import { Sparkles, Send, CheckCircle2 } from "lucide-react";
import type { ExtractedSummary } from "@/lib/ai";
import type { AvailabilityStatus, EngagementRoute } from "@prisma/client";

const SCRIPT = [
  "Hi — I'll ask a few quick questions and turn your answers into a structured profile you can check. To start: who are you, and what are you best known for?",
  "Great. What kind of work do you do best — the problems people bring you in to solve?",
  "Where are you based, and are you open to working elsewhere?",
  "How do you prefer to engage — permanent, contract, interim, fractional, or advisory?",
  "What are you looking for right now, if anything?",
  "Last one — anything we should know? Constraints, notice period, or work you'd rather avoid.",
];

type Msg = { role: "ai" | "you"; text: string };

export function AiIntakeChat() {
  const [log, setLog] = useState<Msg[]>([{ role: "ai", text: SCRIPT[0] }]);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState<ExtractedSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);

  const answers = log.filter((m) => m.role === "you").length;

  function send() {
    if (!input.trim()) return;
    const next: Msg[] = [...log, { role: "you", text: input.trim() }];
    const n = step + 1;
    if (n < SCRIPT.length) next.push({ role: "ai", text: SCRIPT[n] });
    else next.push({ role: "ai", text: "Thank you — that's plenty to work with. Press Summarise whenever you're ready." });
    setLog(next);
    setStep(n);
    setInput("");
    setTimeout(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }), 30);
  }

  function finish() {
    setError(null);
    // Structure only the person's own answers — the interviewer's questions would pollute the extraction.
    const transcript = log.filter((m) => m.role === "you").map((m) => m.text).join("\n");
    start(async () => {
      const r = await structureIntake({ transcript });
      if (!r.ok) { setError(r.error); return; }
      setSummary(r.summary);
    });
  }

  if (summary) {
    const Section = ({ title, items }: { title: string; items: string[] }) => items.length ? (
      <div><div className="text-[11px] uppercase tracking-[0.05em] text-ink-faint mb-1.5">{title}</div><div className="flex flex-wrap gap-1.5">{items.map((x, i) => <Chip key={i}>{x}</Chip>)}</div></div>
    ) : null;
    return (
      <div className="space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full bg-teal/10 text-teal text-[12.5px] font-medium px-3 py-1"><CheckCircle2 className="h-4 w-4" /> Structured from your conversation — a human reviews before anything goes live.</div>
        {summary.headline ? <div><div className="text-[11px] uppercase tracking-[0.05em] text-ink-faint mb-1">Headline</div><p className="text-[14px] text-ink">{summary.headline}</p></div> : null}
        {summary.summary ? <p className="text-[13px] text-ink-muted leading-6">{summary.summary}</p> : null}
        <div className="grid sm:grid-cols-2 gap-5">
          <Section title="Capabilities" items={summary.capabilities} />
          <Section title="Sectors" items={summary.sectors} />
          <Section title="Engagement" items={summary.engagementPreferences.map((r) => ROUTE_LABELS[r as EngagementRoute] ?? r)} />
          <Section title="Locations" items={summary.locationPreferences} />
          <Section title="Strengths" items={summary.strengths} />
          <Section title="Constraints" items={summary.constraints} />
        </div>
        {summary.suggestedAvailabilityStatus ? <div><div className="text-[11px] uppercase tracking-[0.05em] text-ink-faint mb-1">Availability</div><Chip>{AVAILABILITY_LABELS[summary.suggestedAvailabilityStatus as AvailabilityStatus] ?? summary.suggestedAvailabilityStatus}</Chip></div> : null}
        {summary.unresolvedQuestions.length ? (
          <div className="rounded-[12px] border border-amber/25 bg-amber-50 px-3.5 py-3">
            <div className="text-[11px] uppercase tracking-[0.05em] text-amber mb-1">Still to confirm</div>
            <ul className="text-[12.5px] text-ink space-y-0.5 list-disc pl-4">{summary.unresolvedQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </div>
        ) : null}
        <Button variant="secondary" type="button" onClick={() => { setSummary(null); }}>Back to the conversation</Button>
      </div>
    );
  }

  return (
    <div className="ai-surface rounded-[16px] bg-surface">
      <div ref={scroller} className="max-h-[440px] overflow-y-auto p-5 space-y-3">
        {log.map((m, i) => (
          <div key={i} className={m.role === "ai" ? "flex gap-2.5 items-start" : "flex justify-end"}>
            {m.role === "ai" ? <span className="mt-0.5 h-6 w-6 rounded-full bg-navy text-white grid place-items-center flex-none"><Sparkles className="h-3.5 w-3.5" /></span> : null}
            <div className={m.role === "ai" ? "max-w-[82%] rounded-[14px] rounded-tl-sm bg-surface-muted px-3.5 py-2.5 text-[13px] text-ink leading-5" : "max-w-[82%] rounded-[14px] rounded-tr-sm bg-navy text-white px-3.5 py-2.5 text-[13px] leading-5"}>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-3">
        {error ? <div className="text-[12px] text-risk mb-2 px-1">{error}</div> : null}
        <div className="flex items-end gap-2">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} className="min-h-[44px]" placeholder="Type your answer… (Enter to send)" />
          <Button type="button" onClick={send} disabled={!input.trim()} className="flex-none"><Send className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[11px] text-ink-faint">{answers} answer{answers === 1 ? "" : "s"} so far</span>
          <Button variant="secondary" size="sm" type="button" onClick={finish} disabled={pending || answers < 2}><Sparkles className="h-3.5 w-3.5" /> {pending ? "Summarising…" : "Summarise"}</Button>
        </div>
      </div>
    </div>
  );
}
