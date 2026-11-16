import type { NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { Role, TenantType } from "@prisma/client";

/**
 * Edge-safe Auth.js configuration (no database imports) shared by the middleware.
 * The full configuration with the credentials provider lives in auth.ts.
 */
/** True when Entra sign-in is configured against one specific directory. */
export function entraIsPinned(): boolean {
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "";
  return !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID && /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]{36}\/v2\.0\/?$/i.test(issuer);
}

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h absolute lifetime; requireUser() re-checks User.sessionVersion on every request
  providers: [
    // Single sign-on is only switched on against one named Entra tenant. The shared "common",
    // "organizations" and "consumers" issuers accept accounts from any directory, where the email
    // claim is set by that directory's admin — so they could be used to sign in as someone else.
    ...(entraIsPinned()
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
          }),
        ]
      : []),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic = pathname === "/login" || pathname.startsWith("/api/auth") || pathname === "/join" || pathname.startsWith("/api/webhooks") || pathname.startsWith("/api/cron") || pathname === "/api/health";
      if (isPublic) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.tenantType = user.tenantType;
        token.tenantName = user.tenantName;
        token.sv = user.sv ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as Role;
        session.user.tenantType = token.tenantType as TenantType;
        session.user.tenantName = token.tenantName as string;
        session.user.sv = (token.sv as number | undefined) ?? 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
