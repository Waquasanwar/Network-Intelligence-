"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check } from "lucide-react";
import { AgentMark } from "@/components/ui/agent-mark";
import { parseBrief } from "@/lib/demand";

type Mode = "need" | "join";
type Step = "ask" | "name" | "email" | "org" | "knows" | "send";
type Said = { who: "amana" | "you"; text: string; chips?: string[] };

const PLACEHOLDER: Record<Mode, string> = {
  need: "An interim CFO for an energy company in Dubai, six months",
  join: "Interim programme director, core banking and payments",
};
const FLOW: Record<Mode, Step[]> = { need: ["ask", "name", "email", "org", "send"], join: ["ask", "name", "email", "knows", "send"] };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** How Amana reads a need, in a few words: role, where, how long, how they would work. */
function readNeed(text: string): string[] {
  const b = parseBrief(text);
  const route: Record<string, string> = { PERMANENT: "Permanent", CONTRACT: "Contract", INTERIM: "Interim", FRACTIONAL: "Fractional", SOW: "Project", ADVISORY: "Advisory" };
  return [
    ...b.roles.slice(0, 2),
    ...b.locations.slice(0, 2),
    b.durationMonths ? `${b.durationMonths} month${b.durationMonths === 1 ? "" : "s"}` : "",
    b.engagementRoute ? route[b.engagementRoute] ?? "" : "",
  ].filter(Boolean);
}

/**
 * The front door is one conversation with Amana, not a form. A visitor says in their own words who
 * they need, or what they do; Amana shows how it read it and asks for the little it still needs,
 * one question at a time. Nothing is kept until they say yes to it at the end.
 */
