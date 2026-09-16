import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

/**
 * OAuth callback for Microsoft Graph. Exchanges the code and stores only a reference to the
 * credential; the token itself belongs in the platform's secret store (KMS) in production.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", req.url));
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code || !process.env.MICROSOFT_GRAPH_CLIENT_ID || !process.env.MICROSOFT_GRAPH_CLIENT_SECRET) return NextResponse.redirect(new URL("/settings/integrations?error=microsoft", req.url));
  const tenant = process.env.MICROSOFT_GRAPH_TENANT_ID || "common";
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.MICROSOFT_GRAPH_CLIENT_ID, client_secret: process.env.MICROSOFT_GRAPH_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: `${process.env.AUTH_URL ?? url.origin}/api/integrations/microsoft/callback` }),
  });
  if (!res.ok) return NextResponse.redirect(new URL("/settings/integrations?error=microsoft", req.url));
  const token = (await res.json()) as { scope?: string };
  await prisma.schedulingConnection.upsert({
    where: { userId_provider: { userId: session.user.id, provider: "MICROSOFT_GRAPH" } },
    create: { userId: session.user.id, provider: "MICROSOFT_GRAPH", scopes: token.scope?.split(" ") ?? [], encryptedCredentialReference: `kms://scheduling/${session.user.id}/microsoft` },
    update: { revokedAt: null, scopes: token.scope?.split(" ") ?? [], connectedAt: new Date(), encryptedCredentialReference: `kms://scheduling/${session.user.id}/microsoft` },
  });
  await audit({ tenantId: session.user.tenantId, actorId: session.user.id, action: "integration.connect", entityType: "SchedulingConnection", metadata: { provider: "MICROSOFT_GRAPH", live: true } });
  return NextResponse.redirect(new URL("/settings/integrations", req.url));
}
