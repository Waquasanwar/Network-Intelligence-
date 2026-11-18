import type { Prisma } from "@prisma/client";
import type { TrustScore } from "@/lib/trust";
import { frameworkFor, trustFromFramework, type FrameworkPerson } from "@/lib/framework-for";
import { fitProfile, type FitScores, type FitProfileRow } from "@/lib/fit";

/**
 * Trust score for a loaded person: the weight of the 22 framework checks held (src/lib/framework.ts).
 * `audience: "self"` is what the person themselves may see: no check reads a caution, so neither a
 * row nor a gap in the arithmetic discloses that one exists.
 */
export function trustFor(p: FrameworkPerson, audience: "internal" | "self" = "internal"): TrustScore {
  return trustFromFramework(frameworkFor(p, audience));
}

export function fitFor(p: { attributes: Prisma.JsonValue | null; vouches: { attributes: Prisma.JsonValue | null }[] }): FitProfileRow[] {
  return fitProfile((p.attributes as FitScores | null) ?? null, p.vouches.map((v) => v.attributes as FitScores | null).filter((a): a is FitScores => !!a));
}
