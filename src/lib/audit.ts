import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "person.create"
  | "person.update"
  | "person.export"
  | "relationship.create"
  | "evidence.create"
  | "conversation.create"
  | "conversation.schedule"
  | "conversation.transcript"
  | "summary.generate"
  | "summary.approve"
  | "summary.reject"
  | "opportunity.create"
  | "opportunity.update"
  | "match.generate"
  | "match.decide"
  | "introduction.request"
  | "introduction.approve"
  | "identity.reveal"
  | "partner.requirement"
  | "partner.update"
  | "relocation.update"
  | "integration.connect"
  | "integration.disconnect"
  | "user.role_change"
  | "data.deletion_request"
  | "team.add"
  | "team.remove"
  | "account.create"
  | "brief.create"
  | "brief.update"
  | "brief.search"
  | "brief.status"
  | "brief.terms"
  | "shortlist.decide"
  | "fee.create"
  | "fee.update"
  | "ratecard.update"
  | "portal.brief_submitted"
  | "portal.response"
  | "terms.accept"
  | "vouch.create"
  | "screening.start"
  | "screening.submit"
  | "screening.approve"
  | "referral.create"
  | "referral.update"
  | "pitch.create"
  | "pitch.update"
  | "consent.update"
  | "member.register"
  | "brief.members";

export async function audit(input: {
  tenantId: string;
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (err) {
    // Audit failures must never take down the primary action, but they must be visible.
    console.error("[audit] failed to write audit entry", input.action, err);
  }
}
