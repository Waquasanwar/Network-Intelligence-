"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { askNetwork, type AgentAnswer } from "@/server/actions/agent";
import { cn } from "@/lib/utils";

const STEPS = ["Reading your question", "Searching the network", "Ranking by trust"];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const initials = (name: string) => name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();

/**
 * The agent's front door. One line to ask the network a question in ordinary words; the agent shows
 * the steps it is taking, then answers in a sentence and backs it with the people it found — each
 * with the reasons they came back. The answer is built from records, so it can always be checked.
 */
export function AgentComposer({ suggestions }: { suggestions: string[] }) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<"idle" | "thinking" | "answer">("idle");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<AgentAnswer | null>(null);
  const [typed, setTyped] = useState("");
  const [hint, setHint] = useState(0);
  const run = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // The placeholder rotates through real questions while the box is empty and idle.
  useEffect(() => {
    if (phase !== "idle" || value || suggestions.length < 2) return;
    const t = setInterval(() => setHint((h) => (h + 1) % suggestions.length), 3600);
    return () => clearInterval(t);
  }, [phase, value, suggestions.length]);

  // The answer arrives as text being written, then the people appear.
  const answerText = result?.ok ? result.answer : "";
  useEffect(() => {
    if (phase !== "answer" || !answerText) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setTyped(answerText); return; }
    let i = 0;
    setTyped("");
    const t = setInterval(() => { i = Math.min(answerText.length, i + 3); setTyped(answerText.slice(0, i)); if (i >= answerText.length) clearInterval(t); }, 16);
    return () => clearInterval(t);
  }, [phase, answerText]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || phase === "thinking") return;
    const id = ++run.current;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setValue(q); setResult(null); setTyped(""); setStep(0); setPhase("thinking");
    const started = performance.now();
    const pending = askNetwork(q).catch((): AgentAnswer => ({ ok: false, error: "The agent could not reach the network just now. Try again." }));
    await wait(calm ? 0 : 420);
    if (run.current !== id) return;
    setStep(1);
    const res = await pending;
    const elapsed = performance.now() - started;
    if (!calm && elapsed < 1000) await wait(1000 - elapsed);
    if (run.current !== id) return;
    setStep(2);
    await wait(calm ? 0 : 380);
    if (run.current !== id) return;
    setStep(3); setResult(res); setPhase("answer");
  }

  function reset() { run.current++; setPhase("idle"); setResult(null); setValue(""); setTyped(""); inputRef.current?.focus(); }

  const done = phase === "answer" && result?.ok && typed.length >= result.answer.length;

  return (
    <div className="relative mt-5">
      <form onSubmit={(e) => { e.preventDefault(); ask(value); }} className="flex items-center gap-2.5 rounded-[6px] bg-white p-1.5 pl-4 text-[#0c1b33] transition-shadow duration-200 focus-within:shadow-[0_0_0_3px_var(--color-accent)]">
        <Sparkles className="h-[18px] w-[18px] flex-none text-[#0c1b33]" aria-hidden="true" />
        <input
          ref={inputRef} id="agent-ask" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Ask your network"
          placeholder={suggestions.length ? `Ask your network — “${suggestions[hint % suggestions.length]}”` : "Ask your network a question"}
          className="agent-input h-11 min-w-0 flex-1 text-[15.5px] text-[#0c1b33] placeholder:text-[#5b6576]" autoComplete="off"
        />
        <button type="submit" aria-label="Ask" disabled={!value.trim() || phase === "thinking"} className="group inline-flex h-11 flex-none items-center gap-1.5 rounded-[6px] bg-accent px-4 text-[14px] font-semibold text-[#0c1b33] transition-[filter] duration-200 hover:brightness-95 cursor-pointer disabled:cursor-default">
          Ask
          <span aria-hidden="true" className="arrow-badge inline-flex"><ArrowRight className="h-4 w-4" strokeWidth={2} /></span>
        </button>
      </form>

      {phase === "idle" && suggestions.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="label-caps text-stage-muted mr-1">Try</span>
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-stage-line px-3 py-1.5 text-[12.5px] text-stage-ink transition-colors duration-200 hover:border-white/60 hover:bg-white/[0.06] cursor-pointer">{s}</button>
          ))}
        </div>
      ) : null}

      {phase !== "idle" ? (
        <div className="rise-in mt-3 rounded-[8px] bg-surface p-5 sm:p-6 text-ink" aria-live="polite">
          {/* The plan: what the agent is doing, as it does it. Collapses to a single trace line once answered. */}
          {phase === "thinking" ? (
            <ol className="space-y-2">
              {STEPS.map((label, i) => {
                const state = i < step ? "done" : i === step ? "running" : "pending";
                return (
                  <li key={label} className="flex items-center gap-2.5 text-[13px]">
                    <span className={cn("grid h-4 w-4 flex-none place-items-center rounded-full border", state === "done" ? "border-transparent bg-navy text-white dark:text-canvas" : state === "running" ? "border-navy-400" : "border-line-strong")}>
                      {state === "done" ? <Check className="h-2.5 w-2.5" strokeWidth={3.2} /> : state === "running" ? <span className="h-1.5 w-1.5 rounded-full bg-navy" /> : null}
                    </span>
                    <span className={state === "running" ? "shimmer-text font-medium" : state === "done" ? "text-ink-muted" : "text-ink-faint"}>{label}</span>
                    {state === "running" ? <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span> : null}
                  </li>
                );
              })}
            </ol>
          ) : result?.ok ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12px] text-ink-faint">
                <span className="eyebrow text-ink">Network agent</span>
                <span>Searched {result.searched} people · ranked by trust</span>
                {result.understood.length ? <span className="inline-flex flex-wrap items-center gap-1.5">Understood{result.understood.slice(0, 4).map((u) => <span key={u} className="rounded-full bg-surface-muted px-2 py-0.5 font-medium text-ink-muted">{u}</span>)}</span> : null}
              </div>
              <p className={cn("font-display is-small mt-3 max-w-[64ch] text-[18px] leading-[1.4] text-ink", !done && "stream-caret")}>{typed}</p>

              {done && result.people.length ? (
                <div className="mt-3.5 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {result.people.map((p, i) => (
                    <Link key={p.id} href={`/network/${p.id}`} className="rise-in group block" style={{ animationDelay: `${i * 50}ms` }}>
                      <div className="flex h-full items-start gap-3 rounded-[6px] border border-line bg-surface p-3.5 transition-colors duration-200 group-hover:border-ink">
                        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-surface-muted ring-1 ring-line text-[12px] font-semibold text-ink">{initials(p.name)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[13.5px] font-semibold text-ink">{p.name}</span>
                            <span className={cn("h-1.5 w-1.5 flex-none rounded-full", p.open ? "bg-teal-400" : "bg-line-strong")} title={p.availability} />
                          </span>
                          <span className="block truncate text-[12px] text-ink-muted">{[p.headline, p.city].filter(Boolean).join(" · ") || p.availability}</span>
                          {p.why.length ? <span className="mt-1 block text-[12px] leading-[1.45] text-ink-faint">{p.why.slice(0, 3).join(" · ")}</span> : null}
                        </span>
                        <span className="flex-none text-right">
                          <span className="block font-display text-[22px] leading-[1] text-ink tabular">{Math.round(p.trust)}</span>
                          <span className="block text-[12px] text-ink-faint">{p.band.toLowerCase()}</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}

              {done ? (
                <div className="rise-in mt-3.5 flex flex-wrap items-center gap-2">
                  {result.total ? <Link href={result.href} className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-navy px-3.5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-navy-600 dark:text-canvas">{result.total > result.people.length ? `See all ${result.total} in Network` : "Open in Network"} <ArrowRight className="h-3.5 w-3.5" /></Link> : <Link href="/network/intake" className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-navy px-3.5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-navy-600 dark:text-canvas">Add someone <ArrowRight className="h-3.5 w-3.5" /></Link>}
                  <button type="button" onClick={reset} className="inline-flex h-9 items-center rounded-[6px] border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink transition-colors duration-200 hover:border-ink cursor-pointer">Ask something else</button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink">
              <span>{result && !result.ok ? result.error : "Something went wrong."}</span>
              <button type="button" onClick={reset} className="rounded-[6px] border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-ink cursor-pointer">Try again</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
