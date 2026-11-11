import Link from "next/link";
import { requireInternal } from "@/server/session";
import { buildNetworkMap } from "@/server/network-map";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { NetworkGraph } from "@/components/domain/network-graph";
import { List } from "lucide-react";

export const metadata = { title: "Network map" };

export default async function NetworkMapPage() {
  const user = await requireInternal();
  const { nodes, links, openRoles } = await buildNetworkMap(user);

  return (
    <>
      <PageHeader
        title="Network map"
        description="Everyone you know and how they reach you. Filter by what they're strong at, then click a person to see why you'd trust them and which open roles they fit."
        actions={<Link href="/network"><Button variant="secondary"><List className="h-3.5 w-3.5" /> List view</Button></Link>}
      />
      {nodes.length <= 1 ? (
        <EmptyState title="No one to map yet" description="Add people to the network and their connections appear here." />
      ) : (
        <NetworkGraph nodes={nodes} links={links} openRoles={openRoles} />
      )}
    </>
  );
}
