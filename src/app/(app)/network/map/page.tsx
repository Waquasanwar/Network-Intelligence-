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
        description="Your network as one living thing, with you at the centre. The closer someone is, the better you know them, and a gold ring marks where it is growing."
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
