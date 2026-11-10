import { prisma } from "@/lib/db";
import { JoinForm } from "@/components/domain/join-form";
import { parseInvite } from "@/lib/invite";

export const metadata = { title: "Join the network" };
export const dynamic = "force-dynamic";

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
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <div className="ambient" aria-hidden="true" />
      <main className="relative z-[1] flex-1 flex items-center justify-center px-5 py-12 sm:py-16">
        <div className="w-full max-w-[440px]">
          <div className="flex items-center justify-center gap-2.5 mb-9">
            <span className="h-8 w-8 rounded-[9px] bg-navy text-white text-[12px] font-semibold inline-flex items-center justify-center">NI</span>
            <span className="text-[14px] font-medium text-ink">Network Intelligence</span>
          </div>
          <h1 className="text-center text-[30px] leading-[1.08] font-semibold tracking-[-0.03em]">Be in the network for when the right work comes up.</h1>
          <p className="text-center text-[13.5px] text-ink-muted mt-2.5 leading-[1.55] max-w-[40ch] mx-auto">One short screening and you&apos;re on the radar — fractional, contract or permanent. When a client needs someone like you, we already know you and can make the introduction.</p>
          <JoinForm members={members} referrer={referrer} tenantInvite={tenantInvite} inviteToken={inviteToken} error={error} />
          <div className="flex items-center justify-center gap-2 text-[11.5px] text-ink-faint mt-6">
            <span>Invitation only</span><span className="opacity-40">·</span><span>Anonymous until you consent</span><span className="opacity-40">·</span><a href="/login" className="text-ink-muted hover:text-ink">Sign in</a>
          </div>
        </div>
      </main>
    </div>
  );
}
