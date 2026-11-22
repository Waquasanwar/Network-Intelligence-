import Link from "next/link";
import { requireInternal } from "@/server/session";
import { buildNetworkMap } from "@/server/network-map";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { NetworkGraph } from "@/components/domain/network-graph";
import { NetworkSky } from "@/components/domain/network-sky";
import { TrustOrbit, type OrbitPerson } from "@/components/domain/trust-orbit";
import { CIRCLES, circleOf } from "@/lib/circles";
import { List } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Network map" };

export default async function NetworkMapPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireInternal();
  const { view } = await searchParams;
  const circles = view === "circles", orbit = view === "orbit";
  const { nodes, links, openRoles, total } = await buildNetworkMap(user, new Date(), { photos: orbit });

  // The orbit: the same people and the same circles, drawn as faces, with who knows whom on each card.
  const hub = nodes.find((n) => n.hub);
  const nameOf = new Map(nodes.map((n) => [n.id, n.name]));
  const cameThrough = new Map(links.filter((l) => l.source !== hub?.id).map((l) => [l.target, l.source]));
  const faces: OrbitPerson[] = orbit ? nodes.filter((n) => !n.hub).map((n) => {
    const ring = circleOf(n), via = cameThrough.get(n.id);
    return {
      id: n.id, name: n.name, headline: n.headline, photo: n.photo, ring,
      groups: [`c${ring}`, ...(n.open ? ["open"] : [])],
      note: [n.worked ? "You have worked together" : CIRCLES[ring].hint, via ? `Came through ${nameOf.get(via) ?? "someone in the network"}` : null].filter(Boolean).join(" · "),
      chips: n.capabilities?.slice(0, 4), href: `/network/${n.id}`, weight: n.trust + (n.worked ? 50 : 0),
    };
  }) : [];
  const tab = (on: boolean) => cn("inline-flex h-8 items-center rounded-full px-3.5 text-[13px]", on ? "bg-ink font-semibold text-canvas" : "text-ink-muted hover:text-ink");

  return (
    <>
      <PageHeader
        title="Network map"
        description={orbit ? "Everyone you know, as faces around you. The closer someone sits, the better you know them. Choose a face to see who they know." : circles ? "Your network in circles, with you at the centre. The closer someone is, the better you know them." : "Your network over the places it lives. People rise above their city as trust grows, arcs show who introduced whom, and each city shows its own time of day."}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-line bg-surface p-1" role="group" aria-label="View">
              <Link href="/network/map" aria-current={!circles && !orbit ? "page" : undefined} className={tab(!circles && !orbit)}>Sky</Link>
              <Link href="/network/map?view=circles" aria-current={circles ? "page" : undefined} className={tab(circles)}>Circles</Link>
              <Link href="/network/map?view=orbit" aria-current={orbit ? "page" : undefined} className={tab(orbit)}>Orbit</Link>
            </div>
            <Link href="/network"><Button variant="secondary"><List className="h-3.5 w-3.5" /> List</Button></Link>
          </div>
        }
      />
      {nodes.length <= 1 ? (
        <EmptyState title="No one to map yet" description="Add people to the network and their connections appear here." />
      ) : orbit ? (
        <TrustOrbit
          centre={{ name: user.name }} people={faces} links={links.filter((l) => l.source !== hub?.id)} moreHref="/network" total={total}
          groups={[...CIRCLES.map((c, i) => ({ key: `c${i}`, label: c.label, hint: c.hint })), { key: "open", label: "Open to work", hint: "Available now or soon" }]}
          caption={`${total.toLocaleString("en-GB")} ${total === 1 ? "person" : "people"} · closer means you know them better`}
          label={`Your network as faces in three circles around you: ${CIRCLES.map((c, i) => `${faces.filter((f) => f.ring === i).length} ${c.label.toLowerCase()}`).join(", ")}`}
        />
      ) : circles ? (
        <NetworkGraph nodes={nodes} links={links} openRoles={openRoles} total={total} />
      ) : (
        <NetworkSky nodes={nodes} links={links} openRoles={openRoles} total={total} />
      )}
    </>
  );
}
