import { prisma } from "@/lib/db";
import { JoinForm } from "@/components/domain/join-form";
import { parseInvite } from "@/lib/invite";
import { SCREENING_MINUTES } from "@/lib/screening";

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
      <aside className="brand-panel relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        {/* The same constellation as sign-in, pushed to the far edge so it frames the copy rather than competing with it. */}
        <svg viewBox="0 0 300 620" preserveAspectRatio="xMaxYMid meet" className="pointer-events-none absolute right-0 top-0 h-full w-[46%] opacity-70" aria-hidden="true">
          {([[232, 96, 150, 188], [150, 188, 248, 300], [150, 188, 92, 318], [248, 300, 176, 428], [92, 318, 176, 428], [176, 428, 256, 536]] as const).map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 2 ? "rgba(255,255,255,0.16)" : "rgba(180,182,230,0.5)"} strokeWidth={i % 2 ? 1 : 1.4} strokeDasharray={i % 2 ? "3 5" : undefined} />
          ))}
          {([[232, 96, 4.5, false], [150, 188, 6.5, true], [248, 300, 5, false], [92, 318, 4, false], [176, 428, 6, true], [256, 536, 4.5, false]] as const).map(([cx, cy, r, strong], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r + 7} fill={strong ? "rgba(180,182,230,0.14)" : "rgba(255,255,255,0.05)"} />
              <circle cx={cx} cy={cy} r={r} fill={strong ? "#c8caf0" : "rgba(255,255,255,0.6)"} />
            </g>
          ))}
        </svg>
        <div className="relative flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-[9px] bg-white/95 text-[#2b2d55] text-[12px] font-semibold inline-flex items-center justify-center">NI</span>
          <span className="text-[14px] font-medium">Network Intelligence</span>
        </div>

        <div className="relative max-w-[460px]">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45 mb-3">By invitation</div>
          <h1 className="font-display text-[42px] leading-[1.04] font-semibold tracking-[-0.035em]">Be in the network for when <span className="hl">the right work</span> comes up.</h1>
          <p className="mt-4 text-white/60 text-[14px] leading-[1.6] max-w-[44ch]">We place people we actually know. Join once, and when something fits we already know who you are and why we&apos;d put our name behind you.</p>

          <ol className="mt-9 relative">
            <span aria-hidden="true" className="absolute left-[13px] top-3 bottom-8 w-px bg-[linear-gradient(180deg,rgba(200,202,240,0.7),rgba(200,202,240,0.12))]" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
                <span className={`relative z-[1] mt-0.5 h-[27px] w-[27px] flex-none rounded-full inline-flex items-center justify-center text-[12px] font-semibold ${i === 0 ? "bg-white text-[#2b2d55] shadow-[0_0_0_5px_rgba(255,255,255,0.12)]" : "bg-[#2a2c52] text-white/80 ring-1 ring-white/25"}`}>{i + 1}</span>
                <span>
                  <span className="block text-[15px] font-medium">{s.title}</span>
                  <span className="block text-[13px] text-white/55 leading-[1.55] mt-0.5 max-w-[40ch]">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative text-[12px] text-white/40">Anonymous to clients until you say yes · See, export or delete your data any time</div>
      </aside>

      <main className="relative flex items-center justify-center px-5 py-10 sm:px-10 bg-canvas text-ink">
        <div className="ambient" aria-hidden="true" />
        <div className="w-full max-w-[440px] relative z-[1]">
          <div className="lg:hidden mb-7">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="h-8 w-8 rounded-[9px] bg-navy text-white text-[12px] font-semibold inline-flex items-center justify-center">NI</span>
              <span className="text-[14px] font-medium text-ink">Network Intelligence</span>
            </div>
            <h1 className="text-[26px] leading-[1.1] font-semibold tracking-[-0.03em]">Be in the network for when the right work comes up.</h1>
            <p className="text-[13.5px] text-ink-muted mt-2 leading-[1.55]">Create your account, have a {SCREENING_MINUTES}-minute screening, and you&apos;re on the radar — fractional, contract or permanent.</p>
          </div>
          <div className="hidden lg:block">
            <h2 className="text-[24px] font-semibold tracking-[-0.025em]">Create your account</h2>
            <p className="text-[13.5px] text-ink-muted mt-1.5">Step 1 of 3 · about two minutes</p>
          </div>
          <JoinForm members={members} referrer={referrer} tenantInvite={tenantInvite} inviteToken={inviteToken} error={error} />
          <div className="text-[11.5px] text-ink-faint mt-5 text-center">Already a member? <a href="/login" className="text-ink-muted hover:text-ink underline underline-offset-2">Sign in</a></div>
        </div>
      </main>
    </div>
  );
}
