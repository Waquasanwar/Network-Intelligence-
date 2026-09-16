import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Input, Field } from "@/components/ui/form";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const sp = await searchParams;
  const hasEntra = Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID);

  async function login(formData: FormData) {
    "use server";
    const requested = String(formData.get("callbackUrl") || "/");
    const email = String(formData.get("email") || "").toLowerCase();
    // Send each role straight to its home so the URL matches what renders (partners and clients never see internal routes).
    const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
    const home = existing?.role === "PARTNER" ? "/partner-portal" : existing?.role === "CLIENT" ? "/client-workspace" : "/overview";
    const callbackUrl = requested === "/" || requested === "/login" ? home : requested;
    try {
      await signIn("credentials", { email, password: String(formData.get("password") || ""), redirectTo: callbackUrl });
    } catch (err) {
      if (err instanceof AuthError) redirect(`/login?error=invalid&callbackUrl=${encodeURIComponent(callbackUrl)}`);
      throw err;
    }
  }

  async function loginEntra() {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: "/" });
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-[46%] bg-navy text-white flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-md bg-white text-navy text-xs font-bold inline-flex items-center justify-center">NI</span>
          <span className="text-sm font-medium">Network Intelligence</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">Known.<br />Not just matched.</h1>
          <p className="mt-4 text-white/70 text-sm max-w-md leading-6">
            Who do we genuinely know who could solve this problem, why do we trust them, and how quickly can we start the right conversation?
          </p>
        </div>
        <div className="text-xs text-white/50">Human-led. AI-enhanced. The relationship intelligence is the asset.</div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="text-lg font-semibold">Sign in</h2>
          <p className="text-[13px] text-ink-muted mt-1">Access is provisioned by the platform owner.</p>
          {sp.error ? <div className="mt-4 rounded-md border border-risk/30 bg-risk-100 px-3 py-2 text-xs text-risk">Email or password was not recognised.</div> : null}
          <form action={login} className="mt-6 space-y-4">
            <input type="hidden" name="callbackUrl" value={sp.callbackUrl ?? "/"} />
            <Field label="Email" required><Input name="email" type="email" autoComplete="email" required placeholder="you@company.com" /></Field>
            <Field label="Password" required><Input name="password" type="password" autoComplete="current-password" required minLength={8} /></Field>
            <Button type="submit" size="lg" className="w-full">Continue</Button>
          </form>
          {hasEntra ? (
            <form action={loginEntra} className="mt-3">
              <Button type="submit" variant="secondary" size="lg" className="w-full">Continue with Microsoft</Button>
            </form>
          ) : null}
          {process.env.NODE_ENV !== "production" ? (
            <div className="mt-8 rounded-md border border-line bg-surface-muted p-3 text-[11px] text-ink-muted leading-5">
              <div className="font-medium text-ink mb-1">Demo accounts (seeded)</div>
              <div>waqas@networkintelligence.local — Owner</div>
              <div>richard@amana.local — Amana contributor</div>
              <div>partner@harboursearch.local — Recruitment partner (restricted)</div>
              <div>client@meridian.local — Direct client (restricted)</div>
              <div className="mt-1">Password: <code>Password123!</code></div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
