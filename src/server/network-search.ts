import type { Prisma, EngagementRoute } from "@prisma/client";
import { ACTIVE_STATUSES } from "@/lib/availability";
import type { SearchIntent } from "@/lib/ai/types";

/**
 * The filter clauses for a plain-language network search. One definition, used by the Network
 * list and by the home-page agent, so "ask" and "search" can never disagree about who matches.
 */
export function textSearchClauses(text: string, intent: SearchIntent | null): Prisma.PersonWhereInput[] {
  const q = text.trim();
  if (!q) return [];
  const or: Prisma.PersonWhereInput[] = [
    { firstName: { contains: q, mode: "insensitive" } },
    { lastName: { contains: q, mode: "insensitive" } },
    { headline: { contains: q, mode: "insensitive" } },
    { currentCompany: { contains: q, mode: "insensitive" } },
    { capabilities: { hasSome: [q] } },
  ];
  const and: Prisma.PersonWhereInput[] = [];
  if (intent) {
    for (const c of intent.capabilities) or.push({ capabilities: { hasSome: [c] } }, { headline: { contains: c, mode: "insensitive" } });
    for (const s of intent.sectors) or.push({ sectors: { hasSome: [s] } });
    for (const l of intent.locations) or.push({ primaryCity: { contains: l, mode: "insensitive" } }, { primaryCountry: { contains: l, mode: "insensitive" } }, { targetLocations: { hasSome: [l] } });
  }
  and.push({ OR: or });
  if (intent?.routes.length) and.push({ engagementPreferences: { hasSome: intent.routes as EngagementRoute[] } });
  if (intent?.availableSoon) and.push({ availabilityStatus: { in: ACTIVE_STATUSES } });
  if (intent?.workedWithOnly) and.push({ relationships: { some: { workedTogether: true } } });
  return and;
}
