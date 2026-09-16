import type { NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { Role, TenantType } from "@prisma/client";

/**
 * Edge-safe Auth.js configuration (no database imports) shared by the middleware.
 * The full configuration with the credentials provider lives in auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h sessions; revocation handled by sessionVersion
  providers: [
    ...(process.env.AUTH_MICROSOFT_ENTRA_ID_ID
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
      const isPublic = pathname === "/login" || pathname.startsWith("/api/auth") || pathname.startsWith("/api/webhooks") || pathname === "/api/health";
      if (isPublic) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.tenantType = user.tenantType;
        token.tenantName = user.tenantName;
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
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
