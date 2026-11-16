import "server-only";
import { prisma } from "@/lib/db";
import { isInternal, isMember } from "@/lib/authz";
import { privacyOf } from "@/lib/privacy";
import { DEFAULT_VOICE, type VoiceSettings } from "@/lib/voice-config";
import type { SessionUser } from "@/server/session";

export type VoiceAccess = { ok: true; settings: VoiceSettings } | { ok: false; status: number; error: string; fallback: "device" | "speak" };

/**
 * Who may spend the platform's voice budget, decided on the server.
 *
 *  - the tenant must have chosen the natural voice (a tenant on "this device" sends nothing out);
 *  - internal users, testing or running a screening;
 *  - a member, only while their own screening is open and only if they have switched on
 *    "Let the interviewer speak out loud". Partners and clients never.
 */
export async function voiceAccess(user: SessionUser): Promise<VoiceAccess> {
  const deny = (error: string, status = 403): VoiceAccess => ({ ok: false, status, error, fallback: "device" });
  let tenantId = user.tenantId;
  if (isMember(user)) {
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { person: { select: { id: true, tenantId: true, privacy: true, screeningStatus: true } } } });
    const p = u?.person;
    if (!p) return deny("No member profile.");
    if (!privacyOf({ privacy: p.privacy }).consents.voiceProcessing) return deny("The natural voice is off in your privacy settings. Using the device voice.");
    const open = await prisma.conversation.count({ where: { personId: p.id, type: "SCREENING", approvalStatus: "DRAFT" } });
    if (!open) return deny("No screening in progress.");
    tenantId = p.tenantId;
  } else if (!isInternal(user)) {
    return deny("Not available.");
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { voiceSettings: true } });
  const settings: VoiceSettings = { ...DEFAULT_VOICE, ...((tenant?.voiceSettings as Partial<VoiceSettings> | null) ?? {}) };
  if (settings.provider !== "elevenlabs") return deny("This network uses the device voice.", 503);
  return { ok: true, settings };
}
