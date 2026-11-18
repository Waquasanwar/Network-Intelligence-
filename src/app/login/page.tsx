import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Input, Field } from "@/components/ui/form";
import { Button, ArrowBadge } from "@/components/ui/button";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { entraIsPinned } from "@/auth.config";
import { BrandMark } from "@/components/ui/brand-mark";
import { APP_NAME } from "@/lib/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CirclesMotif } from "@/components/ui/circles-motif";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string; registered?: string; expired?: string }> }) {
  const sp = await searchParams;
  const hasEntra = entraIsPinned();
  const showDemo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "true";

  async function login(formData: FormData) {
    "use server";
    const requested = String(formData.get("callbackUrl") || "/");
    const email = String(formData.get("email") || "").toLowerCase().slice(0, 200);
    // This form posts to the page, not to /api/auth, so the throttle has to live here as well.
    const limited = !(await rateLimit("signin", `ip:${clientIp(await headers())}`)).success;
    if (limited) redirect(`/login?error=throttled`);
    // Only same-site paths are ever followed after sign-in.
    // Land on the right home for the role. This only takes effect after a successful sign-in, so it
    // tells an anonymous caller nothing about whether the address exists.
    const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
    const home = existing?.role === "PARTNER" ? "/partner-portal" : existing?.role === "CLIENT" ? "/client-workspace" : existing?.role === "MEMBER" ? "/member" : "/overview";
    const safe = /^\/(?!\/)[\w\-./?=&%]*$/.test(requested) && requested !== "/" && !requested.startsWith("/login") && !requested.startsWith("/api") ? requested : home;
    try {
      await signIn("credentials", { email, password: String(formData.get("password") || ""), code: String(formData.get("code") || ""), redirectTo: safe });
    } catch (err) {
      if (err instanceof AuthError) redirect(`/login?error=invalid&callbackUrl=${encodeURIComponent(safe)}`);
      throw err;
    }
  }

  async function loginEntra() {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: "/" });
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="brand-panel is-edge relative hidden lg:flex flex-col justify-between p-12 overflow-hidden lg:m-3 lg:rounded-[28px]">
        <div className="flex items-center gap-2.5 relative z-10">
          <BrandMark className="h-7 w-auto" />
          <span className="font-display is-small text-[16px]">{APP_NAME}</span>
        </div>
        <CirclesMotif className="pointer-events-none absolute right-[-70px] top-[-80px] h-[430px] w-[430px]" />
        <div className="relative z-10">
          <div className="eyebrow text-stage-muted mb-5">Invitation only</div>
          <h1 className="display-wide text-[56px]">Expertise,<br /><span className="text-aurora">known first hand.</span></h1>
          <p className="mt-6 text-stage-muted text-[16px] max-w-[42ch] leading-[1.55]">A private network of senior consultants. Everyone arrives through someone we know, and holds proofs that other people have put their name to.</p>
        </div>
        <div className="text-[12.5px] text-stage-muted relative z-10">Known first hand. Names private until each person says yes.</div>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-12 sm:px-10">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="widget relative w-full max-w-[420px] p-6 sm:p-8">
          <span className="beam is-slow" aria-hidden="true" />
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <BrandMark className="h-6 w-auto text-ink" />
            <span className="font-display is-small text-[17px] text-ink">{APP_NAME}</span>
          </div>
          <h2 className="font-display text-[30px] leading-[1.1]">Welcome back</h2>
          <p className="text-[15px] text-ink-muted mt-2.5">Sign in to your network.</p>

          {sp.registered ? <div className="mt-5 rounded-[12px] border border-teal/25 bg-teal/5 px-3.5 py-2.5 text-[12.5px] text-ink">Account created. Sign in to start your screening.</div> : null}
          {sp.expired && !sp.error ? <div className="mt-5 rounded-[12px] border border-line bg-surface-muted px-3.5 py-2.5 text-[12.5px] text-ink">You were signed out because your account changed. Sign in again to carry on.</div> : null}
          {sp.error ? <div role="alert" className="mt-5 rounded-[12px] border border-risk/25 bg-risk-100 px-3.5 py-2.5 text-[12.5px] text-risk">{sp.error === "throttled" ? "Too many attempts from this connection. Wait a few minutes, then try again." : "Those details did not match. After ten wrong attempts an account is paused for fifteen minutes."}</div> : null}

          <form action={login} className="mt-7 space-y-3.5">
            <input type="hidden" name="callbackUrl" value={sp.callbackUrl ?? "/"} />
            <Field label="Email" required><Input name="email" type="email" autoComplete="email" required placeholder="you@company.com" className="h-10" /></Field>
            <Field label="Password" required><Input name="password" type="password" autoComplete="current-password" required minLength={8} className="h-10" /></Field>
            <details className="group"><summary className="cursor-pointer list-none text-[12.5px] font-medium text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">I use an authenticator app</summary><div className="mt-2"><Field label="Authentication code" hint="The 6-digit code from your authenticator app, or a recovery code."><Input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" className="h-10" /></Field></div></details>
            <Button type="submit" size="lg" className="w-full mt-2">Sign in <ArrowBadge /></Button>
          </form>
          {hasEntra ? (
            <>
              <div className="flex items-center gap-3 my-4"><span className="h-px flex-1 bg-line" /><span className="text-[12px] text-ink-faint">or</span><span className="h-px flex-1 bg-line" /></div>
              <form action={loginEntra}><Button type="submit" variant="secondary" size="lg" className="w-full">Continue with Microsoft</Button></form>
            </>
          ) : null}

          {showDemo ? (
            <div className="mt-6 rounded-[12px] border border-line bg-surface/60 p-3.5 text-[12px] text-ink-muted leading-5">
              <div className="font-medium text-ink mb-1.5">Demo accounts · password <span className="mono">Password123!</span></div>
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                <span className="mono">waqas@networkintelligence.local</span><span>Owner</span>
                <span className="mono">partner@harboursearch.local</span><span>Partner</span>
                <span className="mono">client@meridian.local</span><span>Client</span>
              </div>
            </div>
          ) : null}

          <div className="text-[12px] text-ink-faint mt-6">Invitation only · <a href="/join" className="text-ink-muted hover:text-ink">Have an invite? Join the network</a></div>
        </div>
      </main>
    </div>
  );
}
