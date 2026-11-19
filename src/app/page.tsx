import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { publicNetwork } from "@/server/public";
import { applyToJoin, sendNeed } from "@/server/actions/public";
import { PROOFS } from "@/lib/standard";
import { SCREENING_MINUTES } from "@/lib/screening";
import { BrandMark } from "@/components/ui/brand-mark";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NeedComposer } from "@/components/public/need-composer";
import { APP_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const n = await publicNetwork();
  return { title: n ? `${n.name}: expertise known first hand` : APP_NAME, description: "A network of experienced consultants where every person is known first hand, for roles and for consultancy assignments." };
}

const ERRORS: Record<string, string> = {
  details: "Something is missing or too short. Check each field and send it again.",
  consent: "Please tick the box so we may keep what you have sent.",
  throttled: "Too many attempts from this connection. Wait a few minutes, then try again.",
};

function Sent({ title, detail }: { title: string; detail: string }) {
  return (
    <div role="status" className="py-6">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-ink"><Check className="h-5 w-5" /></span>
      <h3 className="font-display text-[22px] leading-[1.15] mt-4">{title}</h3>
      <p className="text-[14px] text-ink-muted mt-2 leading-[1.55] max-w-[44ch]">{detail}</p>
    </div>
  );
}

const Trap = () => <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>;

/**
 * The front door. It says what the network is, publishes the standard people are held to, and
 * takes two things from strangers: an application to join, and a need. It shows nothing about
 * who is in the network. Signed-in visitors never see it; the middleware sends them home.
 */
