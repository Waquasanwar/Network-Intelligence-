import { NextResponse } from "next/server";
import { getUser } from "@/server/session";
import { isInternal } from "@/lib/authz";
import { checkOauthState } from "@/lib/secrets";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

/**
 * OAuth callback for Microsoft Graph. Exchanges the code and stores only a reference to the
 * credential; the token itself belongs in the platform's secret store (KMS) in production.
 */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!isInternal(user)) return NextResponse.redirect(new URL("/forbidden", req.url));
  const url = new URL(req.url);
  // The authorisation must have been started by this same user, moments ago.
  if (!checkOauthState(url.searchParams.get("state"), user.id, "MICROSOFT_GRAPH")) return NextResponse.redirect(new URL("/settings/integrations?error=microsoft", req.url));
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
    where: { userId_provider: { userId: user.id, provider: "MICROSOFT_GRAPH" } },
    create: { userId: user.id, provider: "MICROSOFT_GRAPH", scopes: token.scope?.split(" ") ?? [], encryptedCredentialReference: `kms://scheduling/${user.id}/microsoft` },
    update: { revokedAt: null, scopes: token.scope?.split(" ") ?? [], connectedAt: new Date(), encryptedCredentialReference: `kms://scheduling/${user.id}/microsoft` },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "integration.connect", entityType: "SchedulingConnection", metadata: { provider: "MICROSOFT_GRAPH", live: true } });
  return NextResponse.redirect(new URL("/settings/integrations", req.url));
}
