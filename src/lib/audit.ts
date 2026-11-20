import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "invite.create"
  | "invite.revoke"
  | "invite.reset_link"
  | "person.create"
  | "person.update"
  | "person.enrich"
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
  | "outreach.draft"
  | "introduction.approve"
  | "identity.reveal"
  | "partner.requirement"
  | "partner.update"
  | "relocation.update"
  | "integration.connect"
  | "integration.disconnect"
  | "user.role_change"
  | "data.deletion_request"
  | "data.retention_review"
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
  | "feature.update"
  | "portal.brief_submitted"
  | "portal.response"
  | "terms.accept"
  | "vouch.create"
  | "screening.start"
  | "screening.submit"
  | "screening.auto_accept"
  | "reference.request"
  | "reference.answer"
  | "reference.revoke"
  | "public.apply"
  | "public.need"
  | "public.handle"
  | "screening.approve"
  | "referral.create"
  | "referral.update"
  | "pitch.create"
  | "pitch.update"
  | "consent.update"
  | "member.register"
  | "brief.members"
  | "brief.on_spec"
  | "shortlist.referred"
  | "screening.config"
  | "settings.security"
  | "settings.screening"
  | "board.post"
  | "board.close"
  | "connection.request"
  | "connection.answer"
  | "credit.create"
  | "credit.update"
  | "portal.search"
  | "portal.search_ask"
  | "account.search";

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
