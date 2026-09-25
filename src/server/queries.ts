/**
 * Server-side read helpers that pages and actions call directly.
 *
 * These are deliberately NOT in a `"use server"` file. Every exported function in a `"use server"`
 * module is registered by Next.js as a public POST endpoint, callable by any authenticated client
 * with arguments the client controls. That is fine for a form action that re-authorises internally,
 * but it is a cross-tenant data leak for a helper that trusts a `user` or `tenantId` argument passed
 * in by its caller. Living here, they can only be reached through server code that has already
 * resolved and authorised the real session — never by a forged request.
 *
 * If you need one of these from the browser, wrap it in a `"use server"` action that calls
 * `requireUser()` / `requireInternal()` first and passes the trusted session through.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { assertSameTenant, isInternal, isMember } from "@/lib/authz";
import { fmt, DEFAULT_RATE_CARD, type FeeStatus, type RateCard } from "@/lib/demand";
import { DEFAULT_VOICE, type VoiceSettings } from "@/lib/voice-config";
import type { SessionUser } from "@/server/session";

/** The portal account for this session. Internal users may name one in their own tenant; a
 *  portal user only ever gets their own. */
export async function resolvePortalAccount(user: SessionUser, accountId?: string | null) {
  if (isInternal(user)) {
    const where = accountId ? { id: accountId } : { tenantId: user.tenantId, portalEnabled: true };
    const a = await prisma.commercialAccount.findFirst({ where, orderBy: { createdAt: "asc" } });
    if (a) assertSameTenant(user, a.tenantId);
    return a;
  }
  return prisma.commercialAccount.findUnique({ where: { portalTenantId: user.tenantId } });
}

/** The person record behind a member session, or an internal user's chosen member. */
export async function resolveMemberPerson(user: SessionUser, personId?: string | null) {
  if (isInternal(user)) {
    return prisma.person.findFirst({ where: personId ? { id: personId, tenantId: user.tenantId } : { tenantId: user.tenantId, memberSince: { not: null } }, orderBy: { memberSince: "asc" } });
  }
  if (!isMember(user)) return null;
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { personId: true } });
  return u?.personId ? prisma.person.findUnique({ where: { id: u.personId } }) : null;
}

/** Fee pipeline totals for a tenant, per currency, never summed across currencies. */
export async function feeSummary(tenantId: string) {
  const fees = await prisma.feeLine.findMany({ where: { tenantId } });
  const by = (statuses: FeeStatus[]) => {
    const out: Record<string, number> = {};
    for (const f of fees) if (statuses.includes(f.status)) out[f.currency] = (out[f.currency] ?? 0) + Number(f.ourTake);
    return Object.entries(out).map(([c, v]) => fmt(v, c)).join(" + ") || "—";
  };
  return { forecast: by(["FORECAST"]), agreed: by(["AGREED", "INVOICED"]), paid: by(["PAID"]) };
}

/** The alert feed for an internal tenant. Contains names, so it must never be reachable directly. */
export async function alertsFor(tenantId: string) {
  const [people, referrals, pitches, briefs, interested] = await Promise.all([
    prisma.person.findMany({ where: { tenantId, screeningStatus: { in: ["REGISTERED", "SUBMITTED"] } }, select: { id: true, firstName: true, lastName: true, screeningStatus: true, updatedAt: true } }),
    prisma.referral.findMany({ where: { tenantId, status: "NEW" }, include: { referrer: { select: { firstName: true, lastName: true } } } }),
    prisma.pitch.findMany({ where: { status: "SUBMITTED", brief: { tenantId } }, include: { person: { select: { firstName: true, lastName: true } }, brief: { select: { title: true } } } }),
    prisma.brief.findMany({ where: { tenantId, status: "NEW", submittedVia: "PORTAL" }, include: { account: { select: { name: true } } } }),
    prisma.shortlistItem.findMany({ where: { decision: "CLIENT_INTERESTED", brief: { tenantId } }, include: { person: { select: { firstName: true, lastName: true } }, brief: { select: { id: true, account: { select: { name: true } } } } } }),
  ]);
  const out: { kind: string; text: string; href: string; when: Date; tone: "teal" | "amber" | "navy" }[] = [];
  for (const p of people) out.push(p.screeningStatus === "REGISTERED" ? { kind: "New member", text: `${p.firstName} ${p.lastName} registered and needs a screening call`, href: `/network/${p.id}`, when: p.updatedAt, tone: "teal" } : { kind: "Screening", text: `${p.firstName} ${p.lastName} completed the screening. Review the summary.`, href: "/conversations?tab=review", when: p.updatedAt, tone: "amber" });
  for (const r of referrals) out.push({ kind: "Referral", text: `${r.referrer.firstName} ${r.referrer.lastName} referred ${r.name}`, href: "/referrals", when: r.createdAt, tone: "navy" });
  for (const x of pitches) out.push({ kind: "Pitch", text: `${x.person.firstName} ${x.person.lastName} pitched for "${x.brief.title}"`, href: "/referrals?tab=pitches", when: x.createdAt, tone: "navy" });
  for (const b of briefs) out.push({ kind: "Requirement", text: `${b.account.name} sent a new requirement`, href: `/requirements/${b.id}`, when: b.createdAt, tone: "amber" });
  for (const s of interested) out.push({ kind: "Introduction", text: `${s.brief.account.name} wants an introduction to ${s.person.firstName} ${s.person.lastName}`, href: `/requirements/${s.brief.id}`, when: s.updatedAt, tone: "teal" });
  return out.sort((a, b) => b.when.getTime() - a.when.getTime());
}

/** The tenant's commercial rate card. */
export async function loadRateCard(tenantId: string): Promise<RateCard> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { rateCard: true } });
  return { ...DEFAULT_RATE_CARD, ...((t?.rateCard as Partial<RateCard> | null) ?? {}) };
}

/** The tenant's voice settings, plus whether the vendor key is present. Backend only: the
 *  presence of an ElevenLabs key is not something a member or a client is ever shown. */
export async function loadVoiceSettings(tenantId: string): Promise<{ settings: VoiceSettings; keyConfigured: boolean }> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { voiceSettings: true } });
  return { settings: { ...DEFAULT_VOICE, ...((t?.voiceSettings as Partial<VoiceSettings> | null) ?? {}) }, keyConfigured: !!process.env.ELEVENLABS_API_KEY };
}
