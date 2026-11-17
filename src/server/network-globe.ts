import "server-only";
import { prisma } from "@/lib/db";
import { locatePlace, type Place } from "@/lib/geo";
import type { GNode, GLink } from "@/components/domain/network-graph";
import type { GlobePlace, GlobeArc } from "@/components/domain/network-globe";

/**
 * The network laid out on the globe: the cities people are in, and the lines between them. Places
 * come from the built-in gazetteer, so nobody's location is sent to an outside service. A person
 * whose city and country are both unknown is counted, not guessed.
 *
 * "Home" is where the lines start. Set NETWORK_HOME (for example "Dubai, UAE") to say where that
 * is; without it, home is the city where most of the people you have delivered with are.
 */
export async function buildGlobe(tenantId: string, nodes: GNode[], links: GLink[]): Promise<{ places: GlobePlace[]; arcs: GlobeArc[]; home: string | null; unplaced: number }> {
  const where = await prisma.person.findMany({ where: { tenantId }, select: { id: true, primaryCity: true, primaryCountry: true } });
  const placeOf = new Map<string, Place>();
  for (const p of where) { const pl = locatePlace(p.primaryCity, p.primaryCountry); if (pl) placeOf.set(p.id, pl); }

  const byKey = new Map<string, GlobePlace>();
  let unplaced = 0;
  for (const n of nodes) {
    if (n.hub) continue;
    const pl = placeOf.get(n.id);
    if (!pl) { unplaced++; continue; }
    const at = byKey.get(pl.key) ?? { ...pl, people: [] };
    at.people.push({ id: n.id, name: n.name, headline: n.headline, trust: Math.round(n.trust), worked: n.worked, open: !!n.open });
    byKey.set(pl.key, at);
  }
  const places = [...byKey.values()].map((p) => ({ ...p, people: p.people.sort((a, b) => b.trust - a.trust) })).sort((a, b) => b.people.length - a.people.length || a.label.localeCompare(b.label));
  if (!places.length) return { places, arcs: [], home: null, unplaced };

  const named = process.env.NETWORK_HOME ? locatePlace(process.env.NETWORK_HOME, process.env.NETWORK_HOME) : null;
  let home = named && byKey.has(named.key) ? named.key : null;
  if (named && !home) { places.push({ ...named, people: [] }); home = named.key; }
  if (!home) home = [...places].sort((a, b) => b.people.filter((x) => x.worked).length - a.people.filter((x) => x.worked).length || b.people.length - a.people.length)[0].key;

  // A line from home to every other city, and one between two cities when someone in one
  // introduced someone in the other.
  const seen = new Set<string>(); const arcs: GlobeArc[] = [];
  const add = (from: string, to: string, intro: boolean) => { if (from === to) return; const k = [from, to].sort().join("|"); if (seen.has(k)) return; seen.add(k); arcs.push({ from, to, intro }); };
  for (const p of places) add(home, p.key, false);
  for (const l of links) { const a = placeOf.get(l.source), b = placeOf.get(l.target); if (a && b) add(a.key, b.key, true); }
  return { places, arcs, home, unplaced };
}
