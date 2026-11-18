import { prisma } from "@/lib/db";
import { JoinForm } from "@/components/domain/join-form";
import { resolveInvite } from "@/server/invites";
import { PASSWORD_MIN } from "@/lib/password";
import { SCREENING_MINUTES } from "@/lib/screening";
import { MailQuestion } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { APP_NAME } from "@/lib/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CirclesMotif } from "@/components/ui/circles-motif";

export const metadata = { title: "Join the network" };
export const dynamic = "force-dynamic";

// Joining really is a sequence, so it is shown as one: three stops on a single path.
const STEPS: { title: string; detail: string }[] = [
  { title: "Create your account", detail: "About two minutes. Paste your LinkedIn and we fill in the rest." },
  { title: `Have the ${SCREENING_MINUTES}-minute screening`, detail: "A structured conversation about what you do and how you work, by voice or in writing, in your own time." },
  { title: "You're on the radar", detail: "When a client needs someone like you, we ask you first — fractional, contract or permanent." },
];

const PROBLEMS: Record<string, { title: string; detail: string }> = {
  none: { title: "You need an invitation to join", detail: "This network is by invitation. Ask the person who told you about us for their link, then open it here." },
  invalid: { title: "That invitation link is not valid", detail: "It may have been cut short when it was copied. Ask the person who invited you to send it again." },
  expired: { title: "That invitation has expired", detail: "Invitations stay open for 30 days. Ask the person who invited you for a new one." },
  used: { title: "That invitation has already been used", detail: "Each personal invitation works once. If it was you, sign in. Otherwise ask for a new one." },
  revoked: { title: "That invitation is no longer open", detail: "It was cancelled or replaced. Ask the person who invited you for their current link." },
};

const ERRORS: Record<string, string> = {
  exists: "There is already a login for that email. Sign in instead.",
  consent: "Please confirm you understand how your profile is shared.",
  details: "Check your name and email address, then try again.",
  throttled: "Too many attempts from this connection. Wait a few minutes, then try again.",
  "password-short": `Choose a password of at least ${PASSWORD_MIN} characters.`,
  "password-weak": "That password is too easy to guess. Try a longer phrase that is not your name or email.",
};

/**
 * Public registration, by invitation only. The page knows nothing about the network or its
 * members beyond what a valid invitation unlocks: the network's name and who sent the invitation.
 */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ error?: string; t?: string }> }) {
  const sp = await searchParams;
  const resolved = sp.t ? await resolveInvite(sp.t) : null;
  const invite = resolved?.ok ? resolved.invite : null;
  const problem = invite ? null : PROBLEMS[(resolved && !resolved.ok ? resolved.problem : sp.error && PROBLEMS[sp.error] ? sp.error : "none")];
  const error = invite && sp.error ? ERRORS[sp.error] ?? null : null;
  // First time a personal invitation is opened: let the person who sent it see that it arrived.
  if (invite?.inviteId) await prisma.invite.updateMany({ where: { id: invite.inviteId, status: "SENT" }, data: { status: "OPENED", openedAt: new Date() } });

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1fr_1.05fr]">
      <aside className="brand-panel is-edge relative hidden lg:flex flex-col justify-between p-12 overflow-hidden lg:m-3 lg:rounded-[28px]">
        <CirclesMotif className="pointer-events-none absolute right-[-290px] bottom-[-250px] h-[560px] w-[560px] opacity-70" />
        <div className="relative flex items-center gap-2.5">
          <BrandMark className="h-7 w-auto" />
          <span className="font-display is-small text-[16px]">{APP_NAME}</span>
        </div>

        <div className="relative max-w-[460px]">
          <div className="eyebrow text-stage-muted mb-5">By invitation</div>
          <h1 className="display-wide text-[42px] text-balance">Be in the network for when <span className="text-aurora">the right work</span> comes up.</h1>
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

        <div className="relative max-w-[38ch] text-[12.5px] leading-[1.5] text-stage-muted">Anonymous to clients until you say yes. See, export or delete your data any time.</div>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-10 sm:px-10 text-ink">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="widget relative w-full max-w-[480px] p-6 sm:p-8">
          <span className="beam is-slow" aria-hidden="true" />
          <div className="lg:hidden mb-7">
            <div className="flex items-center gap-2.5 mb-6">
              <BrandMark className="h-6 w-auto text-ink" />
              <span className="font-display is-small text-[17px] text-ink">{APP_NAME}</span>
            </div>
            <h1 className="font-display text-[27px] leading-[1.12]">Be in the network for when the right work comes up.</h1>
            <p className="text-[13.5px] text-ink-muted mt-2 leading-[1.55]">Create your account, have a {SCREENING_MINUTES}-minute screening, and you&apos;re on the radar — fractional, contract or permanent.</p>
          </div>
          {invite ? (
            <>
              <div className="hidden lg:block">
                <h2 className="font-display text-[28px] leading-[1.1]">Create your account</h2>
                <p className="text-[14.5px] text-ink-muted mt-2.5">Step 1 of 3 · about two minutes</p>
              </div>
              <JoinForm inviteToken={sp.t!} invitedBy={invite.inviter ? `${invite.inviter.firstName} ${invite.inviter.lastName}` : null} network={invite.networkName} prefill={invite.prefill} claiming={!!invite.claimPersonId} error={error} />
            </>
          ) : (
            <div className="widget p-7 sm:p-8">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted ring-1 ring-line"><MailQuestion className="h-5 w-5 text-ink-muted" /></span>
              <h2 className="font-display text-[24px] leading-[1.15] mt-5">{problem!.title}</h2>
              <p className="text-[14.5px] text-ink-muted mt-2.5 leading-[1.55]">{problem!.detail}</p>
              <a href="/login" className="mt-6 inline-flex h-11 items-center rounded-full bg-navy px-5 text-[14px] font-semibold text-white hover:bg-navy-600 dark:text-canvas">Sign in instead</a>
            </div>
          )}
          <div className="text-[12px] text-ink-faint mt-5 text-center">Already a member? <a href="/login" className="text-ink-muted hover:text-ink underline underline-offset-2">Sign in</a></div>
        </div>
      </main>
    </div>
  );
}
