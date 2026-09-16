"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireInternalAction } from "@/server/session";
import { assertSameTenant } from "@/lib/authz";
import type { AdvisoryStatus } from "@prisma/client";

const schema = z.object({
  personId: z.string(),
  currentLocation: z.string().max(120).optional(),
  targetLocation: z.string().max(120).optional(),
  targetMoveWindow: z.string().max(120).optional(),
  familyMove: z.coerce.boolean().optional(),
  schoolGuidanceInterest: z.coerce.boolean().optional(),
  housingGuidanceInterest: z.coerce.boolean().optional(),
  relocationAdvisoryInterest: z.coerce.boolean().optional(),
  employerSponsored: z.coerce.boolean().optional(),
  advisoryStatus: z.enum(["INTEREST_CAPTURED", "DISCOVERY_CALL", "PROPOSAL_SENT", "ACTIVE", "COMPLETED", "NOT_PROCEEDING"]).default("INTEREST_CAPTURED"),
  notes: z.string().max(3000).optional(),
});

// Relocation is a separate advisory service, never bundled into recruitment economics (spec §4).
export async function upsertRelocation(formData: FormData) {
  const user = await requireInternalAction();
  const d = schema.parse(Object.fromEntries(formData));
  const person = await prisma.person.findUnique({ where: { id: d.personId }, select: { tenantId: true } });
  if (!person) throw new Error("Not found");
  assertSameTenant(user, person.tenantId);
  const data = {
    currentLocation: d.currentLocation || null,
    targetLocation: d.targetLocation || null,
    targetMoveWindow: d.targetMoveWindow || null,
    familyMove: d.familyMove ?? false,
    schoolGuidanceInterest: d.schoolGuidanceInterest ?? false,
    housingGuidanceInterest: d.housingGuidanceInterest ?? false,
    relocationAdvisoryInterest: d.relocationAdvisoryInterest ?? false,
    employerSponsored: d.employerSponsored ?? false,
    advisoryStatus: d.advisoryStatus as AdvisoryStatus,
    notes: d.notes || null,
  };
  await prisma.relocationProfile.upsert({ where: { personId: d.personId }, create: { personId: d.personId, ...data }, update: data });
  await prisma.person.update({ where: { id: d.personId }, data: { relocationInterest: true, targetLocations: d.targetLocation ? { push: d.targetLocation } : undefined } }).catch(() => null);
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "relocation.update", entityType: "RelocationProfile", entityId: d.personId, metadata: { status: d.advisoryStatus } });
  revalidatePath("/relocation");
  revalidatePath(`/network/${d.personId}`);
}
