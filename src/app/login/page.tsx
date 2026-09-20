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

  async function login(formData: FormData) {
    "use server";
    const requested = String(formData.get("callbackUrl") || "/");
    const email = String(formData.get("email") || "").toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
    const home = existing?.role === "PARTNER" ? "/partner-portal" : existing?.role === "CLIENT" ? "/client-workspace" : existing?.role === "MEMBER" ? "/member" : "/overview";
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

  // The thread: a network drawn from real relationships. Positions are hand-placed so it reads as a path, not a graph blob.
  const nodes = [
    { x: 70, y: 260, r: 7, label: "You", strong: true },
    { x: 190, y: 170, r: 6, label: "Sarah" },
    { x: 310, y: 215, r: 6, label: "Ben" },
    { x: 210, y: 340, r: 6, label: "Daniel" },
    { x: 340, y: 390, r: 6, label: "Hannah" },
    { x: 430, y: 275, r: 6, label: "Priya", teal: true },
    { x: 530, y: 190, r: 5, label: "" },
    { x: 550, y: 360, r: 5, label: "" },
  ];
  const edges: [number, number, boolean?][] = [[0, 1, true], [1, 2], [0, 3], [3, 4], [1, 5, true], [5, 6], [5, 7], [4, 7]];

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-[48%] bg-rail text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="flex items-center gap-2.5 relative z-10">
          <span className="h-7 w-7 rounded-[7px] bg-white text-navy text-[11px] font-semibold inline-flex items-center justify-center">NI</span>
          <span className="text-[13px] font-medium">Network Intelligence</span>
        </div>
        <svg viewBox="0 0 600 520" preserveAspectRatio="xMidYMid meet" className="absolute left-0 right-0 top-[8%] h-[46%] w-full opacity-90" aria-hidden="true">
          {edges.map(([a, b, strong], i) => (
            <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={strong ? "#5eead4" : "rgba(255,255,255,0.28)"} strokeWidth={strong ? 1.5 : 1} strokeDasharray={strong ? undefined : "3 4"} />
          ))}
          {nodes.map((n, i) => (
            <g key={i}>
              <circle cx={n.x} cy={n.y} r={n.r + 6} fill={n.teal ? "rgba(94,234,212,0.15)" : "rgba(255,255,255,0.08)"} />
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.strong ? "#ffffff" : n.teal ? "#5eead4" : "rgba(255,255,255,0.75)"} />
              {n.label ? <text x={n.x + 14} y={n.y + 4} fontSize="12" fill="rgba(255,255,255,0.7)" fontFamily="var(--font-geist-sans)">{n.label}</text> : null}
            </g>
          ))}
        </svg>
        <div className="relative z-10">
          <h1 className="text-[44px] font-semibold tracking-[-0.03em] leading-[1.05]">Known.<br />Not just matched.</h1>
          <p className="mt-5 text-white/70 text-[14px] max-w-md leading-6">
            Who do we genuinely know who could solve this problem, why do we trust them, and how quickly can we start the right conversation?
          </p>
        </div>
        <div className="text-[12px] text-white/45 relative z-10">Human-led. AI-enhanced. The relationship intelligence is the asset.</div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8 bg-canvas relative overflow-hidden">
        <div className="ambient" aria-hidden="true" />
        <div className="w-full max-w-[400px] relative z-[1] rounded-[22px] border border-line bg-surface/85 backdrop-blur-xl shadow-[var(--shadow-drawer)] p-8 anim-pop">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Sign in</h2>
          <p className="text-[13px] text-ink-muted mt-1">Access is provisioned by the platform owner.</p>
          {sp.error ? <div className="mt-4 rounded-md border border-risk/25 bg-risk-100 px-3 py-2 text-[12.5px] text-risk">Email or password was not recognised.</div> : null}
          <form action={login} className="mt-6 space-y-4">
            <input type="hidden" name="callbackUrl" value={sp.callbackUrl ?? "/"} />
            <Field label="Email" required><Input name="email" type="email" autoComplete="email" required placeholder="you@company.com" className="h-9" /></Field>
            <Field label="Password" required><Input name="password" type="password" autoComplete="current-password" required minLength={8} className="h-9" /></Field>
            <Button type="submit" size="lg" className="w-full rounded-full">Continue</Button>
          </form>
          {hasEntra ? (
            <form action={loginEntra} className="mt-3">
              <Button type="submit" variant="secondary" size="lg" className="w-full">Continue with Microsoft</Button>
            </form>
          ) : null}
          {process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "true" ? (
            <div className="mt-8 rounded-lg border border-line bg-surface p-3.5 text-[11.5px] text-ink-muted leading-5">
              <div className="font-medium text-ink mb-1">Demo accounts</div>
              <div className="grid grid-cols-[1fr_auto] gap-x-3">
                <span className="mono">waqas@networkintelligence.local</span><span>Owner</span>
                <span className="mono">richard@amana.local</span><span>Amana contributor</span>
                <span className="mono">partner@harboursearch.local</span><span>Partner (restricted)</span>
                <span className="mono">client@meridian.local</span><span>Client (restricted)</span>
              </div>
              <div className="mt-1.5">Password <span className="mono">Password123!</span></div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
