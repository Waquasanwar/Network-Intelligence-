/**
 * The agent's read of the Amana bench against live Amana work: who can start, what the work needs
 * that the bench cannot cover (and whether the wider network can), how the time zones line up, and
 * who has gone quiet. Every sentence is built from records; nothing is guessed.
 * Shared by the app and its tests. No I/O.
 */
import { capabilityCoverage } from "./matching";
import { zoneFor, offsetHours, apart, readiness } from "./place";

export type IntelPerson = {
  id: string; firstName: string; lastName: string; capabilities: string[];
  availabilityStatus: string; availabilityDate: Date | null; availabilityConfirmedAt: Date | null;
  workPattern: string[]; primaryCity: string | null; primaryCountry: string | null; timeZone: string | null;
  amanaBench: boolean; usedByAmana: boolean; memberUser?: { id: string } | null;
};
export type Demand = { id: string; title: string; capabilities: string[]; location: string | null; href: string };
export type Insight = { text: string; tone: "good" | "watch" | "act"; href?: string; action?: "ask-bench" };

const has = (p: IntelPerson, cap: string) => capabilityCoverage([cap], p.capabilities).covered.length > 0;
const names = (xs: IntelPerson[], n = 2) => xs.slice(0, n).map((x) => x.firstName).join(" and ") + (xs.length > n ? ` and ${xs.length - n} more` : "");

export function amanaIntel(people: IntelPerson[], demand: Demand[], now = new Date()) {
  const ready = (p: IntelPerson) => readiness(p, now);
  const free = (p: IntelPerson) => ready(p) === "now" || ready(p) === "soon";
  const bench = people.filter((p) => p.amanaBench || p.usedByAmana);
  const wider = people.filter((p) => !p.amanaBench && !p.usedByAmana);
  const count = { now: 0, soon: 0, later: 0, unknown: 0, no: 0 };
  for (const p of bench) count[ready(p)]++;
  const stale = bench.filter((p) => !p.availabilityConfirmedAt || now.getTime() - p.availabilityConfirmedAt.getTime() > 60 * 86_400_000);
  const freeBench = bench.filter(free), freeWider = wider.filter(free);

  // What live work needs, capability by capability, against who is free to do it.
  const caps = new Map<string, Demand[]>();
  for (const d of demand) for (const c of d.capabilities) caps.set(c, [...(caps.get(c) ?? []), d]);
  const supply = [...caps.entries()].map(([capability, ds]) => ({ capability, needed: ds.length, demand: ds, bench: freeBench.filter((p) => has(p, capability)), network: freeWider.filter((p) => has(p, capability)) }))
    .sort((a, b) => a.bench.length - b.bench.length || b.needed - a.needed);

  // Where free people are, one entry per time zone, and the places live work is.
  const zones = new Map<number, { offset: number; zone: string; cities: Set<string>; bench: number; network: number }>();
  for (const p of [...freeBench, ...freeWider]) {
    const z = zoneFor(p); if (!z) continue; const o = offsetHours(z, now);
    const e = zones.get(o) ?? { offset: o, zone: z, cities: new Set<string>(), bench: 0, network: 0 };
    if (p.primaryCity) e.cities.add(p.primaryCity); if (p.amanaBench || p.usedByAmana) e.bench++; else e.network++; zones.set(o, e);
  }
  const workPlaces = [...new Set(demand.map((d) => d.location).filter((l): l is string => !!l))].map((l) => ({ label: l, zone: zoneFor(l) })).filter((x): x is { label: string; zone: string } => !!x.zone);

  const patterns = { full_time: 0, part_time: 0, per_project: 0 };
  for (const p of freeBench) for (const k of p.workPattern) if (k in patterns) patterns[k as keyof typeof patterns]++;

  const insights: Insight[] = [];
  if (bench.length) insights.push({ tone: count.now ? "good" : "watch", text: `${count.now} of your ${bench.length} core experts can start now${count.soon ? `, and ${count.soon} soon` : ""}.`, href: "/network/availability?bench=1" });
  for (const s of supply.filter((x) => !x.bench.length).slice(0, 2)) {
    insights.push(s.network.length
      ? { tone: "watch", text: `Nobody on the bench is free for ${s.capability}, but ${s.network.length} in the wider network ${s.network.length === 1 ? "is" : "are"}: ${names(s.network)}. Worth bringing closer.`, href: `/network/${s.network[0].id}` }
      : { tone: "act", text: `Nobody free covers ${s.capability}, which ${s.demand[0].title} needs. Ask members who they know.`, href: s.demand[0].href });
  }
  for (const w of workPlaces.slice(0, 2)) {
    const pool = [...freeBench, ...freeWider].map((p) => ({ p, z: zoneFor(p) })).filter((x): x is { p: IntelPerson; z: string } => !!x.z);
    const close = pool.filter((x) => apart(x.z, w.zone, now).overlap >= 6).length;
    if (pool.length) insights.push({ tone: close ? "good" : "watch", text: `${close} of ${pool.length} free people keep hours that work with ${w.label}${pool.length - close ? `; ${pool.length - close} are four or more hours apart` : ""}.` });
  }
  if (patterns.per_project || patterns.part_time) insights.push({ tone: "good", text: `On the bench, ${patterns.per_project} free ${patterns.per_project === 1 ? "expert is" : "experts are"} open to per-project SOW work and ${patterns.part_time} to part time.` });
  if (stale.length) insights.push({ tone: "act", text: `${stale.length} core ${stale.length === 1 ? "expert has" : "experts have"} not confirmed availability in two months: ${names(stale)}. I can ask them.`, action: "ask-bench" });

  return { bench, count, stale, freeBench, freeWider, supply, zones: [...zones.values()].sort((a, b) => a.offset - b.offset), workPlaces, patterns, insights };
}
