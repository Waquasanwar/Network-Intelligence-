"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isInternal } from "@/lib/authz";
import { requireUser } from "@/server/session";
import { resolveMemberPerson, resolvePortalAccount } from "@/server/queries";

/**
 * A member answers the agent's "Shall I put you forward?". Yes becomes their interest on the
 * requirement, for the team to take forward; either way the team is told.
 */
export async function answerFit(formData: FormData) {
  const user = await requireUser();
  const me = await resolveMemberPerson(user, String(formData.get("asPersonId") || "") || null);
  if (!me) redirect("/member");
  const n = await prisma.agentNote.findFirst({ where: { id: String(formData.get("noteId") || ""), personId: me!.id, kind: "fit", answer: null } });
  if (!n?.briefId) redirect("/member");
  const yes = formData.get("answer") === "yes";
  await prisma.agentNote.update({ where: { id: n!.id }, data: { answer: yes ? "yes" : "no", readAt: new Date() } });
  if (yes) {
    await prisma.pitch.upsert({ where: { briefId_personId: { briefId: n!.briefId!, personId: me!.id } }, create: { briefId: n!.briefId!, personId: me!.id, note: "Said yes when Amana asked." }, update: { status: "SUBMITTED" } });
    await audit({ tenantId: me!.tenantId, actorId: user.id, action: "pitch.create", entityType: "Brief", entityId: n!.briefId!, metadata: { via: "agent" } });
  }
  const brief = await prisma.brief.findUnique({ where: { id: n!.briefId! }, select: { title: true } });
  await prisma.agentNote.create({ data: { tenantId: me!.tenantId, audience: "OWNER", key: `answer:${n!.id}`, kind: "answer", briefId: n!.briefId, aboutId: me!.id, href: `/requirements/${n!.briefId}`, title: `${me!.firstName} ${me!.lastName} ${yes ? "said yes to being put forward for" : "said not now to"} “${brief?.title ?? "a requirement"}”` } }).catch(() => {});
  revalidatePath("/member"); revalidatePath("/requirements");
  redirect(`/member${isInternal(user) ? `?person=${me!.id}` : ""}#from-amana`);
}

/** Opening the bell marks what the agent told you as seen. */
export async function markNotesSeen() {
  const user = await requireUser();
  const now = new Date();
  if (isInternal(user)) { await prisma.agentNote.updateMany({ where: { tenantId: user.tenantId, audience: "OWNER", readAt: null }, data: { readAt: now } }); return; }
  if (user.role === "MEMBER") { const me = await resolveMemberPerson(user, null); if (me) await prisma.agentNote.updateMany({ where: { personId: me.id, readAt: null, kind: { not: "fit" } }, data: { readAt: now } }); return; }
  const account = await resolvePortalAccount(user, null);
  if (account) await prisma.agentNote.updateMany({ where: { accountId: account.id, readAt: null }, data: { readAt: now } });
}
