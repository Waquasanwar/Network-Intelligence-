"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isInternal } from "@/lib/authz";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { readReference, signReference, REFERENCE_DAYS, REFERENCE_RELATIONS } from "@/lib/reference-link";
import { requireUser } from "@/server/session";
import { resolveMemberPerson } from "@/server/queries";

/**
 * References by link: trust that does not need a phone call.
 *
 * The person (or the team, for them) names someone who has seen their work. That creates a
 * single-use link, sent from their own email or phone, never by the platform. The referee answers
 * in about a minute with no login. The answer is stored as an outside reference, which the trust
 * score weighs below a vouch from inside the network, and which the team can read in full.
 */

const MAX_OPEN = 6;

const askSchema = z.object({
  personId: z.string().max(40).optional().or(z.literal("")),
  refereeName: z.string().trim().min(2).max(120),
  refereeEmail: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal("")),
  context: z.string().trim().min(3).max(300),
});

export type AskReferenceResult = { ok: true; id: string; token: string; refereeName: string; about: string } | { ok: false; error: string };

/** The person the caller may ask references for: themselves, or anyone in their tenant if on the team. */
async function subject(user: Awaited<ReturnType<typeof requireUser>>, personId: string | null) {
  if (isInternal(user)) {
    if (!personId) return null;
    return prisma.person.findFirst({ where: { id: personId, tenantId: user.tenantId }, select: { id: true, tenantId: true, firstName: true, lastName: true, email: true } });
  }
  const me = await resolveMemberPerson(user, null);
  if (!me) return null;
  return prisma.person.findUnique({ where: { id: me.id }, select: { id: true, tenantId: true, firstName: true, lastName: true, email: true } });
}

export async function requestReference(input: z.input<typeof askSchema>): Promise<AskReferenceResult> {
  const user = await requireUser();
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add their name and how they know the work. Check the email address if you gave one." };
  const d = parsed.data;
  if (!(await rateLimit("mutate", `reference:${user.id}`)).success) return { ok: false, error: "That is a lot of requests at once. Wait a minute and carry on." };
  const p = await subject(user, d.personId || null);
  if (!p) return { ok: false, error: "No profile to ask a reference for." };
  // A reference is somebody else's word. An address that is the person's own is not that.
  if (d.refereeEmail && p.email && d.refereeEmail === p.email.toLowerCase()) return { ok: false, error: "That is their own email address. A reference has to come from someone else." };
  const open = await prisma.referenceRequest.count({ where: { personId: p.id, status: "SENT", expiresAt: { gt: new Date() } } });
  if (open >= MAX_OPEN) return { ok: false, error: `There are already ${MAX_OPEN} requests waiting for an answer. Cancel one, or wait for a reply.` };
  const r = await prisma.referenceRequest.create({
    data: { tenantId: p.tenantId, personId: p.id, createdById: isInternal(user) ? user.id : null, refereeName: d.refereeName, refereeEmail: d.refereeEmail || null, context: d.context, expiresAt: new Date(Date.now() + REFERENCE_DAYS * 86_400_000) },
  });
  await audit({ tenantId: p.tenantId, actorId: user.id, action: "reference.request", entityType: "Person", entityId: p.id, metadata: { by: isInternal(user) ? "team" : "self" } });
  revalidatePath("/member"); revalidatePath(`/network/${p.id}`);
  return { ok: true, id: r.id, token: signReference(r.id), refereeName: r.refereeName, about: p.firstName };
}

async function ownRequest(user: Awaited<ReturnType<typeof requireUser>>, id: string) {
  const r = await prisma.referenceRequest.findUnique({ where: { id } });
  if (!r) return null;
  if (isInternal(user)) return r.tenantId === user.tenantId ? r : null;
  const me = await resolveMemberPerson(user, null);
  return me && r.personId === me.id ? r : null;
}

/** The link of a request sent earlier, to copy it again for a reminder. */
export async function referenceLink(requestId: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const r = await ownRequest(user, String(requestId));
  if (!r || r.status !== "SENT" || r.expiresAt < new Date()) return { ok: false, error: "That request is no longer open." };
  return { ok: true, token: signReference(r.id) };
}

/** Cancel a request that has not been answered. Its link stops working immediately. */
export async function revokeReference(formData: FormData) {
  const user = await requireUser();
  const r = await ownRequest(user, String(formData.get("requestId") || ""));
  if (!r || r.status !== "SENT") return;
  await prisma.referenceRequest.update({ where: { id: r.id }, data: { status: "REVOKED" } });
  await audit({ tenantId: r.tenantId, actorId: user.id, action: "reference.revoke", entityType: "Person", entityId: r.personId });
  revalidatePath("/member"); revalidatePath(`/network/${r.personId}`);
}

const answerSchema = z.object({
  t: z.string().min(10).max(400),
  name: z.string().trim().min(2).max(120),
  relation: z.enum(REFERENCE_RELATIONS.map(([k]) => k) as [string, ...string[]]),
  where: z.string().trim().min(2).max(160),
  recommend: z.enum(["yes", "no"]),
  statement: z.string().trim().max(1000).optional(),
});

/**
 * The referee's answer. Reachable without a login: the sealed link decides which request it is,
 * the request must still be open, and the endpoint is throttled. It can only ever add one
 * reference to the one person the link was made for.
 */
export async function answerReference(formData: FormData) {
  const raw = String(formData.get("t") || "");
  const back = (q: string) => redirect(`/vouch?t=${encodeURIComponent(raw)}&${q}`);
  if (!(await rateLimit("join", `reference:${clientIp(await headers())}`)).success) back("error=throttled");
  const id = readReference(raw);
  if (!id) redirect("/vouch");
  // A filled-in trap field means a script, not a person. Say thank you and store nothing.
  if (String(formData.get("website") || "")) redirect("/vouch?done=1");
  const parsed = answerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("error=details");
  if (formData.get("consent") !== "on") back("error=consent");
  const d = parsed.data!;
  const r = await prisma.referenceRequest.findUnique({ where: { id: id! }, include: { person: { select: { id: true, tenantId: true } } } });
  if (!r || r.status !== "SENT" || r.expiresAt < new Date()) redirect(`/vouch?t=${encodeURIComponent(raw)}`);
  const relation = REFERENCE_RELATIONS.find(([k]) => k === d.relation)?.[1] ?? "Another way";
  // "Known since" is optional and only kept when it is a plausible year.
  const since = Number(formData.get("knownSince")); const knownSince = Number.isInteger(since) && since >= 1960 && since <= new Date().getFullYear() ? since : null;
  // Claim the request first, so two submissions of the same link cannot both become a reference.
  const claimed = await prisma.referenceRequest.updateMany({ where: { id: r!.id, status: "SENT" }, data: { status: "ANSWERED", answeredAt: new Date() } });
  if (claimed.count !== 1) redirect(`/vouch?t=${encodeURIComponent(raw)}`);
  const vouch = await prisma.vouch.create({
    data: { personId: r!.personId, voucherKind: "EXTERNAL", voucherName: d.name, source: "Reference by link", context: `${relation} · ${d.where}`, statement: d.statement || null, wouldRecommend: d.recommend === "yes", knownSince },
  });
  await prisma.referenceRequest.update({ where: { id: r!.id }, data: { vouchId: vouch.id } });
  await audit({ tenantId: r!.tenantId, actorId: null, action: "reference.answer", entityType: "Person", entityId: r!.personId, metadata: { wouldRecommend: d.recommend === "yes" } });
  revalidatePath("/member"); revalidatePath(`/network/${r!.personId}`); revalidatePath("/network");
  redirect("/vouch?done=1");
}
