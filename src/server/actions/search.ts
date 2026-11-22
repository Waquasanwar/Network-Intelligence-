"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EngagementRoute } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { parseBrief } from "@/lib/demand";
import { ROUTE_LABELS } from "@/lib/labels";
import { requireOwnerAction, requireUser } from "@/server/session";
import { resolvePortalAccount, loadRateCard, requireReleased, portalFeature } from "@/server/queries";
import { personForRef } from "@/server/search";
import { briefData, termsFor, forecastFee } from "@/server/briefs";

const ROUTES = ["PERMANENT", "CONTRACT", "INTERIM", "FRACTIONAL", "ADVISORY", "SOW"] as const;

/** Give an account search access, or take it away. Access is something you can charge for, so the owner decides. */
export async function setAccountSearch(formData: FormData) {
  const user = await requireOwnerAction();
  const a = await prisma.commercialAccount.findFirst({ where: { id: String(formData.get("accountId") || ""), tenantId: user.tenantId } });
  if (!a) throw new Error("Not found");
  const on = formData.get("on") === "1";
  await prisma.commercialAccount.update({ where: { id: a.id }, data: { searchEnabled: on } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "account.search", entityType: "CommercialAccount", entityId: a.id, metadata: { on } });
  revalidatePath("/requirements");
}

const askSchema = z.object({ ref: z.string().regex(/^NI-[0-9A-F]{6,12}$/), route: z.enum(ROUTES), note: z.string().trim().max(1500).optional() });

/**
 * A client or agency asks about someone they found. It becomes a requirement on their account with
 * that person already on it, marked as the client's interest. Nothing is revealed: the network asks
 * the person first, and the name is released only when they agree and the owner approves.
 */
export async function askAboutPerson(formData: FormData) {
  const user = await requireUser();
  await requireReleased(user, portalFeature(user), "/portal/search"); // not until the owner releases it
  const account = await resolvePortalAccount(user, String(formData.get("accountId") || "") || null);
  if (!account || !account.searchEnabled) redirect("/portal/search");
  if (!(await rateLimit("mutate", `search-ask:${user.id}`)).success) redirect("/portal/search?notice=slow-down");
  const parsed = askSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/portal/search?notice=details");
  const d = parsed.data!;
  const person = await personForRef(account!, d.ref);
  if (!person) redirect("/portal/search?notice=gone");
  const route = d.route as EngagementRoute;
  const said = d.note || `${ROUTE_LABELS[route]} hire, asked about from our own search.`;
  const card = await loadRateCard(account!.tenantId);
  const p = parseBrief(said);
  const terms = await termsFor(account!, route, card);
  const b = await prisma.brief.create({ data: { tenantId: account!.tenantId, accountId: account!.id, submittedVia: "SEARCH", status: "NEW", ...briefData({ ...p, title: `${ROUTE_LABELS[route]}: asked about ${d.ref}`, engagementRoute: route, rawText: `${account!.name} found ${d.ref} in their own search and asked about a ${ROUTE_LABELS[route].toLowerCase()} hire.\n\n${said}` }, terms) } });
  await prisma.shortlistItem.create({ data: { briefId: b.id, personId: person!.id, fitScore: 0, fitExplanation: "Chosen by the client from their own search.", dimensions: {}, uncertainty: [], checks: [], tier: "conversation", decision: "CLIENT_INTERESTED" } });
  await forecastFee(b, account!.tenantId, card);
  await audit({ tenantId: account!.tenantId, actorId: user.id, action: "portal.search_ask", entityType: "Brief", entityId: b.id, metadata: { account: account!.name, route } });
  revalidatePath("/portal"); revalidatePath("/requirements");
  redirect("/portal/search?notice=asked");
}
