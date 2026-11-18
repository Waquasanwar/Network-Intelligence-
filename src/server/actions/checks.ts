"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isManualKey } from "@/lib/framework";
import { requireInternalAction } from "@/server/session";

const schema = z.object({ personId: z.string().min(1).max(40), key: z.string().max(20), on: z.enum(["1", "0"]), note: z.string().trim().max(200).optional() });

/**
 * Confirm, or take back, one of the five framework checks only a person on the team can make
 * (email, LinkedIn, met, known personally, qualifications). Stored with who and when, so a tick
 * always means "checked by whom", and audited.
 */
export async function setCheck(formData: FormData) {
  const user = await requireInternalAction();
  const d = schema.parse(Object.fromEntries(formData));
  if (!isManualKey(d.key)) throw new Error("Not a check that can be confirmed by hand");
  const p = await prisma.person.findFirst({ where: { id: d.personId, tenantId: user.tenantId }, select: { id: true, checks: true } });
  if (!p) throw new Error("Not found");
  const checks = { ...((p.checks as Record<string, unknown> | null) ?? {}) };
  if (d.on === "1") checks[d.key] = { by: user.name, at: new Date().toISOString(), note: d.note || null };
  else delete checks[d.key];
  await prisma.person.update({ where: { id: p.id }, data: { checks: checks as Prisma.InputJsonValue } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "person.update", entityType: "Person", entityId: p.id, metadata: { field: "check", key: d.key, on: d.on === "1" } });
  revalidatePath(`/network/${p.id}`); revalidatePath("/network");
}
