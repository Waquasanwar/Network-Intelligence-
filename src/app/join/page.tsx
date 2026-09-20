import { prisma } from "@/lib/db";
import { Input, Select, Field, Checkbox } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { registerMember } from "@/server/actions/members";
import { SCREENING_MINUTES } from "@/lib/screening";
import { fullName } from "@/lib/utils";

export const metadata = { title: "Join the network" };
export const dynamic = "force-dynamic";

/** Public, invitation-only registration. A member must have invited you. */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ error?: string; ref?: string }> }) {
  const sp = await searchParams;
  const members = await prisma.person.findMany({ where: { memberSince: { not: null } }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" }, take: 300 });
  const error = sp.error === "exists" ? "There is already a login for that email. Sign in instead." : sp.error === "referrer" ? "Choose the member who invited you." : sp.error === "consent" ? "Please confirm you understand how your profile is shared." : null;
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="ambient" aria-hidden="true" />
      <div className="relative max-w-[1100px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
        <div className="rounded-[26px] p-10 text-white bg-[radial-gradient(900px_500px_at_10%_0%,#163a52_0%,#0b1226_60%)] shadow-[var(--shadow-card)] min-h-[520px] flex flex-col">
          <div className="flex items-center gap-2.5"><span className="h-7 w-7 rounded-[7px] bg-white text-navy text-[11px] font-semibold inline-flex items-center justify-center">NI</span><span className="text-[13px] font-medium">Network Intelligence</span></div>
          <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/55 mt-10">Invitation only</div>
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] mt-2">Known. Not just matched.</h1>
          <p className="text-white/72 text-[15px] leading-6 mt-4 max-w-[52ch]">A referral network of people who know people. You join by invitation, do one real screening conversation, and from then on you are on the radar for work that suits you, and you can put your name behind people you trust.</p>
          <ul className="mt-7 space-y-3">{[["One screening, 30 minutes.", `Your story, expertise, availability, work rights and how you work. About ${SCREENING_MINUTES} minutes.`], ["Anonymous until you say yes.", "Clients see a capability card, never your name."], ["Trust, built by people.", "Every person who vouches for you adds to your trust score."], ["Refer and be referred.", "Pitch for opportunities, or refer someone you would stand behind."]].map(([b, t]) => <li key={b} className="rounded-[14px] bg-white/[0.07] border border-white/[0.12] px-3.5 py-3 text-[13px] text-white/75"><b className="text-white font-semibold">{b}</b> {t}</li>)}</ul>
          <div className="mt-auto pt-6 text-[12px] text-white/45">{members.length} members in the network · <a href="/login" className="text-white/70 hover:text-white">Already a member? Sign in</a></div>
        </div>
        <div className="rounded-[20px] border border-line bg-surface shadow-[var(--shadow-card)] p-7">
          <h2 className="text-[18px] font-semibold">Register</h2>
          <p className="text-[12.5px] text-ink-muted mt-0.5">Takes a minute. Your screening comes next.</p>
          {error ? <div className="mt-3 rounded-[12px] border border-amber/30 bg-amber-100 px-3 py-2 text-[12.5px]">{error}</div> : null}
          <form action={registerMember} className="mt-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-3"><Field label="First name" required><Input name="firstName" required /></Field><Field label="Last name" required><Input name="lastName" required /></Field></div>
            <Field label="Email" required><Input name="email" type="email" required /></Field>
            <Field label="Password" required hint="At least 8 characters. This is your login."><Input name="password" type="password" required minLength={8} /></Field>
            <Field label="What you are known for"><Input name="headline" placeholder="One line" /></Field>
            <Field label="LinkedIn profile" hint="Optional. We can import recommendations from here."><Input name="linkedinUrl" placeholder="https://linkedin.com/in/…" /></Field>
            <Field label="Who invited you?" required hint="Only members can invite. If you were not invited, ask the person who told you about us."><Select name="referrerId" defaultValue={sp.ref ?? ""} required><option value="">— choose —</option>{members.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}</Select></Field>
            <Checkbox name="consent" label="I understand my profile is anonymous to clients until I consent to an introduction" defaultChecked />
            <SubmitButton className="w-full" pendingText="Registering…">Register and start screening</SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
