import { framework, isManualKey, type Framework, type FrameworkInput, type ManualKey, type Signed } from "@/lib/framework";
import { standardInput, type StandardPerson } from "@/lib/standard-for";
import type { TrustScore } from "@/lib/trust";

/**
 * Everything the 22 checks read from a stored person. Loose on purpose, like StandardPerson: a
 * full profile, a row in a list and a map node all pass through the same function, and anything a
 * query did not load simply counts as not held.
 */
export type FrameworkPerson = StandardPerson & {
  checks?: unknown;
  workRights?: string[];
  capabilities?: string[];
  referralConsent?: string | null;
  privacy?: unknown;
  relationships?: (NonNullable<StandardPerson["relationships"]>[number] & { yearsKnown?: unknown })[];
};

/** Recorded as one of our own contacts, rather than arriving through a list, an event or the web. */
const PERSONAL = new Set(["PERSONAL_NETWORK", "WORKED_TOGETHER"]);

function manualChecks(raw: unknown): Partial<Record<ManualKey, Signed>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<ManualKey, Signed>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isManualKey(k) || !v || typeof v !== "object") continue;
    const s = v as { by?: unknown; at?: unknown; note?: unknown };
    if (typeof s.by === "string" && typeof s.at === "string") out[k] = { by: s.by, at: s.at, note: typeof s.note === "string" ? s.note : null };
  }
  return out;
}

export function frameworkInput(p: FrameworkPerson, now = new Date()): FrameworkInput {
  const base = standardInput(p, now);
  const rels = p.relationships ?? [];
  const introduced = rels.find((r) => !!r.introducedById || !!r.introducedBy);
  const intro = introduced?.introducedBy as { screeningStatus?: unknown; screenedAt?: unknown; vouches?: { wouldRecommend?: unknown }[] } | null | undefined;
  const years = rels.map((r) => (typeof r.yearsKnown === "number" ? r.yearsKnown : 0)).reduce((a, b) => Math.max(a, b), 0);
  const reviewed = (p.privacy as { reviewedAt?: unknown } | null | undefined)?.reviewedAt;
  const reviewedAt = typeof reviewed === "string" ? new Date(reviewed) : null;
  const convs = (p.conversations ?? []) as { approvalStatus?: unknown; type?: unknown }[];
  return {
    ...base,
    manual: manualChecks(p.checks),
    calls: convs.filter((c) => c && c.approvalStatus === "APPROVED" && c.type && c.type !== "SCREENING" && c.type !== "MESSAGE_THREAD").length,
    workRights: (p.workRights ?? []).length,
    personalContact: rels.some((r) => typeof r.sourceType === "string" && PERSONAL.has(r.sourceType)),
    yearsKnown: years || null,
    introducerTrusted: !introduced ? null : intro ? ((intro.screeningStatus === "APPROVED" || !!intro.screenedAt) && (intro.vouches ?? []).some((v) => v.wouldRecommend === true)) : false,
    capabilities: (p.capabilities ?? []).length,
    cautions: (p.evidence ?? []).filter((e) => e.evidenceType === "CAUTION").length,
    referralConsent: p.referralConsent ?? null,
    privacyReviewedDaysAgo: reviewedAt && !isNaN(reviewedAt.getTime()) ? Math.max(0, Math.floor((now.getTime() - reviewedAt.getTime()) / 86_400_000)) : null,
  };
}

export function frameworkFor(p: FrameworkPerson, audience: "internal" | "self" = "internal", now = new Date()): Framework {
  return framework(frameworkInput(p, now), audience);
}

/** The framework in the shape every screen already reads: one score, a band, and how it adds up. */
export function trustFromFramework(f: Framework): TrustScore {
  return {
    score: f.score, band: f.band, vouchedBy: f.vouchedBy,
    breakdown: f.areas.map((a) => ({ label: a.title, points: a.points, max: a.max, note: `${a.held} of ${a.of} checks · ${a.checks.filter((c) => !c.held).map((c) => c.title.toLowerCase()).slice(0, 2).join(", ") || "all held"}${a.checks.filter((c) => !c.held).length > 2 ? "…" : ""}` })),
  };
}
