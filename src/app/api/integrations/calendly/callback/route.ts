import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", req.url));
  const url = new URL(req.url);
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
    where: { userId_provider: { userId: session.user.id, provider: "CALENDLY" } },
    create: { userId: session.user.id, provider: "CALENDLY", externalAccountId: token.owner ?? null, scopes: ["default"], encryptedCredentialReference: `kms://scheduling/${session.user.id}/calendly` },
    update: { revokedAt: null, connectedAt: new Date(), externalAccountId: token.owner ?? null, encryptedCredentialReference: `kms://scheduling/${session.user.id}/calendly` },
  });
  await audit({ tenantId: session.user.tenantId, actorId: session.user.id, action: "integration.connect", entityType: "SchedulingConnection", metadata: { provider: "CALENDLY", live: true } });
  return NextResponse.redirect(new URL("/settings/integrations", req.url));
}
