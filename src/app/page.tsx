import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { publicNetwork } from "@/server/public";
import { loadFeatures } from "@/server/queries";
import { applyToJoin, sendNeed } from "@/server/actions/public";
import { PROOFS } from "@/lib/standard";
import { SCREENING_MINUTES } from "@/lib/screening";
import { BrandMark } from "@/components/ui/brand-mark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FrontDoor } from "@/components/public/front-door";
import { Constellation } from "@/components/ui/constellation";
import { APP_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const n = await publicNetwork();
  return { title: n ? `${n.name}: expertise known first hand` : APP_NAME, description: "A network of experienced consultants where every person is known first hand, for roles and for consultancy assignments." };
}

const ERRORS: Record<string, string> = {
  details: "Something was missing or too short. Start again and I will ask once more.",
  consent: "Nothing was kept, because the box to keep your details was not ticked. Start again when you are ready.",
  throttled: "Too many attempts from this connection. Wait a few minutes, then try again.",
};


/**
 * The front door. It says what the network is, publishes the standard people are held to, and
 * takes two things from strangers, in one conversation with Amana: an application to join, and a need. It shows nothing about
 * who is in the network. Signed-in visitors never see it; the middleware sends them home.
 */
export default async function PublicPage({ searchParams }: { searchParams: Promise<{ sent?: string; form?: string; error?: string; as?: string }> }) {
  const network = await publicNetwork();
  if (!network) redirect("/login");
  const sp = await searchParams;
  // Applications open only when the owner releases them; until then the network is by invitation.
  const open = (await loadFeatures(network.id)).publicApplications;
  const asJoin = sp.as === "join" || sp.form === "join";
  const sent = sp.sent === "need" || sp.sent === "join" ? sp.sent : null;
  const error = sp.error && ERRORS[sp.error] ? ERRORS[sp.error] : null;

  return (
    <div className="min-h-screen overflow-x-clip text-ink">
      <div className="stage-ink">
        <Constellation focus={0.5} />
        <span className="stage-scrim is-center" aria-hidden="true" />
        <header>
          <nav aria-label="Main" className="mx-auto flex h-[72px] w-full max-w-[1180px] items-center gap-6 px-5 sm:px-8">
            <Link href="/" className="flex items-center gap-2.5"><BrandMark className="h-[22px] w-auto text-white" /><span className="hidden font-display text-[16px] sm:inline">{network.name}</span></Link>
            <div className="hidden items-center gap-7 text-[14px] stage-muted md:flex">
              <a href="#how" className="hover:text-white">How it works</a><a href="#standard" className="hover:text-white">The standard</a>
            </div>
            <span className="flex-1" />
            <ThemeToggle className="!h-9 !w-9 !border-0 !bg-transparent !text-white !shadow-none" />
            <a href="/login" className="hidden text-[14px] font-medium text-white/85 hover:text-white sm:inline">Sign in</a>
            {open ? <Link href="/?as=join#ask" className="btn-mint h-10 whitespace-nowrap px-5 text-[14px]">Apply to join</Link> : <a href="/login" className="btn-mint h-10 whitespace-nowrap px-5 text-[14px]">Sign in</a>}
          </nav>
        </header>

        <section className="mx-auto w-full max-w-[960px] px-5 pb-24 pt-16 text-center sm:px-8 sm:pb-32 sm:pt-24">
          <h1 className="hero-title mx-auto max-w-[14ch] text-[48px] sm:text-[84px]">Who do you <span className="text-mint">need?</span></h1>
          <p className="mx-auto mt-6 max-w-[52ch] text-[16px] leading-[1.6] stage-muted sm:text-[18px]">Describe a role or a piece of work. We find senior consultants in the Gulf and London whom we know first hand, and introduce them once they say yes.</p>
          {open ? <FrontDoor key={asJoin ? "join" : "need"} sendNeed={sendNeed} applyToJoin={applyToJoin} initialMode={asJoin ? "join" : "need"} sent={sent} error={error} networkName={network.name} /> : <p className="mx-auto mt-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-[14px] text-white/85" data-by-invitation>By invitation only. If you have an invitation, it brings you straight in.</p>}
          <p className="mt-12 text-[13px] stage-faint">Free for members · Pay only on placement · Names private until they say yes</p>
        </section>
      </div>

      <main>

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
                <li key={t} className={`border-t-2 pt-5 ${["border-teal-400", "border-[#5aa2f0]", "border-[#f2c46d]", "border-coral"][i]}`}>
                  <span className={`tile ${["is-mint", "is-blue", "is-gold", "is-coral"][i]} !h-8 !w-8 text-[13px] font-semibold`}>{i + 1}</span>
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
                  <dt className="flex items-center gap-2.5 text-[15.5px] font-semibold"><span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-teal-50 text-teal"><Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /></span>{p.title}</dt>
                  <dd className="mt-1.5 pl-[34px] text-[14px] leading-[1.55] text-ink-muted">{p.means}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

      </main>

      <footer className="stage-ink">
        <Constellation focus={0.85} density={0.5} />
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-end justify-between gap-6 px-5 py-14 sm:px-8">
          <div>
            <div className="flex items-center gap-2.5"><BrandMark className="h-[22px] w-auto text-white" /><span className="font-display text-[16px]">{network.name}</span></div>
            <p className="mt-4 max-w-[46ch] text-[13.5px] leading-[1.6] stage-muted">By invitation. Members can see, export or delete their data at any time.</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="btn-ghost-stage h-10 px-5 text-[14px]">Sign in</a>
            {open ? <Link href="/?as=join#ask" className="btn-mint h-10 px-5 text-[14px]">Apply to join</Link> : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
