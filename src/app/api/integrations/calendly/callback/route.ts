import { NextResponse } from "next/server";
import { getUser } from "@/server/session";
import { isInternal } from "@/lib/authz";
import { checkOauthState } from "@/lib/secrets";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!isInternal(user)) return NextResponse.redirect(new URL("/forbidden", req.url));
  const url = new URL(req.url);
  // The authorisation must have been started by this same user, moments ago.
  if (!checkOauthState(url.searchParams.get("state"), user.id, "CALENDLY")) return NextResponse.redirect(new URL("/settings/integrations?error=calendly", req.url));
  const code = url.searchParams.get("code");
  if (!code || !process.env.CALENDLY_CLIENT_ID || !process.env.CALENDLY_CLIENT_SECRET) return NextResponse.redirect(new URL("/settings/integrations?error=calendly", req.url));
  const res = await fetch("https://auth.calendly.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.CALENDLY_CLIENT_ID, client_secret: process.env.CALENDLY_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: `${process.env.AUTH_URL ?? url.origin}/api/integrations/calendly/callback` }),
  });
  if (!res.ok) return NextResponse.redirect(new URL("/settings/integrations?error=calendly", req.url));
  const token = (await res.json()) as { owner?: string };
  await prisma.schedulingConnection.upsert({
    where: { userId_provider: { userId: user.id, provider: "CALENDLY" } },
    create: { userId: user.id, provider: "CALENDLY", externalAccountId: token.owner ?? null, scopes: ["default"], encryptedCredentialReference: `kms://scheduling/${user.id}/calendly` },
    update: { revokedAt: null, connectedAt: new Date(), externalAccountId: token.owner ?? null, encryptedCredentialReference: `kms://scheduling/${user.id}/calendly` },
  });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "integration.connect", entityType: "SchedulingConnection", metadata: { provider: "CALENDLY", live: true } });
  return NextResponse.redirect(new URL("/settings/integrations", req.url));
}
