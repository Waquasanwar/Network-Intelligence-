import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { totpStep, hashRecoveryCode } from "@/lib/mfa";
import { unseal } from "@/lib/secrets";
import { rateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({ email: z.string().email().max(200), password: z.string().min(8).max(200), code: z.string().max(40).optional() });

/** Ten wrong passwords in a row locks the account for fifteen minutes. */
const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60_000;
// Compared against when the email is unknown, so a missing account takes as long as a wrong password.
const DUMMY_HASH = "$2b$12$cWpJd7C1QHzO2U5xXpl7A.2P/8dAC3oCtC2paA2Gnlfi1OmaPC1Wa";

async function failed(user: { id: string; tenantId: string; failedLogins: number }, reason: string) {
  const n = user.failedLogins + 1;
  const lock = n >= MAX_FAILURES;
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: lock ? 0 : n, lockedUntil: lock ? new Date(Date.now() + LOCK_MS) : undefined } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "auth.login_failed", entityType: "User", entityId: user.id, metadata: { reason, locked: lock } });
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Email and password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        // Per-account throttle, on top of the per-address one in the sign-in action and middleware:
        // it holds even when guesses are spread across many addresses.
        if (!(await rateLimit("signin", `acct:${email}`)).success) return null;
        const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
        if (!user?.passwordHash) { await compare(parsed.data.password, DUMMY_HASH); return null; }
        if (user.lockedUntil && user.lockedUntil > new Date()) { await compare(parsed.data.password, DUMMY_HASH); return null; }
        if (!(await compare(parsed.data.password, user.passwordHash))) return failed(user, "password");

        // Second factor: when MFA is on, a valid authenticator code (or a one-time recovery code)
        // is required. No code, wrong code → no session, exactly as a wrong password.
        let mfaLastStep: number | undefined;
        if (user.mfaEnabled) {
          const code = (parsed.data.code ?? "").trim();
          if (!code) return null; // the form then asks for the code; not counted as a failure
          const secret = unseal("mfa", user.mfaSecret);
          const step = secret ? totpStep(user.email, secret, code) : null;
          if (step !== null) {
            if (user.mfaLastStep !== null && step <= user.mfaLastStep) return failed(user, "mfa_replay");
            mfaLastStep = step;
          } else {
            // Spend the recovery code atomically: of two simultaneous sign-ins, only one succeeds.
            const h = hashRecoveryCode(code);
            if (!user.mfaRecoveryCodes.includes(h)) return failed(user, "mfa");
            const spent = await prisma.user.updateMany({ where: { id: user.id, mfaRecoveryCodes: { has: h } }, data: { mfaRecoveryCodes: user.mfaRecoveryCodes.filter((x) => x !== h) } });
            if (spent.count !== 1) return failed(user, "mfa");
          }
        }
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null, ...(mfaLastStep !== undefined ? { mfaLastStep } : {}) } });
        await audit({ tenantId: user.tenantId, actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
          tenantType: user.tenant.type,
          tenantName: user.tenant.brandName ?? user.tenant.name,
          sv: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /** Single sign-on only ever maps onto a user the owner has already provisioned; it never
     *  creates an account or a tenant. Refused here, before any session is issued. */
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;
      if (!user.email) return false;
      const existing = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() }, select: { id: true, role: true } });
      // Members, partners and clients sign in with their own password; SSO is for the internal team.
      return !!existing && ["OWNER", "ADMIN", "CONTRIBUTOR"].includes(existing.role);
    },
    async jwt({ token, user, account }) {
      const base = authConfig.callbacks.jwt({ token, user } as never) as typeof token;
      if (account && account.provider !== "credentials" && token.email) {
        const u = await prisma.user.findUnique({ where: { email: token.email.toLowerCase() }, include: { tenant: true } });
        if (u) {
          base.sub = u.id;
          base.tenantId = u.tenantId;
          base.role = u.role;
          base.tenantType = u.tenant.type;
          base.tenantName = u.tenant.brandName ?? u.tenant.name;
          base.sv = u.sessionVersion;
          await prisma.user.update({ where: { id: u.id }, data: { lastLoginAt: new Date() } });
          await audit({ tenantId: u.tenantId, actorId: u.id, action: "auth.login", entityType: "User", entityId: u.id, metadata: { sso: account.provider } });
        }
      }
      return base;
    },
  },
});
