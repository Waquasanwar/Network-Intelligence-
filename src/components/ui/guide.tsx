"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, PenLine } from "lucide-react";
import { AgentMark } from "./agent-mark";
import { SubmitButton } from "./submit-button";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export type GuideOption = { value: string; label: string; hint?: string };
export type GuideStep = {
  /** The field this answer is sent as. */
  name: string;
  /** The question. {field} is replaced with an earlier answer, e.g. "How do you know {name}?". */
  ask: string;
  hint?: string;
  kind: "choice" | "text" | "long" | "confirm";
  options?: GuideOption[];
  /** Quick answers offered under a typed question. */
  picks?: string[];
  placeholder?: string;
  optional?: boolean;
  min?: number;
  max?: number;
  /** confirm: the words on the yes button, and the value sent when they say yes. */
  yes?: string;
  value?: string;
  /** Ask only when an earlier answer is one of these. */
  when?: { name: string; in: string[] };
  /** How the answer reads in the summary, when it is not the answer itself. */
  short?: string;
  /** What we already know, offered as the starting answer. */
  initial?: string;
};

/**
 * One question at a time, in a single card, with the agent asking. Choices are tapped and move on by
 * themselves; typed answers move on with Enter. What you have said so far stays in a line above the
 * question, and any of it can be changed. Nothing is sent until you have seen it all together.
 * Underneath it is an ordinary form posting to a server action (or a GET to a page), so the server
 * checks everything as before and it still works if the page is slow to wake up.
 */
