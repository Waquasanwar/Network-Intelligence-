"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireInternalAction, requireUser, type SessionUser } from "@/server/session";
import { assertSameTenant, isInternal } from "@/lib/authz";
import { parseList } from "@/lib/utils";
import { parseBrief, matchBrief, hardChecks, estimateFee, defaultFeeModel, defaultTerms, DEFAULT_RATE_CARD, fmt, type Brief, type BudgetKind, type BriefPerson, type RateCard, type Terms, type FeeModel, type ShortlistDecision, type BriefStatus, type FeeStatus } from "@/lib/demand";
import { parseFitTraits } from "@/lib/fit";
import type { Brief as DbBrief, CommercialAccount, EngagementRoute, Seniority, Prisma } from "@prisma/client";

// ---------- shared helpers (also used by pages) ----------

export async function loadRateCard(tenantId: string): Promise<RateCard> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { rateCard: true } });
  return { ...DEFAULT_RATE_CARD, ...((t?.rateCard as Partial<RateCard> | null) ?? {}) };
}

/** Prisma brief → domain brief + terms. */
export async function toDomain(b: DbBrief): Promise<Brief & { terms: Terms; expertHours: number | null }> {
  return {
    rawText: b.rawText, title: b.title, engagementRoute: b.engagementRoute, headcount: b.headcount, roles: b.roles, capabilities: b.capabilities, sectors: b.sectors, seniority: b.seniority,
    locations: b.locations, mustBeLocal: b.mustBeLocal, workRights: b.workRights, budget: b.budgetAmount ? { kind: (b.budgetKind ?? "DAY_RATE") as BudgetKind, amount: Number(b.budgetAmount), max: b.budgetMax ? Number(b.budgetMax) : null, currency: b.budgetCurrency ?? b.feeCurrency } : null,
    durationMonths: b.durationMonths, startBy: b.startBy, fitTraits: parseFitTraits(b.rawText), assumptions: b.assumptions, questions: b.questions,
    terms: { model: b.feeModel as FeeModel, pct: b.feePct ? Number(b.feePct) : null, flat: b.feeFlat ? Number(b.feeFlat) : null, currency: b.feeCurrency },
    expertHours: b.expertHours,
  };
}

async function briefPeople(tenantId: string): Promise<BriefPerson[]> {
  const people = await prisma.person.findMany({ where: { tenantId }, include: { relationships: true, evidence: true, conversations: { where: { approvalStatus: "APPROVED" }, select: { id: true } } } });
  return people.map((p) => ({
    id: p.id, capabilities: p.capabilities, sectors: p.sectors, seniority: p.seniority, engagementPreferences: p.engagementPreferences, primaryCity: p.primaryCity, primaryCountry: p.primaryCountry, targetLocations: p.targetLocations,
    availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate, rateExpectation: p.rateExpectation, salaryExpectation: p.salaryExpectation,
    relationships: p.relationships.map((r) => ({ relationshipType: r.relationshipType, workedTogether: r.workedTogether, wouldWorkTogetherAgain: r.wouldWorkTogetherAgain, yearsKnown: r.yearsKnown })),
    evidence: p.evidence.map((e) => ({ evidenceType: e.evidenceType, confidence: e.confidence, context: e.context })),
    approvedConversations: p.conversations.length, workRights: p.workRights, relocationInterest: p.relocationInterest,
  }));
}

/** Retrieve people for a brief and upsert the shortlist. Human decisions are preserved. */
async function runShortlist(db: DbBrief, tenantId: string) {
  const brief = await toDomain(db);
  const results = matchBrief(brief, await briefPeople(tenantId), 12);
  for (const r of results) {
    await prisma.shortlistItem.upsert({
      where: { briefId_personId: { briefId: db.id, personId: r.match.personId } },
      create: { briefId: db.id, personId: r.match.personId, fitScore: r.match.fitScore, fitExplanation: r.match.fitExplanation, dimensions: r.match.dimensions as unknown as Prisma.InputJsonValue, uncertainty: r.match.uncertainty, checks: r.checks as unknown as Prisma.InputJsonValue, tier: r.tier },
      update: { fitScore: r.match.fitScore, fitExplanation: r.match.fitExplanation, dimensions: r.match.dimensions as unknown as Prisma.InputJsonValue, uncertainty: r.match.uncertainty, checks: r.checks as unknown as Prisma.InputJsonValue, tier: r.tier },
    });
  }
  return results.length;
}

