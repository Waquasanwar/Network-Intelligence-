import { parseFitTraits } from "@/lib/fit";
import type { Brief, BudgetKind, FeeModel, Terms } from "@/lib/demand";
import type { Brief as DbBrief } from "@prisma/client";

/** Prisma brief → domain brief + terms. Pure; lives outside the server-action files on purpose. */
export function toDomain(b: DbBrief): Brief & { terms: Terms; expertHours: number | null } {
  return {
    rawText: b.rawText, title: b.title, engagementRoute: b.engagementRoute, headcount: b.headcount, roles: b.roles, capabilities: b.capabilities, sectors: b.sectors, seniority: b.seniority,
    locations: b.locations, mustBeLocal: b.mustBeLocal, workRights: b.workRights, budget: b.budgetAmount ? { kind: (b.budgetKind ?? "DAY_RATE") as BudgetKind, amount: Number(b.budgetAmount), max: b.budgetMax ? Number(b.budgetMax) : null, currency: b.budgetCurrency ?? b.feeCurrency } : null,
    durationMonths: b.durationMonths, startBy: b.startBy, fitTraits: parseFitTraits(b.rawText), assumptions: b.assumptions, questions: b.questions,
    terms: { model: b.feeModel as FeeModel, pct: b.feePct ? Number(b.feePct) : null, flat: b.feeFlat ? Number(b.feeFlat) : null, currency: b.feeCurrency },
    expertHours: b.expertHours,
  };
}
