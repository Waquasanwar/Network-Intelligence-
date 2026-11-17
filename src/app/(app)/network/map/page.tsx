import Link from "next/link";
import { requireInternal } from "@/server/session";
import { buildNetworkMap } from "@/server/network-map";
import { buildGlobe } from "@/server/network-globe";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { NetworkGraph } from "@/components/domain/network-graph";
import { NetworkGlobe } from "@/components/domain/network-globe";
import { cn } from "@/lib/utils";
import { Globe2, Orbit } from "lucide-react";

export const metadata = { title: "Network map" };

/** Two ways to see the same people: where they are in the world, and how close they are to you. */
export default async function NetworkMapPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireInternal();
  const { view } = await searchParams;
  const { nodes, links, openRoles } = await buildNetworkMap(user);
  const globe = await buildGlobe(user.tenantId, nodes, links);
  // Nobody with a known location yet: the circles still work, so show those.
  const world = view !== "circles" && globe.places.some((p) => p.people.length);

  const views = [
    { key: "world", label: "World", href: "/network/map", icon: Globe2, on: world },
    { key: "circles", label: "Circles of trust", href: "/network/map?view=circles", icon: Orbit, on: !world },
  ];

  return (
    <>
      <PageHeader
        title="Network map"
        description={world ? "Where your people are, and the routes between them. Pick a city to see who is there." : "Everyone you know by how close they are to you. Click a person to see why you'd trust them and which open roles they fit."}
        actions={
          <nav aria-label="Map view" className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-[var(--shadow-card)]">
            {views.map((v) => <Link key={v.key} href={v.href} aria-current={v.on ? "page" : undefined} className={cn("inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] transition-colors duration-200", v.on ? "bg-navy font-semibold text-white dark:text-canvas" : "font-medium text-ink-muted hover:bg-surface-muted hover:text-ink")}><v.icon className="h-3.5 w-3.5" /> {v.label}</Link>)}
          </nav>
        }
      />
      {nodes.length <= 1 ? (
        <EmptyState title="No one to map yet" description="Add people to the network and their connections appear here." />
      ) : world ? (
        <NetworkGlobe places={globe.places} arcs={globe.arcs} home={globe.home} unplaced={globe.unplaced} />
      ) : (
        <NetworkGraph nodes={nodes} links={links} openRoles={openRoles} />
      )}
    </>
  );
}
