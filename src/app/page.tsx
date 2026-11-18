import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { publicNetwork } from "@/server/public";
import { applyToJoin, sendNeed } from "@/server/actions/public";
import { PROOFS } from "@/lib/standard";
import { SCREENING_MINUTES } from "@/lib/screening";
import { BrandMark } from "@/components/ui/brand-mark";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProofLine } from "@/components/domain/standard";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const n = await publicNetwork();
  return { title: n ? `${n.name}: expertise known first hand` : "Network Intelligence", description: "A network of experienced consultants where every person is known first hand, for roles and for consultancy assignments." };
}

const ERRORS: Record<string, string> = {
  details: "Something is missing or too short. Check each field and send it again.",
  consent: "Please tick the box so we may keep what you have sent.",
  throttled: "Too many attempts from this connection. Wait a few minutes, then try again.",
};

/** A drawing of the idea, not of the network: no real person is on it. */
const BEADS: [ring: 0 | 1 | 2, angle: number, fresh?: boolean][] = [
  [0, -28], [0, 78], [0, 158], [0, 236],
  [1, -62], [1, 4], [1, 52], [1, 118], [1, 196], [1, 262],
  [2, -100, true], [2, -34], [2, 28], [2, 94, true], [2, 150], [2, 214], [2, 286],
];
const RX = [19, 33, 47], RY = [15, 27, 40], SIZE = [38, 28, 15], KIND = ["is-mint", "is-white", "is-faint"];

function Orbit() {
  return (
    <div className="relative mx-auto aspect-[1.18] w-full max-w-[560px]" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        {[2, 1, 0].map((i) => <ellipse key={i} cx="50" cy="50" rx={RX[i]} ry={RY[i]} className={`orbit-band is-${i}`} strokeWidth="0.25" strokeDasharray={i === 2 ? "0.9 1.1" : undefined} vectorEffect="non-scaling-stroke" />)}
      </svg>
      <span className="orbit-ripple" style={{ inset: "8% 3%" }} />
      {BEADS.map(([ring, deg, fresh], i) => {
        const a = (deg * Math.PI) / 180;
        return (
          <span key={i} className={`orbit-dot ${KIND[ring]} absolute rounded-full`} style={{ left: `${50 + RX[ring] * Math.cos(a)}%`, top: `${50 + RY[ring] * Math.sin(a)}%`, width: SIZE[ring], height: SIZE[ring], translate: "-50% -50%" }}>
            {fresh ? <span className="orbit-bud" /> : null}
            <span className="orbit-glow" style={{ animationDelay: `${(0.25 + ring * 0.35 + (i % 3) * 0.08).toFixed(2)}s` }} />
          </span>
        );
      })}
      <span className="orbit-beat absolute left-1/2 top-1/2 grid h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"><BrandMark className="h-5 w-auto text-[#0c1b33]" /></span>
    </div>
  );
}

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
    <div className="relative min-h-screen bg-canvas text-ink">
      <div className="ambient" aria-hidden="true" />
      <div className="relative z-[1] mx-auto w-full max-w-[1180px] px-4 sm:px-6 pb-16">
        <header className="flex items-center justify-between py-5">
          <Link href="/" className="flex items-center gap-2.5"><BrandMark className="h-6 w-auto text-ink" /><span className="font-display is-small text-[17px]">{network.name}</span></Link>
          <a href="/login" className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink hover:bg-surface-hover">Sign in</a>
        </header>

        <section className="ink-stage relative overflow-hidden rounded-[28px] px-6 py-10 sm:px-12 sm:py-14 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-8 items-center">
          <div>
            <div className="eyebrow text-ink-muted">Roles and consultancy assignments</div>
            <h1 className="font-display text-[36px] sm:text-[50px] leading-[1.04] mt-5 text-balance">A network of expertise where everyone is known first hand.</h1>
            <p className="mt-5 text-[16px] leading-[1.6] text-ink-muted max-w-[50ch]">{network.name} places experienced consultants into roles and onto consultancy assignments. Nobody is here on their own word alone. Each person holds proofs that someone else has put their name to.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#join" className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[14.5px] font-semibold text-accent-ink hover:brightness-105">Apply to join <ArrowRight className="h-4 w-4" /></a>
              <a href="#need" className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong px-6 text-[14.5px] font-semibold text-ink hover:bg-white/[0.06]">Bring us a need</a>
            </div>
          </div>
          <Orbit />
        </section>

        <section className="mt-16 sm:mt-20" aria-labelledby="standard">
          <div className="max-w-[720px]">
            <div className="eyebrow text-ink-faint">The standard</div>
            <h2 id="standard" className="font-display text-[30px] sm:text-[38px] leading-[1.08] mt-4 text-balance">Six proofs. Each one is a fact, with a witness.</h2>
            <p className="mt-4 text-[15.5px] leading-[1.6] text-ink-muted">Most places verify people with a list of things they declare about themselves, checked once. We record what other people have seen, and we show you which proofs each person holds. A proof is either on record or it is not yet.</p>
          </div>
          <div className="mt-9 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-10 items-start">
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
              {PROOFS.map((p, i) => (
                <li key={p.key} className="flex gap-3.5 border-t border-line py-5">
                  <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-teal text-white dark:text-canvas"><Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /></span>
                  <span><b className="block text-[15.5px] font-semibold leading-snug">{p.title}</b><span className="mt-1 block text-[13.5px] leading-[1.55] text-ink-muted">{p.means}</span><span className="sr-only">Proof {i + 1} of {PROOFS.length}</span></span>
                </li>
              ))}
            </ol>
            <aside className="widget p-6" aria-label="An example of what a client sees">
              <div className="label-caps text-ink-faint">What a client sees, before any introduction</div>
              <div className="mt-4 flex items-center gap-2"><code className="text-[12px] bg-surface-muted rounded px-1.5 py-0.5">NI-EXAMPLE</code><b className="text-[13.5px]">Programme director · banking, transformation</b></div>
              <ProofLine className="mt-3 flex-col gap-y-1.5 text-[13px]" proofs={["Came through someone we know", "Screened in conversation", "Vouched for by 3", "Worked with first hand, and would again", "Availability confirmed recently"]} />
              <p className="mt-4 border-t border-line pt-4 text-[13px] leading-[1.55] text-ink-muted">Five of six held. No name, employer or contact details: those are released only when the person agrees to that introduction.</p>
            </aside>
          </div>
          <dl className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-x-10 gap-y-6 border-t border-line pt-8">
            {[
              ["A fact, not a promise", "Every proof points at something on record and at the person who stands behind it."],
              ["It can lapse", "Availability is confirmed by the person and goes stale if it is not kept up, so nobody is put forward on old news."],
              ["Earned in your own time", `The screening takes about ${SCREENING_MINUTES} minutes whenever suits you, and a reference takes your referee a minute from a link.`],
            ].map(([t, d]) => <div key={t}><dt className="font-display is-small text-[17px]">{t}</dt><dd className="mt-1.5 text-[13.5px] leading-[1.55] text-ink-muted">{d}</dd></div>)}
          </dl>
        </section>

        <section className="mt-16 sm:mt-20 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div id="join" className="widget scroll-mt-6 p-6 sm:p-8">
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

          <div id="need" className="widget scroll-mt-6 p-6 sm:p-8">
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
