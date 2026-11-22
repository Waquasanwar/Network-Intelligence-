import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Input, Field } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { Constellation } from "@/components/ui/constellation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { entraIsPinned } from "@/auth.config";
import { BrandMark } from "@/components/ui/brand-mark";
import { APP_NAME } from "@/lib/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* The brand: the network, live. Introductions (coral) travel to the people they reach (mint). */}
      <aside className="stage-ink flex min-h-[320px] flex-col justify-between gap-10 px-6 py-7 sm:px-10 sm:py-9 lg:min-h-screen lg:px-14 lg:py-12">
        <Constellation focus={0.7} />
        <span className="stage-scrim" aria-hidden="true" />
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-7 w-auto text-white" />
          <span className="font-display text-[17px]">{APP_NAME}</span>
        </div>
        <div className="max-w-[580px]">
          <h1 className="hero-title text-[44px] sm:text-[60px] lg:text-[80px]">Known<br /><span className="text-mint">first hand.</span></h1>
          <p className="mt-6 max-w-[44ch] text-[16px] leading-[1.6] stage-muted">A private network of senior consultants across the Gulf and London. Everyone arrives through someone we know, and carries proofs other people have put their name to.</p>
        </div>
        <div className="hidden lg:block">
          <div className="stage-card max-w-[440px] p-5" aria-label="An example of what a client sees">
            <div className="flex items-center gap-3.5">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[#1d3a75] text-[13px] font-semibold text-white/80" aria-hidden="true">· ·</span>
              <span className="min-w-0 flex-1">
                <span className="block h-3 w-36 rounded-full bg-white/20" role="img" aria-label="Name hidden until they say yes" />
                <span className="mt-2 block text-[13.5px] stage-muted">Interim CFO · energy · Dubai · <span className="text-mint">open to work</span></span>
              </span>
              <span className="text-right"><b className="figure-num block text-[28px]">72</b><span className="text-[11.5px] stage-faint">trusted</span></span>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["Introduced by someone we know", "Screened", "Vouched for by 3"].map((t) => <span key={t} className="inline-flex items-center gap-1.5 rounded-full border on-stage-line px-2.5 py-1 text-[12px] text-white/85"><Check className="h-3 w-3 text-mint" strokeWidth={3} aria-hidden="true" />{t}</span>)}
            </div>
          </div>
          <p className="mt-5 max-w-[44ch] text-[13px] stage-faint">What a client sees: the proofs, never the name, until that person says yes.</p>
        </div>
      </aside>

      <main className="relative flex items-center justify-center px-5 py-12 sm:px-10">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="w-full max-w-[400px]">
          <h2 className="hero-title text-[34px] sm:text-[38px]">Welcome back</h2>
          <p className="mt-2.5 text-[15px] text-ink-muted">Sign in to your network.</p>

          {sp.registered ? <div className="mt-6 rounded-[12px] border border-teal/25 bg-teal-50 px-3.5 py-2.5 text-[13px] text-ink">Account created. Sign in to start your screening.</div> : null}
          {sp.expired && !sp.error ? <div className="mt-6 rounded-[12px] border border-line bg-surface-muted px-3.5 py-2.5 text-[13px] text-ink">You were signed out because your account changed. Sign in again to carry on.</div> : null}
          {sp.error ? <div role="alert" className="mt-6 rounded-[12px] border border-risk/25 bg-risk-100 px-3.5 py-2.5 text-[13px] text-risk">{sp.error === "throttled" ? "Too many attempts from this connection. Wait a few minutes, then try again." : "Those details did not match. After ten wrong attempts an account is paused for fifteen minutes."}</div> : null}

          <form action={login} className="mt-8 space-y-4">
            <input type="hidden" name="callbackUrl" value={sp.callbackUrl ?? "/"} />
            <Field label="Email" required><Input name="email" type="email" autoComplete="email" required placeholder="you@company.com" className="h-11 text-[15px]" /></Field>
            <Field label="Password" required><PasswordInput name="password" autoComplete="current-password" required minLength={8} className="h-11 text-[15px]" /></Field>
            <details className="group"><summary className="cursor-pointer list-none text-[13px] font-medium text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">I use an authenticator app</summary><div className="mt-2.5"><Field label="Authentication code" hint="The 6-digit code from your authenticator app, or a recovery code."><Input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" className="h-11" /></Field></div></details>
            <button type="submit" className="btn-mint mt-2 h-12 w-full text-[15px]">Sign in <ArrowRight className="h-4 w-4" /></button>
          </form>
          {hasEntra ? (
            <>
              <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="text-[12px] text-ink-faint">or</span><span className="h-px flex-1 bg-line" /></div>
              <form action={loginEntra}><Button type="submit" variant="secondary" size="lg" className="w-full">Continue with Microsoft</Button></form>
            </>
          ) : null}

          {showDemo ? (
            <div className="mt-8 rounded-[14px] border border-dashed border-line-strong p-3.5 text-[12px] leading-5 text-ink-muted">
              <div className="mb-1.5 font-medium text-ink">Demo accounts · password <span className="mono">Password123!</span></div>
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                <span className="mono">waqas@networkintelligence.local</span><span>Owner</span>
                <span className="mono">partner@harboursearch.local</span><span>Agency</span>
                <span className="mono">client@meridian.local</span><span>Client</span>
              </div>
            </div>
          ) : null}

          <p className="mt-8 text-[13px] text-ink-faint">Membership is by invitation. <a href="/join" className="font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline">Have an invite? Join the network</a></p>
        </div>
      </main>
    </div>
  );
}
