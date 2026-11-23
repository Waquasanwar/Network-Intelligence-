"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { requireInternalAction } from "@/server/session";
import { publicNetwork, MAX_WAITING } from "@/server/public";
import { loadFeatures } from "@/server/queries";
import { INVITE_DAYS } from "@/server/invites";

/**
 * The two forms on the public page, and what the team does with what comes in.
 *
 * Both forms are reachable with no login, so each one is throttled per connection, carries a trap
 * field for scripts, caps what it will store, and answers the same way whatever it finds: nobody
 * can use it to learn whether an address is already known here. Nothing sent in becomes a member,
 * a client or a requirement until a person on the team says so.
 */

const text = (max: number, min = 0) => z.string().trim().min(min).max(max);
const email = z.string().trim().toLowerCase().email().max(200);
const url = z.string().trim().max(300).regex(/^https?:\/\/[^\s]+$/i).optional().or(z.literal(""));

const joinSchema = z.object({ name: text(120, 2), email, headline: text(160, 3), linkedinUrl: url, knows: text(200).optional(), message: text(1500, 10) });
const needSchema = z.object({ name: text(120, 2), email, organisation: text(160, 2), who: z.enum(["company", "agency"]), message: text(2500, 15) });

async function receive(kind: "JOIN" | "NEED", formData: FormData, limited: boolean, network: { id: string; name: string } | null) {
  const anchor = kind === "JOIN" ? "join" : "need";
  const back = (error: string) => redirect(`/?form=${anchor}&error=${error}#ask`);
  if (limited) back("throttled");
  if (!network) redirect("/login");
  // Closed until the owner releases public applications: nothing is stored.
  if (!(await loadFeatures(network.id)).publicApplications) redirect("/");
  // A filled-in trap field means a script, not a person. Thank it and store nothing.
  if (String(formData.get("website") || "")) redirect(`/?sent=${anchor}#ask`);
  if (formData.get("consent") !== "on") back("consent");
  const fields = Object.fromEntries(formData);
  const parsed = kind === "JOIN" ? joinSchema.safeParse(fields) : needSchema.safeParse(fields);
  if (!parsed.success) back("details");
  const d = parsed.data as z.infer<typeof joinSchema> & z.infer<typeof needSchema>;
  const tenantId = network!.id;

  const data = kind === "JOIN"
    ? { name: d.name, headline: d.headline, linkedinUrl: d.linkedinUrl || null, knows: d.knows || null, message: d.message, organisation: null }
    : { name: d.name, organisation: `${d.organisation}${d.who === "agency" ? " (agency)" : ""}`, message: d.message, headline: null, linkedinUrl: null, knows: null };
  // The same person sending the same kind of thing twice replaces what is waiting, not adds to it.
  const waiting = await prisma.publicRequest.findFirst({ where: { tenantId, kind, status: "NEW", email: d.email }, select: { id: true } });
  if (waiting) await prisma.publicRequest.update({ where: { id: waiting.id }, data: { ...data, consentAt: new Date() } });
  else if ((await prisma.publicRequest.count({ where: { tenantId, status: "NEW" } })) < MAX_WAITING) {
    const r = await prisma.publicRequest.create({ data: { tenantId, kind, email: d.email, consentAt: new Date(), ...data } });
    await audit({ tenantId, actorId: null, action: kind === "JOIN" ? "public.apply" : "public.need", entityType: "PublicRequest", entityId: r.id });
  }
  revalidatePath("/invite"); revalidatePath("/requirements"); revalidatePath("/overview");
  redirect(`/?sent=${anchor}#ask`);
}

/** Apply to join. Public: the network is fixed by publicNetwork(), and the endpoint is throttled. */
export async function applyToJoin(formData: FormData) {
  const limited = !(await rateLimit("join", `public:${clientIp(await headers())}`)).success;
  await receive("JOIN", formData, limited, await publicNetwork());
}

/** Send in a need. Public: the network is fixed by publicNetwork(), and the endpoint is throttled. */
export async function sendNeed(formData: FormData) {
  const limited = !(await rateLimit("join", `public:${clientIp(await headers())}`)).success;
  await receive("NEED", formData, limited, await publicNetwork());
}

/**
 * The team's answer to something that came in. An application accepted becomes a personal
 * invitation (which the team sends from their own email, like any other). A need accepted goes to
 * the co-pilot to be read. Either can be declined, which simply closes it.
 */
export async function handlePublicRequest(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("id") || ""); const decision = String(formData.get("decision") || "");
  const r = await prisma.publicRequest.findFirst({ where: { id, tenantId: user.tenantId, status: "NEW" } });
  if (!r) return;
  const close = (status: "ACCEPTED", inviteId: string | null = null) => prisma.publicRequest.update({ where: { id: r.id }, data: { status, handledAt: new Date(), handledById: user.id, inviteId } });

  if (decision === "decline") {
    // The form promises that details are deleted if the answer is no. The audit entry holds no personal data.
    await prisma.publicRequest.delete({ where: { id: r.id } });
    await audit({ tenantId: user.tenantId, actorId: user.id, action: "public.handle", entityType: "PublicRequest", entityId: r.id, metadata: { kind: r.kind, decision: "declined" } });
    revalidatePath("/invite"); revalidatePath("/requirements");
    return;
  }
  if (r.kind === "JOIN") {
    if (await prisma.user.findFirst({ where: { email: r.email, tenantId: user.tenantId }, select: { id: true } })) { await close("ACCEPTED"); revalidatePath("/invite"); redirect("/invite?notice=already-in"); }
    const invite = await prisma.invite.create({ data: { tenantId: user.tenantId, createdById: user.id, name: r.name, email: r.email, note: "You applied on our website. We would like you in.", expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) } });
    await close("ACCEPTED", invite.id);
    await audit({ tenantId: user.tenantId, actorId: user.id, action: "public.handle", entityType: "PublicRequest", entityId: r.id, metadata: { kind: "JOIN", decision: "invited" } });
    revalidatePath("/invite");
    redirect(`/invite?invited=${invite.id}#invitations`);
  }
  await close("ACCEPTED");
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "public.handle", entityType: "PublicRequest", entityId: r.id, metadata: { kind: "NEED", decision: "read" } });
  revalidatePath("/requirements");
  redirect(`/requirements?q=${encodeURIComponent(`${r.organisation ?? r.name}: ${r.message}`.slice(0, 1800))}`);
}
