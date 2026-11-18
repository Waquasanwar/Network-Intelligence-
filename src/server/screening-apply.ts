import "server-only";
import type { Person, Prisma } from "@prisma/client";
import type { ScreeningResult } from "@/lib/screening";

/**
 * A screening is complete enough to accept without a person reading it first when it answers at
 * least this share of the required and important questions. Anything below waits for a person.
 * Only applies when the network owner has switched automatic acceptance on.
 */
export const AUTO_ACCEPT_COMPLETENESS = 80;

/**
 * What an accepted screening writes to the person's own record: the things they told us about
 * themselves (where they can work, notice, rate, seniority). The same for a person's approval and
 * an automatic one, so the two can never drift apart.
 */
export function screeningProfileUpdate(p: Person, r: ScreeningResult | undefined, when: Date): Prisma.PersonUpdateInput {
  const prof = r?.profile;
  return {
    screenedAt: when, screeningStatus: "APPROVED", memberSince: p.memberSince ?? when, referralConsent: prof?.referralConsent ?? p.referralConsent ?? "ask",
    workRights: prof?.workRights.length ? prof.workRights : p.workRights, targetLocations: prof?.targetLocations.length ? [...new Set([...p.targetLocations, ...prof.targetLocations])] : p.targetLocations,
    noticePeriod: prof?.noticePeriod ?? p.noticePeriod, rateExpectation: prof?.rateExpectation ?? p.rateExpectation, salaryExpectation: prof?.salaryExpectation ?? p.salaryExpectation, seniority: prof?.seniority ?? p.seniority,
    primaryCity: prof?.primaryCity ?? p.primaryCity, primaryCountry: prof?.primaryCountry ?? p.primaryCountry, relocationInterest: p.relocationInterest || !!prof?.relocationInterest, nextAction: null, nextActionDate: null,
  };
}