function briefData(parsed: Brief, terms: Terms) {
  return {
    rawText: parsed.rawText, title: parsed.title, engagementRoute: parsed.engagementRoute, headcount: parsed.headcount, roles: parsed.roles, capabilities: parsed.capabilities, sectors: parsed.sectors, seniority: parsed.seniority,
    locations: parsed.locations, mustBeLocal: parsed.mustBeLocal, workRights: parsed.workRights, budgetKind: parsed.budget?.kind ?? null, budgetAmount: parsed.budget?.amount ?? null, budgetMax: parsed.budget?.max ?? null, budgetCurrency: parsed.budget?.currency ?? null,
    durationMonths: parsed.durationMonths, startBy: parsed.startBy, assumptions: parsed.assumptions, questions: parsed.questions,
    feeModel: terms.model, feePct: terms.pct, feeFlat: terms.flat, feeCurrency: terms.currency,
  };
}

async function termsFor(account: CommercialAccount, route: EngagementRoute | null, card: RateCard): Promise<Terms> {
  const model = defaultFeeModel(route, account.kind);
  return { ...defaultTerms(card, model), ...((account.terms as Partial<Terms> | null) ?? {}) };
}

async function forecastFee(db: DbBrief, tenantId: string, card: RateCard) {
  const d = await toDomain(db);
  const est = estimateFee(d, d.terms, card, d.expertHours);
  const existing = await prisma.feeLine.findFirst({ where: { briefId: db.id, personId: null, status: "FORECAST" } });
  if (!est.confident) { if (existing) await prisma.feeLine.delete({ where: { id: existing.id } }); return; }
  const data = { model: d.terms.model, basis: est.basis, gross: est.gross, ourTake: est.ourTake, currency: est.currency };
  if (existing) await prisma.feeLine.update({ where: { id: existing.id }, data });
  else await prisma.feeLine.create({ data: { ...data, tenantId, briefId: db.id, accountId: db.accountId, status: "FORECAST" } });
}

async function ownedBrief(user: SessionUser, id: string) {
  const b = await prisma.brief.findUnique({ where: { id } });
  if (!b) throw new Error("Not found");
  assertSameTenant(user, b.tenantId);
  return b;
}

// ---------- accounts ----------

const accountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["CLIENT", "AGENCY", "EXPERT_NETWORK"]),
  status: z.enum(["PROSPECT", "ACTIVE", "PAUSED"]).default("PROSPECT"),
  contactName: z.string().max(120).optional(),
  contactEmail: z.string().max(200).optional(),
  currency: z.string().max(3).default("GBP"),
  monthlyFee: z.string().optional(),
  notes: z.string().max(2000).optional(),
  portalEnabled: z.coerce.boolean().optional(),
});

export async function createAccount(formData: FormData) {
  const user = await requireInternalAction();
  const d = accountSchema.parse(Object.fromEntries(formData));
  const a = await prisma.commercialAccount.create({ data: { tenantId: user.tenantId, name: d.name, kind: d.kind, status: d.status, contactName: d.contactName || null, contactEmail: d.contactEmail || null, currency: d.currency, monthlyFee: d.monthlyFee ? Number(d.monthlyFee.replace(/[^0-9.]/g, "")) : null, notes: d.notes || null, portalEnabled: d.portalEnabled ?? false } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "account.create", entityType: "CommercialAccount", entityId: a.id, metadata: { kind: a.kind } });
  revalidatePath("/requirements");
}

// ---------- briefs ----------

