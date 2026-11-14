import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Input, Field } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string; registered?: string }> }) {
  const sp = await searchParams;
  const hasEntra = Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID);
  const showDemo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "true";

  async function login(formData: FormData) {
    "use server";
    const requested = String(formData.get("callbackUrl") || "/");
    const email = String(formData.get("email") || "").toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
    const home = existing?.role === "PARTNER" ? "/partner-portal" : existing?.role === "CLIENT" ? "/client-workspace" : existing?.role === "MEMBER" ? "/member" : "/overview";
    const callbackUrl = requested === "/" || requested === "/login" ? home : requested;
    try {
      await signIn("credentials", { email, password: String(formData.get("password") || ""), code: String(formData.get("code") || ""), redirectTo: callbackUrl });
    } catch (err) {
      if (err instanceof AuthError) redirect(`/login?error=invalid&callbackUrl=${encodeURIComponent(callbackUrl)}`);
      throw err;
    }
  }

  async function loginEntra() {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: "/" });
  }

  // A network drawn from real relationships — hand-placed so it reads as a path, not a blob.
  const nodes = [
    { x: 70, y: 250, r: 7, label: "You", strong: true },
    { x: 190, y: 160, r: 6, label: "Sarah" },
    { x: 320, y: 210, r: 6, label: "Ben" },
    { x: 205, y: 335, r: 6, label: "Daniel" },
    { x: 345, y: 380, r: 6, label: "Hannah" },
    { x: 440, y: 270, r: 6.5, label: "Priya", accent: true },
    { x: 545, y: 185, r: 5, label: "" },
    { x: 560, y: 355, r: 5, label: "" },
  ];
  const edges: [number, number, boolean?][] = [[0, 1, true], [1, 2], [0, 3], [3, 4], [1, 5, true], [5, 6], [5, 7], [4, 7]];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="brand-panel is-edge relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <div className="flex items-center gap-2.5 relative z-10">
          <span className="h-8 w-8 rounded-[9px] bg-navy text-white text-[12px] font-semibold inline-flex items-center justify-center">NI</span>
          <span className="text-[14px] font-medium">Network Intelligence</span>
        </div>
        <svg viewBox="0 0 620 500" preserveAspectRatio="xMidYMid meet" className="absolute inset-x-0 top-[9%] h-[48%] w-full opacity-90" aria-hidden="true">
          {edges.map(([a, b, strong], i) => (
            <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={strong ? "rgba(47,49,112,0.55)" : "rgba(47,49,112,0.22)"} strokeWidth={strong ? 1.5 : 1} strokeDasharray={strong ? undefined : "3 5"} />
          ))}
          {nodes.map((n, i) => (
            <g key={i}>
              <circle cx={n.x} cy={n.y} r={n.r + 7} fill={n.accent ? "rgba(47,49,112,0.08)" : "rgba(47,49,112,0.05)"} />
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.strong ? "#2f3170" : n.accent ? "#6c6fb6" : "rgba(47,49,112,0.45)"} />
              {n.label ? <text x={n.x + 14} y={n.y + 4} fontSize="12.5" fill="rgba(17,19,39,0.6)" fontFamily="var(--font-sans)">{n.label}</text> : null}
            </g>
          ))}
        </svg>
        <div className="relative z-10">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint mb-3">Invitation only</div>
          <h1 className="font-display text-[40px] leading-[1.06] font-semibold tracking-[-0.035em] text-ink">Known.<br />Not just matched.</h1>
          <p className="mt-5 text-ink-muted text-[14px] max-w-[42ch] leading-[1.6]">Who do we genuinely know who could solve this problem, why do we trust them, and how quickly can we start the right conversation?</p>
        </div>
        <div className="text-[12px] text-ink-faint relative z-10">Human-led. AI-enhanced. The relationship intelligence is the asset.</div>
      </aside>

      <main className="relative flex items-center justify-center px-6 py-12 sm:px-10 bg-canvas">
        <div className="ambient" aria-hidden="true" />
        <div className="w-full max-w-[380px] relative z-[1]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <span className="h-8 w-8 rounded-[9px] bg-navy text-white text-[12px] font-semibold inline-flex items-center justify-center">NI</span>
            <span className="text-[14px] font-medium text-ink">Network Intelligence</span>
          </div>
          <h2 className="text-[26px] font-semibold tracking-[-0.025em]">Welcome back</h2>
          <p className="text-[13.5px] text-ink-muted mt-1.5">Sign in to your network.</p>

          {sp.registered ? <div className="mt-5 rounded-[10px] border border-teal/25 bg-teal/5 px-3.5 py-2.5 text-[12.5px] text-ink">Account created. Sign in to start your screening.</div> : null}
          {sp.error ? <div className="mt-5 rounded-[10px] border border-risk/25 bg-risk-100 px-3.5 py-2.5 text-[12.5px] text-risk">Email or password was not recognised.</div> : null}

          <form action={login} className="mt-7 space-y-3.5">
            <input type="hidden" name="callbackUrl" value={sp.callbackUrl ?? "/"} />
            <Field label="Email" required><Input name="email" type="email" autoComplete="email" required placeholder="you@company.com" className="h-10" /></Field>
            <Field label="Password" required><Input name="password" type="password" autoComplete="current-password" required minLength={8} className="h-10" /></Field>
            <Field label="Authentication code" hint="Only if you've set up MFA — the 6-digit code from your authenticator."><Input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" className="h-10" /></Field>
            <Button type="submit" size="lg" className="w-full mt-1">Sign in</Button>
          </form>
          {hasEntra ? (
            <>
              <div className="flex items-center gap-3 my-4"><span className="h-px flex-1 bg-line" /><span className="text-[11px] text-ink-faint">or</span><span className="h-px flex-1 bg-line" /></div>
              <form action={loginEntra}><Button type="submit" variant="secondary" size="lg" className="w-full">Continue with Microsoft</Button></form>
            </>
          ) : null}

          {showDemo ? (
            <div className="mt-6 rounded-[10px] border border-line bg-surface/60 p-3.5 text-[11.5px] text-ink-muted leading-5">
              <div className="font-medium text-ink mb-1.5">Demo accounts · password <span className="mono">Password123!</span></div>
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                <span className="mono">waqas@networkintelligence.local</span><span>Owner</span>
                <span className="mono">partner@harboursearch.local</span><span>Partner</span>
                <span className="mono">client@meridian.local</span><span>Client</span>
              </div>
            </div>
          ) : null}

          <div className="text-[11.5px] text-ink-faint mt-6">Invitation only · <a href="/join" className="text-ink-muted hover:text-ink">Have an invite? Join the network</a></div>
        </div>
      </main>
    </div>
  );
}
