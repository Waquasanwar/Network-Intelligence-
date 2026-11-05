import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { trustScore } from "@/lib/trust";
import { assessFreshness } from "@/lib/availability";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { NetworkGraph, type GNode, type GLink } from "@/components/domain/network-graph";
import { fullName } from "@/lib/utils";
import { List } from "lucide-react";

export const metadata = { title: "Network map" };

export default async function NetworkMapPage() {
  const user = await requireInternal();
  const now = new Date();

  const people = await prisma.person.findMany({
    where: { tenantId: user.tenantId },
    select: {
      id: true, firstName: true, lastName: true, preferredName: true, headline: true,
      screeningStatus: true, screenedAt: true, availabilityStatus: true, availabilityConfirmedAt: true, nextCheckDate: true,
      relationships: { select: { workedTogether: true, wouldWorkTogetherAgain: true, introducedById: true } },
      vouches: { select: { wouldRecommend: true, voucherKind: true } },
      evidence: { select: { evidenceType: true } },
      conversations: { select: { approvalStatus: true } },
      referralsMade: { select: { status: true } },
    },
    take: 400,
  });

  const ids = new Set(people.map((p) => p.id));
  const HUB = "__hub__";
  const nodes: GNode[] = [{ id: HUB, name: `${user.name.split(" ")[0]}’s network`, headline: "You — the centre of the network", trust: 100, worked: true, hub: true }];
  const links: GLink[] = [];

  for (const p of people) {
    const worked = p.relationships.some((r) => r.workedTogether);
    const t = trustScore({
      vouches: p.vouches.map((v) => ({ wouldRecommend: v.wouldRecommend, external: v.voucherKind === "EXTERNAL" })),
      workedWith: p.relationships.filter((r) => r.workedTogether).length,
      wouldWorkAgain: p.relationships.filter((r) => r.wouldWorkTogetherAgain === true).length,
      evidence: p.evidence.filter((e) => e.evidenceType !== "CAUTION").length,
      cautions: p.evidence.filter((e) => e.evidenceType === "CAUTION").length,
      approvedConversations: p.conversations.filter((c) => c.approvalStatus === "APPROVED").length,
      screened: p.screeningStatus === "APPROVED" || !!p.screenedAt,
      freshness: assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate }, now),
      referralsAccepted: p.referralsMade.filter((r) => r.status === "ACCEPTED").length,
    });
    nodes.push({ id: p.id, name: p.preferredName || fullName(p), headline: p.headline ?? "", trust: t.score, worked });

    const primary = p.relationships[0];
    const introducer = primary?.introducedById && ids.has(primary.introducedById) ? primary.introducedById : null;
    links.push({ source: introducer ?? HUB, target: p.id, worked: !!primary?.workedTogether });
  }

  return (
    <>
      <PageHeader
        title="Network map"
        description="Every person, and how they reach you — who introduced whom, and who you have actually worked with. The quiet power of a trusted network, seen at once."
        actions={<Link href="/network"><Button variant="secondary"><List className="h-3.5 w-3.5" /> List view</Button></Link>}
      />
      {people.length === 0 ? (
        <EmptyState title="No one to map yet" description="Add people to the network and their connections appear here." />
      ) : (
        <NetworkGraph nodes={nodes} links={links} />
      )}
    </>
  );
}
