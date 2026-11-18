import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, EyeOff, MessagesSquare, Users, BadgeCheck, Handshake, Sparkles } from "lucide-react";
import { publicNetwork } from "@/server/public";
import { applyToJoin, sendNeed } from "@/server/actions/public";
import { PROOFS } from "@/lib/standard";
import { SCREENING_MINUTES } from "@/lib/screening";
import { BrandMark } from "@/components/ui/brand-mark";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TrustBeams } from "@/components/public/trust-beams";
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
const Point = ({ children }: { children: React.ReactNode }) => <li className="flex gap-2.5 text-[14px] leading-[1.5] text-ink-muted"><Check className="mt-[3px] h-3.5 w-3.5 flex-none text-teal" strokeWidth={3} aria-hidden="true" /><span>{children}</span></li>;

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
    <div className="relative min-h-screen overflow-x-clip text-ink">
      <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6">
        <nav aria-label="Main" className="glass mx-auto flex h-14 w-full max-w-[1180px] items-center gap-2 rounded-full border border-line pl-4 pr-2 shadow-[var(--shadow-card)] sm:gap-4 sm:pl-5">
          <Link href="/" className="flex items-center gap-2.5"><BrandMark className="h-[22px] w-auto text-ink" /><span className="font-display is-small text-[16px]">{network.name}</span></Link>
          <div className="ml-6 hidden items-center gap-6 text-[13.5px] text-ink-muted md:flex">
            <a href="#how" className="hover:text-ink">How it works</a><a href="#standard" className="hover:text-ink">The standard</a><a href="#need" className="hover:text-ink">For companies</a>
          </div>
          <span className="flex-1" />
          <ThemeToggle />
          <a href="/login" className="hidden h-9 items-center rounded-full px-3.5 text-[13.5px] font-semibold text-ink-muted hover:text-ink sm:inline-flex">Sign in</a>
          <a href="#join" className="btn-navy inline-flex h-10 items-center gap-1.5 rounded-full bg-navy px-4 text-[13.5px] font-semibold text-white dark:text-canvas">Apply to join</a>
        </nav>
      </header>

      <div className="relative mx-auto w-full max-w-[1180px] px-4 sm:px-6 pb-16">
        <section className="pt-16 text-center sm:pt-24">
          <span className="pill-badge"><span className="live-dot !h-1.5 !w-1.5" />Invitation-led · Dubai and London</span>
          <h1 className="display-wide mx-auto mt-7 max-w-[15ch] text-[44px] sm:text-[72px] lg:text-[88px] text-balance"><span className="text-sheen">Expertise,</span> <span className="text-aurora">known first hand.</span></h1>
          <p className="mx-auto mt-6 max-w-[60ch] text-[16px] leading-[1.6] text-ink-muted sm:text-[17.5px]">{network.name} is a private network of senior consultants, for roles and for consultancy assignments. Everyone arrives through someone we know, and holds proofs that other people have put their name to.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href="#join" className="btn-glow inline-flex h-12 items-center gap-2 rounded-full px-6 text-[14.5px] font-semibold">Apply to join <ArrowRight className="h-4 w-4" /></a>
            <a href="#need" className="btn-ghost-glass inline-flex h-12 items-center gap-2 rounded-full px-6 text-[14.5px] font-semibold">Bring us a need</a>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-ink-faint">
            {["Free for members", "Companies pay only on placement", "Names private until you say yes"].map((t) => <li key={t} className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-teal" strokeWidth={3} aria-hidden="true" />{t}</li>)}
          </ul>
        </section>

        <div className="relative mx-auto mt-14 max-w-[1080px] sm:mt-16">
          <div className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_30%,rgba(126,227,188,0.18),transparent_70%)]" aria-hidden="true" />
          <TrustBeams />
        </div>

        <div className="mt-14 text-center text-[12.5px] text-ink-faint">The kind of expertise in the network</div>
        <div className="marquee mt-4" aria-label="Areas of expertise">
          {[0, 1].map((k) => (
            <div key={k} aria-hidden={k === 1 ? true : undefined}>
              {["Core banking", "Payments", "Interim CFO", "Finance transformation", "ERP and S/4HANA", "Programme recovery", "PMO", "Data and AI", "Cyber security", "Procurement", "Operating model", "Change management", "Energy transition", "Infrastructure", "Healthcare", "Public sector"].map((t) => <span key={t} className="whitespace-nowrap rounded-full border border-line bg-surface/60 px-3.5 py-1.5 text-[13px] text-ink-muted">{t}</span>)}
            </div>
          ))}
        </div>

        <section id="how" className="mt-24 scroll-mt-24 sm:mt-32" aria-labelledby="how-title">
          <div className="mx-auto max-w-[720px] text-center">
            <span className="pill-badge"><Sparkles className="h-3.5 w-3.5 text-teal" aria-hidden="true" />How it works</span>
            <h2 id="how-title" className="display-wide mt-5 text-[34px] sm:text-[48px] text-balance"><span className="text-sheen">One network. Built on who knows whom.</span></h2>
            <p className="mt-4 text-[15.5px] leading-[1.6] text-ink-muted">Consultants join free, by invitation. Companies and agencies bring roles and pieces of work. Every introduction goes through {network.name}, and a fee applies only when someone is placed.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="widget p-6 md:col-span-2">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-teal"><BadgeCheck className="h-4 w-4" aria-hidden="true" />A record, not a CV</div>
              <h3 className="mt-3 font-display text-[22px] leading-tight">Every person carries proofs that someone else put their name to.</h3>
              <div className="mt-5 rounded-[14px] border border-line bg-surface-muted/50 p-4">
                <div className="flex items-center justify-between"><code className="mono text-[11.5px] text-ink-faint">NI-EXAMPLE · Programme director · banking</code><span className="text-[12px] text-ink-muted">5 of 6 held</span></div>
                <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2" aria-label="What a client sees, before any introduction">
                  {PROOFS.map((p, i) => <li key={p.key} className={`flex items-center gap-2 text-[13px] ${i === 4 ? "text-ink-faint" : "text-ink"}`}><span className={`grid h-4 w-4 flex-none place-items-center rounded-full ${i === 4 ? "border border-line-strong" : "bg-teal text-canvas"}`}>{i === 4 ? null : <Check className="h-2.5 w-2.5" strokeWidth={3.4} aria-hidden="true" />}</span>{p.title}</li>)}
                </ul>
              </div>
            </article>
            <article className="widget p-6">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-teal"><MessagesSquare className="h-4 w-4" aria-hidden="true" />Screened by conversation</div>
              <h3 className="mt-3 font-display text-[20px] leading-tight">{SCREENING_MINUTES} minutes, in your own time.</h3>
              <div className="mt-5 space-y-2 text-[13px]">
                <div className="max-w-[90%] rounded-[14px] rounded-tl-[4px] bg-surface-muted px-3.5 py-2.5 text-ink-muted">Tell me about a programme you brought back on track.</div>
                <div className="ml-auto max-w-[90%] rounded-[14px] rounded-tr-[4px] border border-line px-3.5 py-2.5 text-ink">A core banking migration, eight months late when I joined…</div>
                <div className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1.5 text-ink-faint"><span className="typing-dots"><i /><i /><i /></span>A person reads anything unusual</div>
              </div>
            </article>
            <article className="widget p-6">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-teal"><EyeOff className="h-4 w-4" aria-hidden="true" />Private until you say yes</div>
              <h3 className="mt-3 font-display text-[20px] leading-tight">Clients see what you hold, not who you are.</h3>
              <div className="mt-5 rounded-[14px] border border-line p-4">
                <div className="flex items-center gap-3"><span className="h-9 w-9 flex-none rounded-full bg-gradient-to-br from-teal/50 to-[#8b94ff]/50 blur-[2px]" /><span className="min-w-0"><span className="block h-3 w-28 rounded-full bg-line-strong blur-[1.5px]" /><span className="mt-1.5 block text-[12px] text-ink-muted">Interim CFO · energy</span></span></div>
                <div className="mt-4 flex gap-2"><span className="flex-1 rounded-full bg-navy py-1.5 text-center text-[12px] font-semibold text-white dark:text-canvas">Yes, introduce me</span><span className="flex-1 rounded-full border border-line py-1.5 text-center text-[12px] text-ink-muted">Not now</span></div>
              </div>
            </article>
            <article className="widget p-6">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-teal"><Handshake className="h-4 w-4" aria-hidden="true" />Pay on placement</div>
              <h3 className="mt-3 font-display text-[20px] leading-tight">Asking is free. A fee applies only when someone starts.</h3>
              <div className="mt-5 flex flex-wrap gap-1.5">{["Permanent", "Contract", "Interim", "Fractional", "Statement of work"].map((t) => <span key={t} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-muted">{t}</span>)}</div>
            </article>
            <article className="widget p-6">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-teal"><Users className="h-4 w-4" aria-hidden="true" />A community that refers</div>
              <h3 className="mt-3 font-display text-[20px] leading-tight">Members share work and refer each other.</h3>
              <div className="mt-5 rounded-[14px] border border-line p-3.5 text-[12.5px]">
                <div className="text-ink-faint">A member shared work</div>
                <div className="mt-1 font-semibold text-ink">Payments lead · Riyadh · contract</div>
                <div className="mt-2.5 flex items-center justify-between text-ink-muted"><span>3 referred</span><span className="text-teal">Share of the fee if placed</span></div>
              </div>
            </article>
          </div>
        </section>

        <section className="mt-24 scroll-mt-24 sm:mt-32" aria-labelledby="standard">
          <div className="mx-auto max-w-[720px] text-center">
            <span className="pill-badge"><BadgeCheck className="h-3.5 w-3.5 text-teal" aria-hidden="true" />The standard</span>
            <h2 id="standard" className="display-wide mt-5 text-[34px] sm:text-[48px] text-balance"><span className="text-sheen">Six proofs. Each one a fact, with a witness.</span></h2>
            <p className="mt-4 text-[15.5px] leading-[1.6] text-ink-muted">Most places verify people with a list of things they declare about themselves, checked once. We record what other people have seen, and show which proofs each person holds. A proof is either on record or it is not yet.</p>
          </div>
          <ol className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROOFS.map((p, i) => (
              <li key={p.key} className="widget p-5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-teal/15 text-teal ring-1 ring-teal/30"><Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /></span>
                <b className="mt-4 block text-[16px] font-semibold leading-snug">{p.title}</b>
                <span className="mt-1.5 block text-[13.5px] leading-[1.55] text-ink-muted">{p.means}</span>
                <span className="sr-only">Proof {i + 1} of {PROOFS.length}</span>
              </li>
            ))}
          </ol>
          <dl className="mt-10 grid grid-cols-1 gap-x-10 gap-y-6 border-t border-line pt-8 sm:grid-cols-3">
            {[
              ["A fact, not a promise", "Every proof points at something on record and at the person who stands behind it."],
              ["It can lapse", "Availability is confirmed by the person and goes stale if it is not kept up, so nobody is put forward on old news."],
              ["Earned in your own time", `The screening takes about ${SCREENING_MINUTES} minutes whenever suits you, and a reference takes your referee a minute from a link.`],
            ].map(([t, d]) => <div key={t}><dt className="font-display is-small text-[17px]">{t}</dt><dd className="mt-1.5 text-[13.5px] leading-[1.55] text-ink-muted">{d}</dd></div>)}
          </dl>
        </section>

        <section className="mt-24 sm:mt-32 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div id="join" className="widget scroll-mt-24 p-6 sm:p-8">
            <div className="eyebrow text-ink-faint">For consultants</div>
            <h2 className="font-display text-[26px] leading-[1.12] mt-4">Apply to join</h2>
            {sp.sent === "join" ? <Sent title="Thank you. Your application is with us." detail="A person reads every application. If it is a fit you will get a personal invitation by email, with a link to create your login." /> : (
              <>
                <ul className="mt-4 space-y-2">
                  <Point>Roles and consultancy assignments: permanent, interim, fractional and statement of work.</Point>
                  <Point>Your name is never shared with a client or an agency until you say yes to that introduction.</Point>
                  <Point>After you join: a {SCREENING_MINUTES}-minute screening in your own time, and a reference or two by link.</Point>
                </ul>
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

          <div id="need" className="widget scroll-mt-24 p-6 sm:p-8">
            <div className="eyebrow text-ink-faint">For companies and agencies</div>
            <h2 className="font-display text-[26px] leading-[1.12] mt-4">Bring us a need</h2>
            {sp.sent === "need" ? <Sent title="Thank you. We have it." detail="A person will read it and come back to you by email, usually with a question or two before any names are discussed." /> : (
              <>
                <ul className="mt-4 space-y-2">
                  <Point>Say it in plain words: a role to fill, or a piece of work you need delivered.</Point>
                  <Point>You see who fits by the proofs they hold, without names, and ask for the introductions you want.</Point>
                  <Point>Nothing to pay for asking. A fee applies only when you take someone on, on terms agreed up front.</Point>
                </ul>
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
        </section>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[12.5px] text-ink-faint">
          <span>{network.name}. Membership is by invitation. Members can see, export or delete their data at any time.</span>
          <a href="/login" className="font-semibold text-ink-muted hover:text-ink">Member, client or agency sign in</a>
        </footer>
      </div>
    </div>
  );
}
