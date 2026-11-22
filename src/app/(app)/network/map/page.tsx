import Link from "next/link";
import { requireInternal } from "@/server/session";
import { buildNetworkMap } from "@/server/network-map";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { NetworkGraph } from "@/components/domain/network-graph";
import { NetworkSky } from "@/components/domain/network-sky";
import { List } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Network map" };

export default async function NetworkMapPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireInternal();
  const { view } = await searchParams;
  const circles = view === "circles";
  const { nodes, links, openRoles } = await buildNetworkMap(user);

  return (
    <>
      <PageHeader
        title="Network map"
        description={circles ? "Your network in circles, with you at the centre. The closer someone is, the better you know them." : "Your network over the places it lives. People rise above their city as trust grows, arcs show who introduced whom, and each city shows its own time of day."}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full border border-line bg-surface p-1" role="group" aria-label="View">
              <Link href="/network/map" aria-current={!circles ? "page" : undefined} className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-[13px]", !circles ? "bg-ink font-semibold text-canvas" : "text-ink-muted hover:text-ink")}>Sky</Link>
              <Link href="/network/map?view=circles" aria-current={circles ? "page" : undefined} className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-[13px]", circles ? "bg-ink font-semibold text-canvas" : "text-ink-muted hover:text-ink")}>Circles</Link>
            </div>
            <Link href="/network"><Button variant="secondary"><List className="h-3.5 w-3.5" /> List</Button></Link>
          </div>
        }
      />
      {nodes.length <= 1 ? (
        <EmptyState title="No one to map yet" description="Add people to the network and their connections appear here." />
      ) : circles ? (
        <NetworkGraph nodes={nodes} links={links} openRoles={openRoles} />
      ) : (
        <NetworkSky nodes={nodes} links={links} openRoles={openRoles} />
      )}
    </>
  );
}