export async function createBrief(formData: FormData) {
  const user = await requireInternalAction();
  const text = String(formData.get("text") || "").trim();
  const accountId = String(formData.get("accountId") || "");
  if (text.length < 3) throw new Error("Describe the need first");
  const account = await prisma.commercialAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Choose an account");
  assertSameTenant(user, account.tenantId);
  const card = await loadRateCard(user.tenantId);
  const parsed = parseBrief(text);
  const terms = await termsFor(account, parsed.engagementRoute, card);
  const title = String(formData.get("title") || "").trim() || parsed.title;
  const b = await prisma.brief.create({ data: { tenantId: user.tenantId, accountId, submittedVia: "OWNER", status: "QUALIFYING", ...briefData({ ...parsed, title }, terms) } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "brief.create", entityType: "Brief", entityId: b.id, metadata: { account: account.name, title } });
  await forecastFee(b, user.tenantId, card);
  await runShortlist(b, user.tenantId);
  revalidatePath("/requirements");
  redirect(`/requirements/${b.id}`);
}

export async function findForBrief(formData: FormData) {
  const user = await requireInternalAction();
  const b = await ownedBrief(user, String(formData.get("briefId")));
  const n = await runShortlist(b, user.tenantId);
  if (b.status === "NEW" || b.status === "QUALIFYING") await prisma.brief.update({ where: { id: b.id }, data: { status: "SEARCHING" } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "brief.search", entityType: "Brief", entityId: b.id, metadata: { retrieved: n } });
  revalidatePath(`/requirements/${b.id}`);
}

export async function setBriefStatus(formData: FormData) {
  const user = await requireInternalAction();
  const b = await ownedBrief(user, String(formData.get("briefId")));
  const status = z.enum(["NEW", "QUALIFYING", "SEARCHING", "SHORTLISTED", "INTRODUCING", "FILLED", "CLOSED"]).parse(formData.get("status")) as BriefStatus;
  await prisma.brief.update({ where: { id: b.id }, data: { status } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "brief.status", entityType: "Brief", entityId: b.id, metadata: { status } });
  revalidatePath(`/requirements/${b.id}`); revalidatePath("/requirements");
}

const termsSchema = z.object({
  briefId: z.string(),
  model: z.enum(["PERM_PCT", "AGENCY_REFERRAL", "CONTRACT_MARGIN", "AGENCY_CONTRACT_SHARE", "EXPERT_HOURLY", "SOW_SHARE", "INTRODUCTION_FEE"]),
  pct: z.string().optional(),
  flat: z.string().optional(),
  currency: z.string().max(3),
  expertHours: z.string().optional(),
  termsAccepted: z.coerce.boolean().optional(),
});

export async function saveBriefTerms(formData: FormData) {
  const user = await requireInternalAction();
  const d = termsSchema.parse(Object.fromEntries(formData));
  const b = await ownedBrief(user, d.briefId);
  const card = await loadRateCard(user.tenantId);
  const base = defaultTerms(card, d.model as FeeModel);
  const pct = d.model === "INTRODUCTION_FEE" ? null : d.pct ? Number(d.pct) : base.pct;
  const flat = d.model === "INTRODUCTION_FEE" ? (d.flat ? Number(d.flat) : base.flat) : null;
  const nb = await prisma.brief.update({ where: { id: b.id }, data: { feeModel: d.model, feePct: pct, feeFlat: flat, feeCurrency: d.currency, expertHours: d.expertHours ? Number(d.expertHours) : b.expertHours, termsAccepted: d.termsAccepted ?? false, termsAcceptedAt: d.termsAccepted && !b.termsAccepted ? new Date() : b.termsAcceptedAt } });
  await forecastFee(nb, user.tenantId, card);
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "brief.terms", entityType: "Brief", entityId: b.id, metadata: { model: d.model, pct, flat } });
  revalidatePath(`/requirements/${b.id}`); revalidatePath("/requirements");
}

