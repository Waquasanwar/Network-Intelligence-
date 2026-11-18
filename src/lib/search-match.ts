import type { SearchIntent } from "@/lib/ai/types";

/** Words that say nothing about a skill. */
const STOP = new Set(["and", "the", "for", "with", "who", "can", "our", "need", "someone", "people", "person", "lead", "role", "work", "help", "years", "experience", "senior", "available", "now"]);
const low = (v: string | null | undefined) => (v ?? "").toLowerCase();

/**
 * Matching is on what people do and where, never on who they are: names, employers and headlines
 * are left out on purpose, so nobody can search for a person by name to learn they are here.
 */
export function matchesSearch(p: { capabilities: string[]; sectors: string[]; primaryCountry: string | null; primaryCity: string | null; targetLocations: string[] }, q: string, intent: SearchIntent | null): boolean {
  const words = [...new Set(q.toLowerCase().split(/[^a-z0-9&+#]+/).filter((w) => w.length >= 3 && !STOP.has(w)))];
  const skills = [...p.capabilities, ...p.sectors].map(low);
  const places = [p.primaryCountry, p.primaryCity, ...p.targetLocations].map(low).filter(Boolean);
  const wanted = [...words, ...(intent?.capabilities ?? []).map(low), ...(intent?.sectors ?? []).map(low)];
  const skillHit = !wanted.length || wanted.some((w) => skills.some((s) => s.includes(w) || (w.length > 5 && w.includes(s))));
  const placeWanted = (intent?.locations ?? []).map(low);
  const placeHit = !placeWanted.length || placeWanted.some((l) => places.some((x) => x.includes(l)));
  // A query that is only a place ("Dubai") is answered by place alone.
  const onlyPlace = placeWanted.length > 0 && words.every((w) => placeWanted.some((l) => l.includes(w)));
  return (onlyPlace || skillHit) && placeHit;
}