export function Guide({ intro, steps, action, href, hidden = {}, compose, submit, pending = "Sending…", review = "Here is what I will send", extra, onFinish, busy, error, className }: {
  intro: string;
  steps: GuideStep[];
  action?: (formData: FormData) => void | Promise<void>;
  /** Send with a GET to this page instead of a server action. */
  href?: string;
  hidden?: Record<string, string>;
  /** Join several answers into one field, e.g. a requirement in plain words. */
  compose?: { name: string; parts: string[] };
  submit: string;
  pending?: string;
  review?: string;
  /** Anything else the final form must carry, such as a field only scripts fill in. */
  extra?: React.ReactNode;
  /** Finish in the browser instead of posting a form, e.g. to show a link once it is made. */
  onFinish?: (fields: Record<string, string>) => void;
  busy?: boolean;
  error?: string | null;
  className?: string;
}) {
  const [a, setA] = useState<Record<string, string>>({});
  const [at, setAt] = useState(0);
  const [draft, setDraft] = useState("");
  const [warn, setWarn] = useState("");
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const live = useMemo(() => steps.filter((s) => !s.when || s.when.in.includes(a[s.when.name] ?? "")), [steps, a]);
  const done = at >= live.length;
  const step = live[Math.min(at, live.length - 1)];
  const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_, k) => (a[k] ?? "").split(" ")[0] || "them");
  const label = (s: GuideStep, v: string) => s.options?.find((o) => o.value === v)?.label ?? (s.kind === "confirm" ? (v ? "Yes" : "No") : v);

  useEffect(() => { if (!done) { setDraft(a[step.name] ?? step.initial ?? ""); setWarn(""); } }, [at, done]); // eslint-disable-line react-hooks/exhaustive-deps
  // Follow the conversation once it has started, but never pull the page down to it on arrival.
  const started = useRef(false);
  useEffect(() => { if (started.current) input.current?.focus({ preventScroll: false }); started.current = true; }, [at]);

  const answer = (v: string) => {
    const t = v.trim();
    if (!t && !step.optional) { setWarn("A word or two is enough."); return; }
    if (t && step.min && t.length < step.min) { setWarn(step.kind === "long" ? "A little more, please. Specifics help." : "A little more, please."); return; }
    setA((x) => ({ ...x, [step.name]: t }));
    setAt((n) => n + 1);
  };
  const pick = (v: string) => { setA((x) => ({ ...x, [step.name]: v })); setAt((n) => n + 1); };
  const back = () => setAt((n) => Math.max(0, n - 1));
  const answered = live.slice(0, at).filter((s) => a[s.name]);
  const fields = { ...hidden, ...Object.fromEntries(live.map((s) => [s.name, a[s.name] ?? ""])) };
  if (compose) fields[compose.name] = compose.parts.map((k) => (live.some((x) => x.name === k) ? a[k] ?? "" : "")).filter(Boolean).join(", "); // values, written to be read

  return (
    <div className={cn("guide", className)} data-guide>
      <div className="guide-head">
        <span className="guide-orb" aria-hidden="true"><AgentMark size={15} busy={!done} /></span>
        <span className="min-w-0 flex-1 text-[13px] text-ink-muted">{intro}</span>
        <span className="flex-none text-[12px] tabular text-ink-faint" aria-hidden="true">{done ? "Ready" : `${at + 1} of ${live.length}`}</span>
      </div>
      <div className="guide-bar" aria-hidden="true"><span style={{ width: `${(Math.min(at, live.length) / live.length) * 100}%` }} /></div>

      {answered.length && !done ? (
        <ul className="guide-trail" aria-label="Your answers so far">
          {answered.map((s) => <li key={s.name}><button type="button" onClick={() => setAt(live.indexOf(s))} title="Change this">{label(s, a[s.name]).slice(0, 48)}</button></li>)}
        </ul>
      ) : null}

      {!done ? (
        <div key={step.name + at} className="guide-q" role="group" aria-labelledby={`gq-${step.name}`}>
          <h3 id={`gq-${step.name}`} className="guide-ask" aria-live="polite">{fill(step.ask)}</h3>
          {step.hint ? <p className="mt-1.5 text-[13.5px] leading-[1.5] text-ink-muted">{fill(step.hint)}</p> : null}

          {step.kind === "choice" ? (
            <div className={cn("mt-4 grid gap-2", (step.options?.length ?? 0) > 3 ? "sm:grid-cols-2" : "")} data-guide-options>
              {step.options!.map((o) => (
                <button key={o.value} type="button" onClick={() => pick(o.value)} className="guide-option" aria-pressed={a[step.name] === o.value}>
                  <span className="min-w-0"><b className="block text-[14.5px] font-semibold text-ink">{o.label}</b>{o.hint ? <span className="mt-0.5 block text-[12.5px] text-ink-muted">{o.hint}</span> : null}</span>
                  <ArrowRight className="h-4 w-4 flex-none opacity-40" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : step.kind === "confirm" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="guide-yes" onClick={() => pick(step.value ?? "on")}><Check className="h-4 w-4" aria-hidden="true" />{step.yes ?? "Yes"}</button>
              {step.optional ? <button type="button" className="guide-skip" onClick={() => pick("")}>No</button> : null}
            </div>
          ) : (
            <form className="mt-4" onSubmit={(e) => { e.preventDefault(); answer(draft); }}>
              <div className="composer flex items-end gap-2 p-2 pl-4">
                {step.kind === "long"
                  ? <textarea ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); answer(draft); } }} rows={3} maxLength={step.max} placeholder={step.placeholder} aria-labelledby={`gq-${step.name}`} className="min-h-[76px] flex-1 resize-none py-2 text-[15px]" />
                  : <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={step.max} placeholder={step.placeholder} aria-labelledby={`gq-${step.name}`} className="h-10 flex-1 text-[15px]" />}
                <button type="submit" className="send-btn" aria-label="Next"><ArrowRight className="h-4 w-4" /></button>
              </div>
              {step.picks?.length ? <div className="mt-3 flex flex-wrap gap-2">{step.picks.map((p) => <button key={p} type="button" className="chip" onClick={() => answer(p)}>{p}</button>)}</div> : null}
              {step.kind === "long" ? <p className="mt-2 text-[12px] text-ink-faint">Press ⌘ Enter or the arrow when you are done.</p> : null}
            </form>
          )}
          {warn ? <p role="alert" className="mt-2 text-[12.5px] font-medium text-amber">{warn}</p> : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            {at > 0 ? <button type="button" onClick={back} className="guide-skip"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Back</button> : <span />}
            {step.optional && step.kind !== "confirm" ? <button type="button" onClick={() => pick("")} className="guide-skip">Skip</button> : null}
          </div>
        </div>
      ) : (
        <div className="guide-q">
          <h3 className="guide-ask">{review}</h3>
          <dl className="mt-4 divide-y divide-line rounded-[14px] border border-line" data-guide-review>
            {live.filter((s) => a[s.name]).map((s) => (
              <div key={s.name} className="flex items-start gap-3 px-4 py-2.5">
                <dt className="w-[34%] flex-none text-[12.5px] text-ink-faint">{s.short ?? fill(s.ask)}</dt>
                <dd className="min-w-0 flex-1 whitespace-pre-line text-[13.5px] text-ink">{label(s, a[s.name])}</dd>
                <button type="button" onClick={() => setAt(live.indexOf(s))} className="flex-none text-ink-faint hover:text-ink" aria-label={`Change: ${s.short ?? fill(s.ask)}`}><PenLine className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </dl>
          {error ? <p role="alert" className="mt-3 text-[12.5px] font-medium text-risk">{error}</p> : null}
          <form action={onFinish ? undefined : action ?? href} method={href ? "get" : undefined} onSubmit={onFinish ? (e) => { e.preventDefault(); onFinish(fields); } : undefined} className="mt-5 flex items-center justify-between gap-3">
            {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            {extra}
            <button type="button" onClick={back} className="guide-skip"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Back</button>
            {onFinish ? <Button type="submit" disabled={busy}>{busy ? pending : submit}</Button> : <SubmitButton pendingText={pending}>{submit}</SubmitButton>}
          </form>
        </div>
      )}
    </div>
  );
}
