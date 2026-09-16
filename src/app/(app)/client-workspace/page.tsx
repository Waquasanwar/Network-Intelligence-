import { requireUser } from "@/server/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isClient } from "@/lib/authz";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RouteBadge, StageBadge } from "@/components/domain/badges";
import { ROUTE_LABELS } from "@/lib/labels";

export const metadata = { title: "Client workspace" };

/** Phase 4 preview: a client sees its own requirements and curated recommendations only. */
export default async function ClientWorkspace() {
  const user = await requireUser();
  if (!isClient(user)) redirect("/forbidden");
  const opps = await prisma.opportunity.findMany({ where: { sourceType: "DIRECT_CLIENT", clientName: { equals: user.tenantName, mode: "insensitive" } }, include: { introductions: { where: { status: { in: ["INTRODUCED", "IN_PROGRESS", "ENGAGED"] } }, include: { person: { select: { firstName: true, lastName: true, headline: true } } } } }, orderBy: { updatedAt: "desc" } });
  return (
    <>
      <PageHeader eyebrow={user.tenantName} title="Client workspace" description="Your requirements and the people we have introduced. Recommendations are curated by a human who knows them." />
      {opps.length === 0 ? <EmptyState title="No requirements yet" description="Your account manager will add your first problem statement." /> : (
        <div className="space-y-3">
          {opps.map((o) => (
            <Card key={o.id}>
              <CardHeader title={o.title} action={<div className="flex gap-1.5"><RouteBadge route={o.engagementRoute} /><StageBadge status={o.status} /></div>} description={`${ROUTE_LABELS[o.engagementRoute]}${o.location ? ` · ${o.location}` : ""}`} />
              <CardBody>
                <p className="text-[13px] mb-3">{o.problemStatement}</p>
                <div className="text-[11px] uppercase text-ink-faint mb-1">Introduced</div>
                {o.introductions.length === 0 ? <div className="text-xs text-ink-faint">No introductions yet.</div> : <ul className="text-xs space-y-1">{o.introductions.map((i) => <li key={i.id}><span className="font-medium">{i.person.firstName} {i.person.lastName}</span> <span className="text-ink-faint">— {i.person.headline}</span> <Badge tone="teal">{i.status.toLowerCase().replace(/_/g, " ")}</Badge></li>)}</ul>}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
