"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check } from "lucide-react";
import { AgentMark } from "@/components/ui/agent-mark";

type Mode = "need" | "join";

const EXAMPLES: Record<Mode, string[]> = {
  need: [
    "An interim CFO for an energy company in Dubai, six months",
    "A cyber security lead in Riyadh, two days a week",
    "A programme director to recover a core banking migration",
  ],
  join: [
    "Interim programme director, core banking and payments",
    "Fractional CFO for founder-led businesses in the Gulf",
    "Operating model and change lead, public sector",
  ],
};

const PLAN: Record<Mode, string[]> = {
  need: ["A person reads your need, usually the same day", "We check who we know first hand who fits", "You see who fits by their proofs, names hidden until they say yes"],
  join: ["A person reads your application", "If it fits, you get a personal invitation", "A short screening in your own time, then you are in"],
};

/**
 * The front door, as a question. A visitor says in their own words who they need (or, as a
 * consultant, what they do). Nothing is sent from here: the plan shows what happens next, and the
 * words go into the form below so they only add their name and email.
 */
export function NeedComposer() {
  const [mode, setMode] = useState<Mode>("need");
  const [value, setValue] = useState("");
  const [hint, setHint] = useState(0);
  const [step, setStep] = useState(-1);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (value) return;
    const t = setInterval(() => setHint((h) => (h + 1) % EXAMPLES[mode].length), 3200);
    return () => clearInterval(t);
  }, [value, mode]);

  const grow = (el: HTMLTextAreaElement) => { el.style.height = "0px"; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; };

  async function go(text: string) {
    const words = text.trim();
    if (!words) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (let i = 0; i <= PLAN[mode].length; i++) { setStep(i); if (!calm) await new Promise((r) => setTimeout(r, 420)); }
    const form = document.querySelector<HTMLElement>(mode === "need" ? "#need" : "#join");
    const field = form?.querySelector<HTMLTextAreaElement>('textarea[name="message"]');
    const line = mode === "join" ? form?.querySelector<HTMLInputElement>('input[name="headline"]') : null;
    // A consultant's short line is their headline; anything longer is the work they describe.
    if (line && !line.value && words.length <= 140) line.value = words;
    else if (field && !field.value) field.value = words;
    form?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    setTimeout(() => form?.querySelector<HTMLInputElement>('input[name="name"]')?.focus({ preventScroll: true }), calm ? 0 : 500);
  }

  const switchTo = (m: Mode) => { setMode(m); setStep(-1); setHint(0); ref.current?.focus(); };

  return (
    <div className="mx-auto mt-10 w-full max-w-[680px] text-left">
      <form onSubmit={(e) => { e.preventDefault(); go(value); }} className="composer p-2.5">
        <label htmlFor="front-ask" className="sr-only">{mode === "need" ? "Who do you need?" : "What do you do?"}</label>
        <div className="flex items-start gap-3 px-2.5 pt-2">
          <span className="mt-[3px]"><AgentMark size={18} busy={step >= 0 && step < PLAN[mode].length} /></span>
          <textarea
            ref={ref} id="front-ask" rows={1} value={value}
            onChange={(e) => { setValue(e.target.value); grow(e.target); setStep(-1); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(value); } }}
            placeholder={EXAMPLES[mode][hint]}
            className="min-h-[52px] w-full resize-none text-[16px] leading-[1.55] text-ink placeholder:text-ink-faint"
          />
        </div>
        <div className="flex items-center justify-between gap-2 pt-1.5">
          <div className="flex gap-1.5" role="group" aria-label="I am">
            <button type="button" className="chip" aria-pressed={mode === "need"} onClick={() => switchTo("need")}>I&apos;m hiring</button>
            <button type="button" className="chip" aria-pressed={mode === "join"} onClick={() => switchTo("join")}>I&apos;m a consultant</button>
          </div>
          <button type="submit" className="send-btn" disabled={!value.trim()} aria-label={mode === "need" ? "Continue with this need" : "Continue with my application"}><ArrowUp className="h-4 w-4" strokeWidth={2.2} /></button>
        </div>
      </form>

      {step >= 0 ? (
        <ol className="mt-5 space-y-2.5 px-3" aria-live="polite" aria-label="What happens next">
          {PLAN[mode].map((label, i) => {
            const state = i < step ? "done" : i === step ? "running" : "pending";
            return <li key={label} className="plan-step rise-in" data-state={state} style={{ animationDelay: `${i * 60}ms` }}><span className="plan-tick">{state === "done" ? <Check className="h-2.5 w-2.5" strokeWidth={3.2} /> : null}</span>{label}</li>;
          })}
        </ol>
      ) : null}
    </div>
  );
}