const editSchema = z.object({
  briefId: z.string(), rawText: z.string().trim().min(3).max(4000), title: z.string().trim().min(2).max(160),
  engagementRoute: z.enum(["", "PERMANENT", "CONTRACT", "INTERIM", "FRACTIONAL", "ADVISORY", "SOW"]).optional(), headcount: z.coerce.number().int().min(1).max(50).default(1),
  roles: z.string().optional(), capabilities: z.string().optional(), locations: z.string().optional(), workRights: z.string().max(200).optional(),
  seniority: z.enum(["", "ASSOCIATE", "MANAGER", "SENIOR_MANAGER", "DIRECTOR", "EXECUTIVE", "C_LEVEL"]).optional(), sectors: z.string().optional(),
  budgetAmount: z.string().optional(), budgetKind: z.enum(["SALARY", "DAY_RATE", "HOURLY", "PROJECT"]).default("DAY_RATE"), budgetCurrency: z.string().max(3).default("GBP"),
  durationMonths: z.string().optional(), startBy: z.string().max(60).optional(), mustBeLocal: z.coerce.boolean().optional(),
});

export async function updateBrief(formData: FormData) {
  const user = await requireInternalAction();
  const d = editSchema.parse(Object.fromEntries(formData));
  const b = await ownedBrief(user, d.briefId);
  const amount = d.budgetAmount ? Number(d.budgetAmount.replace(/[^0-9.]/g, "")) : 0;
  const nb = await prisma.brief.update({ where: { id: b.id }, data: {
    rawText: d.rawText, title: d.title, engagementRoute: (d.engagementRoute || null) as EngagementRoute | null, headcount: d.headcount, roles: parseList(d.roles), capabilities: parseList(d.capabilities), locations: parseList(d.locations), workRights: d.workRights || null,
    seniority: (d.seniority || null) as Seniority | null, sectors: parseList(d.sectors), budgetKind: amount ? d.budgetKind : null, budgetAmount: amount || null, budgetMax: null, budgetCurrency: amount ? d.budgetCurrency : null,
    durationMonths: d.durationMonths ? Number(d.durationMonths) : null, startBy: d.startBy || null, mustBeLocal: d.mustBeLocal ?? false, questions: [],
  } });
  // Re-check hard requirements against the corrected brief; keep every human decision.
  const domain = await toDomain(nb);
  const people = await briefPeople(user.tenantId);
  const items = await prisma.shortlistItem.findMany({ where: { briefId: b.id } });
  for (const it of items) { const p = people.find((x) => x.id === it.personId); if (!p) continue; const checks = hardChecks(domain, p); const tier = checks.some((c) => c.state === "unmet") ? "stretch" : checks.some((c) => c.state === "unknown") ? "conversation" : "meets"; await prisma.shortlistItem.update({ where: { id: it.id }, data: { checks: checks as unknown as Prisma.InputJsonValue, tier } }); }
  await forecastFee(nb, user.tenantId, await loadRateCard(user.tenantId));
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "brief.update", entityType: "Brief", entityId: b.id });
  revalidatePath(`/requirements/${b.id}`); revalidatePath("/requirements");
}

// ---------- shortlist ----------

export async function decideShortlist(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("itemId"));
  const decision = z.enum(["CANDIDATE", "SHORTLISTED", "PROPOSED", "CLIENT_INTERESTED", "CLIENT_PASSED", "INTRODUCED", "PLACED", "NOT_FOR_THIS"]).parse(formData.get("decision")) as ShortlistDecision;
  const clientNote = String(formData.get("clientNote") || "").trim().slice(0, 300) || null;
  const item = await prisma.shortlistItem.findUnique({ where: { id }, include: { brief: true, person: { select: { firstName: true, lastName: true } } } });
  if (!item) throw new Error("Not found");
  assertSameTenant(user, item.brief.tenantId);
  await prisma.shortlistItem.update({ where: { id }, data: { decision, clientNote } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "shortlist.decide", entityType: "Brief", entityId: item.briefId, metadata: { personId: item.personId, decision } });
  if (decision === "PLACED") {
    const exists = await prisma.feeLine.findFirst({ where: { briefId: item.briefId, personId: item.personId } });
    if (!exists) {
      const d = await toDomain(item.brief); const card = await loadRateCard(user.tenantId);
      const est = estimateFee({ ...d, headcount: 1 }, d.terms, card, d.expertHours);
      await prisma.feeLine.create({ data: { tenantId: user.tenantId, briefId: item.briefId, accountId: item.brief.accountId, personId: item.personId, model: d.terms.model, basis: est.basis, gross: est.gross, ourTake: est.ourTake, currency: est.currency, status: "AGREED" } });
      await audit({ tenantId: user.tenantId, actorId: user.id, action: "fee.create", entityType: "Brief", entityId: item.briefId, metadata: { ourTake: est.ourTake, currency: est.currency, personId: item.personId } });
    }
  }
  const placed = await prisma.shortlistItem.count({ where: { briefId: item.briefId, decision: "PLACED" } });
  const next: BriefStatus | null = placed >= item.brief.headcount ? "FILLED" : decision === "INTRODUCED" ? "INTRODUCING" : decision === "PROPOSED" && ["NEW", "QUALIFYING", "SEARCHING"].includes(item.brief.status) ? "SHORTLISTED" : null;
  if (next && next !== item.brief.status) await prisma.brief.update({ where: { id: item.briefId }, data: { status: next } });
  revalidatePath(`/requirements/${item.briefId}`); revalidatePath("/requirements"); revalidatePath("/portal");
}

