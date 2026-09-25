import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/session";
import { prisma } from "@/lib/db";
import { isInternal } from "@/lib/authz";
import { Input, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { answerScreening, startScreening } from "@/server/actions/members";
import { resolveMemberPerson } from "@/server/queries";
import { SCREENING_SCRIPT, SCREENING_MINUTES, type ScreeningAnswers, type ReferredPerson } from "@/lib/screening";
import { fullName, cn } from "@/lib/utils";

export const metadata = { title: "Screening" };

const ALL = SCREENING_SCRIPT.flatMap((s) => s.questions.map((q) => ({ ...q, section: s })));

export default async function ScreeningPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ c?: string; step?: string; required?: string }> }) {
  const user = await requireUser();
  const { id } = await params; const sp = await searchParams;
  const person = await prisma.person.findUnique({ where: { id } });
  if (!person) notFound();
  if (isInternal(user)) { if (person.tenantId !== user.tenantId) notFound(); } else { const me = await resolveMemberPerson(user); if (!me || me.id !== person.id) redirect("/forbidden"); }
  const member = !isInternal(user);
  const draft = sp.c ? await prisma.conversation.findUnique({ where: { id: sp.c } }) : await prisma.conversation.findFirst({ where: { personId: id, type: "SCREENING", approvalStatus: "DRAFT" }, orderBy: { createdAt: "desc" } });
  if (!draft || draft.personId !== id || draft.approvalStatus !== "DRAFT") {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faint">{member ? "AI screening" : "Screening call"}</div>
        <h1 className="text-[26px] font-semibold tracking-[-0.025em] mt-2">{member ? `Your ${SCREENING_MINUTES}-minute screening` : `Screening · ${fullName(person)}`}</h1>
        <p className="text-[13.5px] text-ink-muted mt-2">{SCREENING_SCRIPT.length} short sections. Answer in your own words; specifics beat adjectives. Nothing goes on the profile until a person has reviewed it.</p>
        <form action={startScreening} className="mt-5 flex justify-center gap-2"><input type="hidden" name="personId" value={id} /><input type="hidden" name="restart" value="1" /><SubmitButton pendingText="Starting…">Start</SubmitButton>{member ? null : <Link href={`/network/${id}`}><Button type="button" variant="ghost">Back to profile</Button></Link>}</form>
      </div>
    );
  }
  const step = Math.max(0, Math.min(ALL.length - 1, Number(sp.step ?? 0) || 0));
  const answers = ((draft.screening as { answers?: ScreeningAnswers } | null)?.answers ?? {}) as ScreeningAnswers;
  const q = ALL[step]; const sec = q.section; const secIdx = SCREENING_SCRIPT.indexOf(sec); const val = answers[q.key];
  const done = Object.keys(answers).length; const pct = Math.round((step / ALL.length) * 100);
  const strVal = typeof val === "string" ? val : Array.isArray(val) && typeof val[0] === "string" ? (val as string[]).join(", ") : "";
  const people = (Array.isArray(val) && typeof val[0] === "object" ? (val as ReferredPerson[]) : [{ name: "", context: "" }, { name: "", context: "" }]) as ReferredPerson[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
      <aside className="lg:sticky lg:top-[76px] rounded-[22px] p-6 text-white bg-[radial-gradient(700px_400px_at_0%_0%,#163a52_0%,#0b1226_60%)] shadow-[var(--shadow-card)]">
        <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/55">{member ? "AI screening" : "Screening call"}</div>
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] mt-1">{member ? `Your ${SCREENING_MINUTES}-minute screening` : `Screening · ${fullName(person)}`}</h2>
        <p className="text-white/65 text-[12.5px] mt-2">{member ? "A structured conversation. Answer in your own words. Nothing goes on your profile until a person has reviewed it." : `Run the call from this script. About ${SCREENING_MINUTES} minutes. Every answer maps to a profile field.`}</p>
        <ol className="mt-4 space-y-1">{SCREENING_SCRIPT.map((s, i) => <li key={s.key} className={cn("relative pl-8 pr-2 py-2 rounded-[12px] text-[13px]", i === secIdx ? "bg-white/10 text-white" : i < secIdx ? "text-white/75" : "text-white/50")}><span className={cn("absolute left-2.5 top-2.5 h-[18px] w-[18px] rounded-full border border-white/30 grid place-items-center text-[10.5px]", i === secIdx && "bg-teal border-transparent text-[#04211d]", i < secIdx && "bg-teal/30 border-transparent")}>{i < secIdx ? "✓" : i + 1}</span><b className="block font-medium">{s.title}</b><small className="block text-[11px] text-white/40">{s.minutes} min · {s.intent}</small></li>)}</ol>
        <div className="flex justify-between mt-4 text-[11.5px] text-white/50"><span>{done} of {ALL.length} answered</span><span>{SCREENING_MINUTES} min total</span></div>
        {member ? null : <Link href={`/network/${id}`} className="inline-block mt-3 text-[12.5px] text-white/70 hover:text-white">Back to profile</Link>}
      </aside>
      <section className="rounded-[22px] border border-line bg-surface shadow-[var(--shadow-card)] p-7 min-h-[420px]">
        <div className="h-1 rounded-full bg-surface-muted overflow-hidden mb-5"><div className="h-full rounded-full bg-[linear-gradient(90deg,#4f6fd6,#14b8a6)]" style={{ width: `${pct}%` }} /></div>
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">Section {secIdx + 1} of {SCREENING_SCRIPT.length} · {sec.title} · ~{sec.minutes} min</div>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] leading-8 max-w-[34ch]">{q.prompt}</h1>
        {q.help ? <p className="text-[13.5px] text-ink-muted mt-2 max-w-[60ch]">{q.help}</p> : null}
        {sp.required ? <p className="text-[12.5px] text-amber mt-2">This one matters. Give it a go.</p> : null}
        <form action={answerScreening} className="mt-5 space-y-4">
          <input type="hidden" name="conversationId" value={draft.id} /><input type="hidden" name="step" value={step} />
          {q.kind === "text" ? <Input name="a" defaultValue={strVal} placeholder={q.placeholder} autoFocus className="text-[15px] h-11" /> : null}
          {q.kind === "long" ? <Textarea name="a" defaultValue={strVal} placeholder={q.placeholder ?? "Take your time. Specifics beat adjectives."} className="min-h-[140px] text-[15px]" autoFocus /> : null}
          {q.kind === "chips" ? <><Input name="a" defaultValue={strVal} placeholder={q.placeholder} autoFocus className="text-[15px] h-11" /><div className="text-[12px] text-ink-faint">Separate with commas.</div></> : null}
          {q.kind === "select" || q.kind === "multi" ? <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{q.options!.map(([k, l]) => { const on = q.kind === "multi" ? Array.isArray(val) && (val as string[]).includes(k) : val === k; return <label key={k} className={cn("flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] border cursor-pointer text-[13px] transition-all", on ? "border-navy-400 bg-navy-100/60 shadow-[0_0_0_3px_rgba(79,111,214,0.12)]" : "border-line bg-surface hover:border-line-strong")}><input type={q.kind === "multi" ? "checkbox" : "radio"} name="a" value={k} defaultChecked={on} className="accent-navy-400" /><span>{l}</span></label>; })}</div> : null}
          {q.kind === "scale" ? <div className="grid grid-cols-[auto_1fr_auto] gap-3.5 items-center"><small className="text-[12px] text-ink-muted max-w-[120px] text-center">{q.low}</small><div className="flex justify-center gap-2">{[1, 2, 3, 4, 5].map((i) => <label key={i} className={cn("h-[52px] w-[52px] rounded-[16px] border grid place-items-center text-[17px] font-semibold cursor-pointer transition-all", Number(val) === i ? "bg-navy text-white border-transparent shadow-[var(--shadow-button)]" : "border-line bg-surface hover:border-line-strong")}><input type="radio" name="a" value={i} defaultChecked={Number(val) === i} className="sr-only" />{i}</label>)}</div><small className="text-[12px] text-ink-muted max-w-[120px] text-center">{q.high}</small></div> : null}
          {q.kind === "people" ? <div className="space-y-2">{[...people, { name: "", context: "" }].map((r, i) => <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr] gap-2"><Input name="pn" defaultValue={r.name} placeholder="Full name" /><Input name="pc" defaultValue={r.context} placeholder="What you have seen them do, and how you know them" /><Input name="pe" defaultValue={r.email ?? ""} placeholder="Email (optional)" /></div>)}<div className="text-[12px] text-ink-faint">Leave rows empty if there is no one else. You can add more people later from your profile.</div></div> : null}
          <div className="flex items-center justify-between pt-4 border-t border-line">
            <span>{step > 0 ? <SubmitButton variant="ghost" name="nav" value="back" pendingText="…">← Back</SubmitButton> : null}</span>
            <span className="flex items-center gap-2">{q.required ? <small className="text-ink-faint">Required</small> : <SubmitButton variant="ghost" name="nav" value="skip" pendingText="…">Skip</SubmitButton>}<SubmitButton name="nav" value="next" pendingText="…">{step === ALL.length - 1 ? "Finish screening" : "Next →"}</SubmitButton></span>
          </div>
        </form>
      </section>
    </div>
  );
}