export default async function PublicPage({ searchParams }: { searchParams: Promise<{ sent?: string; form?: string; error?: string }> }) {
  const network = await publicNetwork();
  if (!network) redirect("/login");
  const sp = await searchParams;
  const err = (form: string) => (sp.form === form && sp.error && ERRORS[sp.error] ? ERRORS[sp.error] : null);

  return (
    <div className="min-h-screen overflow-x-clip text-ink">
      <header className="glass sticky top-0 z-30 border-b border-line">
        <nav aria-label="Main" className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-6 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5"><BrandMark className="h-[20px] w-auto text-ink" /><span className="font-display is-small text-[15px]">{network.name}</span></Link>
          <div className="hidden items-center gap-6 text-[13.5px] text-ink-muted md:flex">
            <a href="#how" className="hover:text-ink">How it works</a><a href="#standard" className="hover:text-ink">The standard</a><a href="#start" className="hover:text-ink">Get started</a>
          </div>
          <span className="flex-1" />
          <ThemeToggle className="!h-9 !w-9 !border-0 !bg-transparent !shadow-none" />
          <a href="/login" className="hidden text-[13.5px] font-medium text-ink-muted hover:text-ink sm:inline">Sign in</a>
          <a href="#join" className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13.5px] font-medium text-canvas transition-opacity hover:opacity-85">Apply to join</a>
        </nav>
      </header>

      <main>
        <section className="mx-auto w-full max-w-[920px] px-5 pb-20 pt-20 text-center sm:px-8 sm:pt-28">
          <p className="inline-flex items-center gap-2 text-[13px] text-ink-faint"><span className="h-1.5 w-1.5 rounded-full bg-teal-400" aria-hidden="true" />A private network · Dubai and London</p>
          <h1 className="hero-title mx-auto mt-6 max-w-[14ch] text-[44px] sm:text-[72px]">Who do you need?</h1>
          <p className="mx-auto mt-5 max-w-[52ch] text-[16px] leading-[1.6] text-ink-muted sm:text-[17px]">Describe a role or a piece of work. We find senior consultants we know first hand, and introduce them once they say yes.</p>
          <NeedComposer />
          <p className="mt-10 text-[13px] text-ink-faint">Free for members · Pay only on placement · Names private until they say yes</p>
        </section>

        <section id="how" className="scroll-mt-20 border-t border-line" aria-labelledby="how-title">
          <div className="mx-auto w-full max-w-[1120px] px-5 py-20 sm:px-8 sm:py-24">
            <h2 id="how-title" className="section-title max-w-[20ch] text-[30px] sm:text-[40px]">Known first hand, from the first introduction.</h2>
            <ol className="mt-12 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Introduced", "Everyone arrives through someone we know. There are no cold applications."],
                ["Screened", `A ${SCREENING_MINUTES}-minute conversation in their own time, read by a person.`],
                ["Matched", "You see who fits by what they have proven, not by who they say they are."],
                ["Placed", "They say yes, you meet. A fee applies only when someone starts."],
              ].map(([t, d], i) => (
                <li key={t} className="border-t border-ink pt-5">
                  <span className="mono text-[12px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                  <b className="mt-3 block text-[17px] font-semibold tracking-[-0.01em]">{t}</b>
                  <span className="mt-2 block max-w-[34ch] text-[14.5px] leading-[1.6] text-ink-muted">{d}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="scroll-mt-20 border-t border-line" aria-labelledby="standard">
          <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <h2 id="standard" className="section-title max-w-[16ch] text-[30px] sm:text-[40px]">Six proofs. Each one has a witness.</h2>
              <p className="mt-5 max-w-[44ch] text-[15px] leading-[1.6] text-ink-muted">We record what other people have seen, not what someone says about themselves. A proof is on record, or it is not yet.</p>
            </div>
            <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
              {PROOFS.map((p) => (
                <div key={p.key} className="border-t border-line py-5">
                  <dt className="flex items-center gap-2 text-[15px] font-semibold"><Check className="h-3.5 w-3.5 flex-none text-teal" strokeWidth={3} aria-hidden="true" />{p.title}</dt>
                  <dd className="mt-1.5 text-[14px] leading-[1.55] text-ink-muted">{p.means}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="start" className="scroll-mt-20 border-t border-line" aria-labelledby="start-title">
          <div className="mx-auto w-full max-w-[1120px] px-5 py-20 sm:px-8 sm:py-24">
            <h2 id="start-title" className="section-title text-[30px] sm:text-[40px]">Get started</h2>
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-line">
          <div id="need" className="scroll-mt-24 lg:pr-12">
            <h3 className="section-title text-[24px]">Bring us a need</h3>
            <p className="mt-2 max-w-[48ch] text-[14.5px] leading-[1.55] text-ink-muted">For companies and agencies. Asking is free; a fee applies only when someone starts.</p>
            {sp.sent === "need" ? <Sent title="Thank you. We have it." detail="A person will read it and come back to you by email, usually with a question or two before any names are discussed." /> : (
              <>
                <form action={sendNeed} className="mt-6 space-y-3.5">
                  <Trap />
                  {err("need") ? <div role="alert" className="rounded-[12px] bg-risk-100 px-3.5 py-2.5 text-[13px] text-risk">{err("need")}</div> : null}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Your name" required><Input name="name" required minLength={2} maxLength={120} autoComplete="name" /></Field>
                    <Field label="Work email" required><Input name="email" type="email" required maxLength={200} autoComplete="email" /></Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
                    <Field label="Organisation" required><Input name="organisation" required minLength={2} maxLength={160} autoComplete="organization" /></Field>
                    <Field label="You are" required><Select name="who" defaultValue="company"><option value="company">A company</option><option value="agency">An agency</option></Select></Field>
                  </div>
                  <Field label="What do you need?" required hint="The role or the piece of work, where, for how long, and anything fixed such as budget or start date."><Textarea name="message" required minLength={15} maxLength={2500} rows={5} placeholder="We need an interim finance transformation lead in Dubai for six months, three days a week." /></Field>
                  <label className="flex items-start gap-2.5 text-[12.5px] text-ink-muted leading-[1.5]"><input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 flex-none accent-[var(--color-navy)]" /><span>I am happy for {network.name} to keep these details to respond to this request.</span></label>
                  <div className="flex justify-end"><SubmitButton pendingText="Sending…">Send it to us</SubmitButton></div>
                </form>
              </>
            )}
          </div>

          <div id="join" className="scroll-mt-24 pt-10 lg:pt-0 lg:pl-12">
            <h3 className="section-title text-[24px]">Apply to join</h3>
            <p className="mt-2 max-w-[48ch] text-[14.5px] leading-[1.55] text-ink-muted">For senior consultants. Free, by invitation. Your name is never shared until you say yes to an introduction.</p>
            {sp.sent === "join" ? <Sent title="Thank you. Your application is with us." detail="A person reads every application. If it is a fit you will get a personal invitation by email, with a link to create your login." /> : (
              <>
                <form action={applyToJoin} className="mt-6 space-y-3.5">
                  <Trap />
                  {err("join") ? <div role="alert" className="rounded-[12px] bg-risk-100 px-3.5 py-2.5 text-[13px] text-risk">{err("join")}</div> : null}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Your name" required><Input name="name" required minLength={2} maxLength={120} autoComplete="name" /></Field>
                    <Field label="Email" required><Input name="email" type="email" required maxLength={200} autoComplete="email" /></Field>
                  </div>
                  <Field label="What you do, in a line" required><Input name="headline" required minLength={3} maxLength={160} placeholder="Interim programme director, core banking and payments" /></Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="LinkedIn" hint="Optional"><Input name="linkedinUrl" type="url" maxLength={300} placeholder="https://www.linkedin.com/in/…" /></Field>
                    <Field label="Who do you know here?" hint="Optional. It helps."><Input name="knows" maxLength={200} placeholder="A name, if anyone" /></Field>
                  </div>
                  <Field label="The work you are best at, and what you are open to" required><Textarea name="message" required minLength={10} maxLength={1500} rows={4} /></Field>
                  <label className="flex items-start gap-2.5 text-[12.5px] text-ink-muted leading-[1.5]"><input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 flex-none accent-[var(--color-navy)]" /><span>I am happy for {network.name} to keep these details to consider my application and to contact me about it. If I am not invited they are deleted.</span></label>
                  <div className="flex justify-end"><SubmitButton pendingText="Sending…">Send my application</SubmitButton></div>
                </form>
              </>
            )}
          </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 py-8 text-[13px] text-ink-faint sm:px-8">
          <span>{network.name}. By invitation. Members can see, export or delete their data at any time.</span>
          <a href="/login" className="font-medium text-ink-muted hover:text-ink">Sign in</a>
        </div>
      </footer>
    </div>
  );
}