// ---------- fees ----------

export async function setFeeStatus(formData: FormData) {
  const user = await requireInternalAction();
  const id = String(formData.get("feeId"));
  const status = z.enum(["FORECAST", "AGREED", "INVOICED", "PAID", "WRITTEN_OFF"]).parse(formData.get("status")) as FeeStatus;
  const f = await prisma.feeLine.findUnique({ where: { id } });
  if (!f) throw new Error("Not found");
  assertSameTenant(user, f.tenantId);
  await prisma.feeLine.update({ where: { id }, data: { status } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "fee.update", entityType: "Brief", entityId: f.briefId, metadata: { status, ourTake: Number(f.ourTake) } });
  revalidatePath(`/requirements/${f.briefId}`); revalidatePath("/requirements");
}

export async function addFeeLine(formData: FormData) {
  const user = await requireInternalAction();
  const b = await ownedBrief(user, String(formData.get("briefId")));
  const d = z.object({ personId: z.string().optional(), status: z.enum(["FORECAST", "AGREED", "INVOICED", "PAID", "WRITTEN_OFF"]).default("FORECAST"), gross: z.string().optional(), ourTake: z.string(), currency: z.string().max(3), basis: z.string().max(200).optional() }).parse(Object.fromEntries(formData));
  const num = (s?: string) => Number((s ?? "0").replace(/[^0-9.]/g, "")) || 0;
  await prisma.feeLine.create({ data: { tenantId: user.tenantId, briefId: b.id, accountId: b.accountId, personId: d.personId || null, model: b.feeModel, basis: d.basis || "Recorded manually", gross: num(d.gross), ourTake: num(d.ourTake), currency: d.currency, status: d.status } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "fee.create", entityType: "Brief", entityId: b.id, metadata: { ourTake: num(d.ourTake), currency: d.currency, status: d.status } });
  revalidatePath(`/requirements/${b.id}`); revalidatePath("/requirements");
}

// ---------- rate card ----------

export async function saveRateCard(formData: FormData) {
  const user = await requireInternalAction();
  if (user.role !== "OWNER" && user.role !== "ADMIN") throw new Error("Not permitted");
  const current = await loadRateCard(user.tenantId);
  const next: RateCard = { ...current };
  for (const k of Object.keys(DEFAULT_RATE_CARD) as (keyof RateCard)[]) {
    const v = formData.get(k); if (v === null) continue;
    if (k === "currency") next.currency = String(v).slice(0, 3).toUpperCase(); else (next as unknown as Record<string, number>)[k] = Math.max(0, Number(v) || 0);
  }
  await prisma.tenant.update({ where: { id: user.tenantId }, data: { rateCard: next as unknown as Prisma.InputJsonValue } });
  await audit({ tenantId: user.tenantId, actorId: user.id, action: "ratecard.update", entityType: "Tenant", entityId: user.tenantId, metadata: { permPct: next.permPct, contractMarginPct: next.contractMarginPct, expertHourlyTakePct: next.expertHourlyTakePct } });
  revalidatePath("/settings/commercials"); revalidatePath("/requirements");
}

