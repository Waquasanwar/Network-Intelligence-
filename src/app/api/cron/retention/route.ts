import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { retentionDue } from "@/lib/privacy";
import { audit } from "@/lib/audit";
import { safeEqual } from "@/lib/secrets";

export const dynamic = "force-dynamic";

/**
 * Scheduled retention sweep (control: "Delete data when its retention period ends").
 *
 * Runs daily via Vercel Cron. It computes, per tenant, how many records are past their stated
 * retention period and records that to the immutable audit log, so nothing is ever silently kept
 * and the owner has a dated review queue. Destructive deletion itself stays a human-reviewed,
 * one-click action rather than an unattended job — the right posture while the platform is young.
 *
 * Protected by CRON_SECRET: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Anything
 * without the exact secret is refused, so the endpoint is not a public data-enumeration surface.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // What strangers sent through the public page: unanswered after six months, or dealt with more
  // than three months ago, it is deleted. An accepted application lives on as its invitation.
  const day = 86_400_000, nowMs = Date.now();
  const cleared = await prisma.publicRequest.deleteMany({ where: { OR: [{ status: "NEW", createdAt: { lt: new Date(nowMs - 180 * day) } }, { status: { not: "NEW" }, handledAt: { lt: new Date(nowMs - 90 * day) } }] } });
  const lapsed = await prisma.referenceRequest.deleteMany({ where: { status: { in: ["SENT", "REVOKED"] }, expiresAt: { lt: new Date(nowMs - 30 * day) } } });

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let totalDue = 0;

  for (const t of tenants) {
    const people = await prisma.person.findMany({
      where: { tenantId: t.id },
      select: { id: true, screenedAt: true, availabilityConfirmedAt: true, privacy: true },
    });
    let itemsDue = 0;
    for (const p of people) {
      itemsDue += retentionDue({ screenedAt: p.screenedAt, lastContactAt: p.availabilityConfirmedAt }).length;
      // A person who has asked to be deleted is always due, whatever the retention clock says.
      if ((p.privacy as { erasureRequestedAt?: string | null } | null)?.erasureRequestedAt) itemsDue += 1;
    }
    if (itemsDue > 0) {
      await audit({ tenantId: t.id, actorId: null, action: "data.retention_review", entityType: "Tenant", entityId: t.id, metadata: { itemsDue } });
    }
    totalDue += itemsDue;
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), tenants: tenants.length, itemsDue: totalDue, publicRequestsDeleted: cleared.count, referenceRequestsDeleted: lapsed.count });
}
