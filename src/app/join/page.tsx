import { prisma } from "@/lib/db";
import { JoinForm } from "@/components/domain/join-form";
import { parseInvite } from "@/lib/invite";
import { SCREENING_MINUTES } from "@/lib/screening";
import { BrandMark } from "@/components/ui/brand-mark";
import { CirclesMotif } from "@/components/ui/circles-motif";

export const metadata = { title: "Join the network" };
export const dynamic = "force-dynamic";

// Joining really is a sequence, so it is shown as one: three stops on a single path.
const STEPS: { title: string; detail: string }[] = [
  { title: "Create your account", detail: "About two minutes. Paste your LinkedIn and we fill in the rest." },
  { title: `Have the ${SCREENING_MINUTES}-minute screening`, detail: "A structured conversation about what you do and how you work. A person reviews it before anything goes live." },
  { title: "You're on the radar", detail: "When a client needs someone like you, we ask you first — fractional, contract or permanent." },
];

/** Public, invitation-only registration. A member or the network's link must have invited you. */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ error?: string; ref?: string; t?: string }> }) {
  const sp = await searchParams;
  const members = await prisma.person.findMany({ where: { memberSince: { not: null } }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" }, take: 300 });
  const invite = parseInvite(sp.t) ?? (sp.ref ? { personId: sp.ref } : null);
  const referrer = invite?.personId ? members.find((m) => m.id === invite.personId) ?? null : null;
  const tenantInvite = !!invite?.tenantId;
  const inviteToken = sp.t && (referrer || tenantInvite) ? sp.t : undefined;
  const error = sp.error === "exists" ? "There is already a login for that email. Sign in instead." : sp.error === "referrer" ? "Choose the member who invited you." : sp.error === "consent" ? "Please confirm you understand how your profile is shared." : null;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1fr_1.05fr]">
      <aside className="brand-panel is-edge relative hidden lg:flex flex-col justify-between p-12 overflow-hidden lg:m-3 lg:rounded-[16px]">
        <CirclesMotif className="pointer-events-none absolute right-[-150px] bottom-[-110px] h-[520px] w-[520px] opacity-90" />
        <div className="relative flex items-center gap-2.5">
          <BrandMark className="h-7 w-auto" />
          <span className="font-display is-small text-[16px]">Network Intelligence</span>
        </div>

        <div className="relative max-w-[460px]">
          <div className="eyebrow text-stage-muted mb-5">By invitation</div>
          <h1 className="font-display text-[38px] leading-[1.1] text-balance">Be in the network for when the right work comes up.</h1>
          <p className="mt-5 text-stage-muted text-[15.5px] leading-[1.55] max-w-[44ch]">We place people we actually know. Join once, and when something fits we already know who you are and why we&apos;d put our name behind you.</p>

          <ol className="mt-9 relative">
            <span aria-hidden="true" className="absolute left-[14.5px] top-3 bottom-8 w-px bg-stage-line" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                <span className={`relative z-[1] h-[30px] w-[30px] flex-none rounded-full inline-flex items-center justify-center text-[13px] font-semibold tabular ${i === 0 ? "bg-accent text-accent-ink" : "bg-stage text-stage-ink ring-1 ring-stage-line"}`}>{i + 1}</span>
                <span>
                  <span className="block font-display is-small text-[16px] leading-[1.3] mt-[3px]">{s.title}</span>
                  <span className="block text-[13.5px] text-stage-muted leading-[1.55] mt-1 max-w-[40ch]">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative text-[12.5px] text-stage-muted">Anonymous to clients until you say yes · See, export or delete your data any time</div>
      </aside>

      <main className="relative flex items-center justify-center px-5 py-10 sm:px-10 bg-canvas text-ink">
        <div className="ambient" aria-hidden="true" />
        <div className="w-full max-w-[440px] relative z-[1]">
          <div className="lg:hidden mb-7">
            <div className="flex items-center gap-2.5 mb-6">
              <BrandMark className="h-6 w-auto text-ink" />
              <span className="font-display is-small text-[17px] text-ink">Network Intelligence</span>
            </div>
            <h1 className="font-display text-[27px] leading-[1.12]">Be in the network for when the right work comes up.</h1>
            <p className="text-[13.5px] text-ink-muted mt-2 leading-[1.55]">Create your account, have a {SCREENING_MINUTES}-minute screening, and you&apos;re on the radar — fractional, contract or permanent.</p>
          </div>
          <div className="hidden lg:block">
            <h2 className="font-display text-[28px] leading-[1.1]">Create your account</h2>
            <p className="text-[14.5px] text-ink-muted mt-2.5">Step 1 of 3 · about two minutes</p>
          </div>
          <JoinForm members={members} referrer={referrer} tenantInvite={tenantInvite} inviteToken={inviteToken} error={error} />
          <div className="text-[11.5px] text-ink-faint mt-5 text-center">Already a member? <a href="/login" className="text-ink-muted hover:text-ink underline underline-offset-2">Sign in</a></div>
        </div>
      </main>
    </div>
  );
}
