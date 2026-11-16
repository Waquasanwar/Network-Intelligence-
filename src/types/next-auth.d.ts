import type { Role, TenantType } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    tenantId?: string;
    role?: Role;
    tenantType?: TenantType;
    tenantName?: string;
    /** User.sessionVersion at sign-in. */
    sv?: number;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      tenantId: string;
      role: Role;
      tenantType: TenantType;
      tenantName: string;
      sv: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId?: string;
    role?: Role;
    tenantType?: TenantType;
    tenantName?: string;
    sv?: number;
  }
}