// ---------- portal (clients and agencies) ----------

/** The account a portal user acts for. Internal users may preview any account of their tenant. */
export async function resolvePortalAccount(user: SessionUser, accountId?: string | null) {
  if (isInternal(user)) {
    const where = accountId ? { id: accountId } : { tenantId: user.tenantId, portalEnabled: true };
    const a = await prisma.commercialAccount.findFirst({ where, orderBy: { createdAt: "asc" } });
    if (a) assertSameTenant(user, a.tenantId);
    return a;
  }
  return prisma.commercialAccount.findUnique({ where: { portalTenantId: user.tenantId } });
}

export async function portalSubmitBrief(formData: FormData) {
  const user = await requireUser();
  const account = await resolvePortalAccount(user, String(formData.get("accountId") || "") || null);
  if (!account || !account.portalEnabled) throw new Error("No portal account");
  const text = String(formData.get("text") || "").trim();
  if (text.length < 3) throw new Error("Describe the requirement first");
  const card = await loadRateCard(account.tenantId);
  const parsed = parseBrief(text);
  const terms = await termsFor(account, parsed.engagementRoute, card);
  const b = await prisma.brief.create({ data: { tenantId: account.tenantId, accountId: account.id, submittedVia: "PORTAL", status: "NEW", ...briefData(parsed, terms) } });
  await audit({ tenantId: account.tenantId, actorId: user.id, action: "portal.brief_submitted", entityType: "Brief", entityId: b.id, metadata: { account: account.name, title: parsed.title } });
  await forecastFee(b, account.tenantId, card);
  revalidatePath("/portal"); revalidatePath("/requirements");
}

export async function portalRespond(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("itemId"));
  const response = z.enum(["interested", "pass"]).parse(formData.get("response"));
  const item = await prisma.shortlistItem.findUnique({ where: { id }, include: { brief: { include: { account: true } } } });
  if (!item) throw new Error("Not found");
  const account = await resolvePortalAccount(user, item.brief.accountId);
  if (!account || account.id !== item.brief.accountId) throw new Error("Not permitted");
  if (item.decision !== "PROPOSED") throw new Error("This card is no longer open");
  await prisma.shortlistItem.update({ where: { id }, data: { decision: response === "interested" ? "CLIENT_INTERESTED" : "CLIENT_PASSED" } });
  await audit({ tenantId: item.brief.tenantId, actorId: user.id, action: "portal.response", entityType: "Brief", entityId: item.briefId, metadata: { personId: item.personId, response, account: account.name } });
  revalidatePath("/portal"); revalidatePath(`/requirements/${item.briefId}`);
}

export async function portalAcceptTerms(formData: FormData) {
  const user = await requireUser();
  const b = await prisma.brief.findUnique({ where: { id: String(formData.get("briefId")) }, include: { account: true } });
  if (!b) throw new Error("Not found");
  const account = await resolvePortalAccount(user, b.accountId);
  if (!account || account.id !== b.accountId) throw new Error("Not permitted");
  await prisma.brief.update({ where: { id: b.id }, data: { termsAccepted: true, termsAcceptedAt: new Date() } });
  await audit({ tenantId: b.tenantId, actorId: user.id, action: "terms.accept", entityType: "Brief", entityId: b.id, metadata: { account: account.name, model: b.feeModel, pct: b.feePct ? Number(b.feePct) : null } });
  revalidatePath("/portal"); revalidatePath(`/requirements/${b.id}`);
}

export async function feeSummary(tenantId: string) {
  const fees = await prisma.feeLine.findMany({ where: { tenantId } });
  const by = (statuses: FeeStatus[]) => { const out: Record<string, number> = {}; for (const f of fees) if (statuses.includes(f.status)) out[f.currency] = (out[f.currency] ?? 0) + Number(f.ourTake); return Object.entries(out).map(([c, v]) => fmt(v, c)).join(" + ") || "—"; };
  return { forecast: by(["FORECAST"]), agreed: by(["AGREED", "INVOICED"]), paid: by(["PAID"]) };
}