export function FrontDoor({ sendNeed, applyToJoin, initialMode = "need", sent, error, networkName }: {
  sendNeed: (f: FormData) => Promise<void>; applyToJoin: (f: FormData) => Promise<void>;
  initialMode?: Mode; sent?: Mode | null; error?: string | null; networkName: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("ask");
  const [draft, setDraft] = useState("");
  const [said, setSaid] = useState<Said[]>([]);
  const [v, setV] = useState({ text: "", name: "", email: "", organisation: "", who: "company", knows: "", linkedinUrl: "" });
  const [nudge, setNudge] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const answer = useRef<HTMLInputElement>(null);
  const first = v.name.split(/\s+/)[0];

  useEffect(() => {
    const el = step === "ask" ? box.current : answer.current;
    el?.focus({ preventScroll: true });
    // Keep the reply box in view as the conversation grows, as a chat app does.
    if (step !== "ask") (el ?? document.querySelector(".door-send"))?.scrollIntoView({ block: "nearest" });
  }, [step]);
  const grow = (el: HTMLTextAreaElement) => { el.style.height = "0px"; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; };

  const question = useMemo(() => ({
    name: "Who should I reply to?",
    email: `Thank you, ${first}. The best email for you?`,
    org: "Which organisation is this for?",
    knows: "Does anyone here know your work? A name or your LinkedIn helps. You can skip this.",
    send: mode === "need" ? "That is all I need. A person reads it, usually the same day, and comes back to you before any names are shared." : "That is all I need. A person reads every application; if it fits, you get a personal invitation.",
  }), [first, mode]);

  const say = (...s: Said[]) => setSaid((x) => [...x, ...s]);
  const next = (from: Step) => FLOW[mode][FLOW[mode].indexOf(from) + 1];

  function submit() {
    const words = draft.trim(); setNudge(null);
    if (step === "ask") {
      if (words.length < (mode === "need" ? 15 : 10)) { setNudge(mode === "need" ? "Tell me a little more: the role, where, and for how long." : "Tell me a little more about the work you do."); return; }
      const chips = mode === "need" ? readNeed(words) : [];
      setV((x) => ({ ...x, text: words }));
      say({ who: "you", text: words }, mode === "need"
        ? { who: "amana", text: chips.length ? "Here is how I read it. A person checks it with you." : "Thank you. A person will read it and check anything unclear with you.", chips }
        : { who: "amana", text: "Thank you. We hold everyone to the same six proofs, and your name is never shared until you say yes." });
    } else if (step === "name") {
      if (words.length < 2) { setNudge("Your name, please."); return; }
      setV((x) => ({ ...x, name: words })); say({ who: "you", text: words });
    } else if (step === "email") {
      if (!EMAIL.test(words)) { setNudge("That does not look like an email address."); return; }
      setV((x) => ({ ...x, email: words.toLowerCase() })); say({ who: "you", text: words });
    } else if (step === "org") {
      if (words.length < 2) { setNudge("The organisation's name, please."); return; }
      setV((x) => ({ ...x, organisation: words })); say({ who: "you", text: `${words} · ${v.who === "agency" ? "an agency" : "a company"}` });
    } else if (step === "knows") {
      const url = /^https?:\/\/\S+$/i.test(words) ? words : /^(www\.)?linkedin\.com\//i.test(words) ? `https://${words}` : "";
      setV((x) => ({ ...x, knows: url ? "" : words, linkedinUrl: url }));
      say({ who: "you", text: words || "Skip" });
    }
    setDraft(""); setStep(next(step));
  }

  const reset = (m: Mode = mode) => { setMode(m); setStep("ask"); setSaid([]); setDraft(""); setNudge(null); setV({ text: "", name: "", email: "", organisation: "", who: "company", knows: "", linkedinUrl: "" }); };

  if (sent) {
    return (
      <div className="door mx-auto mt-10 w-full max-w-[640px] text-left" role="status" data-door-sent={sent}>
        <div className="door-line"><span className="door-mark"><AgentMark size={28} /></span>
          <div><b className="block text-[16px] text-ink">{sent === "need" ? "Thank you. We have it." : "Thank you. Your application is with us."}</b>
            <p className="mt-1 text-[14.5px] leading-[1.55] text-ink-muted">{sent === "need" ? "A person will read it and come back to you by email, usually with a question or two before any names are discussed." : "A person reads every application. If it is a fit you will get a personal invitation by email, with a link to create your login."}</p></div>
        </div>
      </div>
    );
  }

  const asking = step !== "ask" && step !== "send";
  return (
    <div id="ask" className="door mx-auto mt-10 w-full max-w-[640px] scroll-mt-24 text-left" data-door={mode}>
      {error ? <p role="alert" className="mb-3 rounded-[12px] bg-risk-100 px-3.5 py-2.5 text-[13px] text-risk">{error}</p> : null}

      {said.length ? (
        <ol className="door-thread" aria-live="polite" aria-label={`Conversation with ${networkName}`}>
          {said.map((s, i) => s.who === "you"
            ? <li key={i} className="door-you">{s.text}</li>
            : <li key={i} className="door-line"><span className="door-mark"><AgentMark size={28} /></span><div><p>{s.text}</p>{s.chips?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{s.chips.map((c) => <span key={c} className="door-chip">{c}</span>)}</div> : null}</div></li>)}
          {step !== "ask" ? <li className="door-line"><span className="door-mark"><AgentMark size={28} /></span><p data-door-question>{question[step]}</p></li> : null}
        </ol>
      ) : null}

      {step === "send" ? (
        <form action={mode === "need" ? sendNeed : applyToJoin} className="door-send">
          <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <input type="hidden" name="name" value={v.name} /><input type="hidden" name="email" value={v.email} />
          {mode === "need" ? <>
            <input type="hidden" name="organisation" value={v.organisation} /><input type="hidden" name="who" value={v.who} /><input type="hidden" name="message" value={v.text} />
          </> : <>
            <input type="hidden" name="headline" value={v.text.slice(0, 160)} /><input type="hidden" name="message" value={v.text.slice(0, 1500)} />
            <input type="hidden" name="knows" value={v.knows.slice(0, 200)} /><input type="hidden" name="linkedinUrl" value={v.linkedinUrl} />
          </>}
          <label className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-ink-muted"><input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 flex-none accent-[var(--color-navy)]" />
            <span>{mode === "need" ? `${networkName} may keep these details to respond to this request.` : `${networkName} may keep these details to consider my application. If I am not invited they are deleted.`}</span></label>
          <div className="mt-3 flex items-center justify-between gap-3">
            <button type="button" className="text-[13px] font-medium text-ink-muted hover:text-ink" onClick={() => reset()}>Start again</button>
            <button type="submit" className="btn-mint h-10 px-5 text-[14px]">{mode === "need" ? "Send it to us" : "Send my application"}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="composer p-2.5">
          {step === "ask" ? (
            <div className="flex items-start gap-3 px-2.5 pt-2">
              <span className="mt-[3px]"><AgentMark size={24} /></span>
              <label htmlFor="front-ask" className="sr-only">{mode === "need" ? "Who do you need?" : "What do you do?"}</label>
              <textarea ref={box} id="front-ask" rows={1} value={draft} placeholder={PLACEHOLDER[mode]}
                onChange={(e) => { setDraft(e.target.value); grow(e.target); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                className="min-h-[52px] w-full resize-none text-[16px] leading-[1.55] text-ink placeholder:text-ink-faint" />
            </div>
          ) : (
            <div className="flex items-center gap-3 px-2.5 pt-1.5">
              <label htmlFor="front-answer" className="sr-only">{asking ? question[step] : ""}</label>
              <input ref={answer} id="front-answer" value={draft} onChange={(e) => setDraft(e.target.value)}
                type={step === "email" ? "email" : "text"} autoComplete={step === "name" ? "name" : step === "email" ? "email" : step === "org" ? "organization" : "off"}
                placeholder={step === "name" ? "Your name" : step === "email" ? "name@company.com" : step === "org" ? "Organisation" : "A name, or a LinkedIn link"}
                className="h-11 w-full text-[16px] text-ink placeholder:text-ink-faint" />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-1.5">
            {step === "ask" ? (
              <div className="flex gap-1.5" role="group" aria-label="I am">
                <button type="button" className="chip" aria-pressed={mode === "need"} onClick={() => reset("need")}>I&apos;m hiring</button>
                <button type="button" className="chip" aria-pressed={mode === "join"} onClick={() => reset("join")}>I&apos;m a consultant</button>
              </div>
            ) : step === "org" ? (
              <div className="flex gap-1.5" role="group" aria-label="You are">
                <button type="button" className="chip" aria-pressed={v.who === "company"} onClick={() => setV((x) => ({ ...x, who: "company" }))}>A company</button>
                <button type="button" className="chip" aria-pressed={v.who === "agency"} onClick={() => setV((x) => ({ ...x, who: "agency" }))}>An agency</button>
              </div>
            ) : step === "knows" ? (
              <button type="button" className="chip" onClick={() => { setDraft(""); setV((x) => ({ ...x, knows: "", linkedinUrl: "" })); say({ who: "you", text: "Skip" }); setStep("send"); }}>Skip</button>
            ) : <span />}
            <button type="submit" className="send-btn" disabled={!draft.trim()} aria-label="Send to Amana"><ArrowUp className="h-4 w-4" strokeWidth={2.2} /></button>
          </div>
          {nudge ? <p className="px-2.5 pb-1 pt-2 text-[13px] text-risk" role="alert">{nudge}</p> : null}
        </form>
      )}
      {step === "ask" && !said.length ? <p className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] stage-faint"><Check className="h-3 w-3" aria-hidden="true" />Nothing is kept until you say yes at the end.</p> : null}
    </div>
  );
}
