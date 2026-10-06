import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { verifyTotp, consumeRecoveryCode } from "@/lib/mfa";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(200), code: z.string().max(40).optional() });

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
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() }, include: { tenant: true } });
        if (!user?.passwordHash) return null;
        const ok = await compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        // Second factor: when MFA is on, a valid authenticator code (or a one-time recovery code)
        // is required. No code, wrong code → no session, exactly as a wrong password.
        if (user.mfaEnabled) {
          const code = (parsed.data.code ?? "").trim();
          if (!code) return null;
          const totpOk = user.mfaSecret ? verifyTotp(user.email, user.mfaSecret, code) : false;
          if (!totpOk) {
            const remaining = consumeRecoveryCode(code, user.mfaRecoveryCodes);
            if (remaining === null) return null;
            await prisma.user.update({ where: { id: user.id }, data: { mfaRecoveryCodes: remaining } });
          }
        }
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await audit({ tenantId: user.tenantId, actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
          tenantType: user.tenant.type,
          tenantName: user.tenant.brandName ?? user.tenant.name,
        };
      },
    }),
  ],
  events: {
    async signIn({ user, account }) {
      // OIDC sign-ins must map to a provisioned user; we never auto-create tenants from SSO.
      if (account?.provider !== "credentials" && user.email) {
        const existing = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
        if (!existing) throw new Error("User is not provisioned on this platform");
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
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
        }
      }
      return base;
    },
  },
});
