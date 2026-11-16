import { requireUser } from "@/server/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isClient } from "@/lib/authz";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RouteBadge, StageBadge } from "@/components/domain/badges";
import { ROUTE_LABELS } from "@/lib/labels";
import { INTRO_NAMING_STATUSES, introNameVisible } from "@/lib/reveal";
import { opaqueKey } from "@/lib/refs";

export const metadata = { title: "Client workspace" };

/** Phase 4 preview: a client sees its own requirements and curated recommendations only. */
export default async function ClientWorkspace() {
  const user = await requireUser();
  if (!isClient(user)) redirect("/forbidden");
  // A client is tied to a network by its portal account (a foreign key), never by matching names
  // across the whole database. Its requirements are the ones that network logged for that account.
  const account = await prisma.commercialAccount.findUnique({ where: { portalTenantId: user.tenantId }, select: { tenantId: true, name: true, portalEnabled: true } });
  const rows = account?.portalEnabled
    ? await prisma.opportunity.findMany({ where: { tenantId: account.tenantId, sourceType: "DIRECT_CLIENT", clientName: { equals: account.name, mode: "insensitive" } }, include: { introductions: { where: { status: { in: [...INTRO_NAMING_STATUSES] } }, include: { person: { select: { firstName: true, lastName: true, headline: true, privacy: true, referralConsent: true } } } } }, orderBy: { updatedAt: "desc" } })
    : [];
  // Only what the client may see leaves the server: a name once the person has agreed to this
  // introduction and still allows it. No internal ids.
  const opps = rows.map((o) => ({
    key: opaqueKey(user.tenantId, o.id), title: o.title, engagementRoute: o.engagementRoute, status: o.status, location: o.location, problemStatement: o.problemStatement,
    introductions: o.introductions.filter((i) => introNameVisible(i, i.person)).map((i) => ({ key: opaqueKey(user.tenantId, i.id), name: `${i.person.firstName} ${i.person.lastName}`, headline: i.person.headline, status: i.status })),
  }));
  return (
    <>
      <PageHeader eyebrow={user.tenantName} title="Client workspace" description="Your requirements and the people we have introduced. Recommendations are curated by a human who knows them." />
      {opps.length === 0 ? <EmptyState title="No requirements yet" description="Your account manager will add your first problem statement." /> : (
        <div className="space-y-3">
          {opps.map((o) => (
            <Card key={o.key}>
              <CardHeader title={o.title} action={<div className="flex gap-1.5"><RouteBadge route={o.engagementRoute} /><StageBadge status={o.status} /></div>} description={`${ROUTE_LABELS[o.engagementRoute]}${o.location ? ` · ${o.location}` : ""}`} />
              <CardBody>
                <p className="text-[13px] mb-3">{o.problemStatement}</p>
                <div className="label-caps text-ink-faint mb-1">Introduced</div>
                {o.introductions.length === 0 ? <div className="text-xs text-ink-faint">No introductions yet.</div> : <ul className="text-xs space-y-1">{o.introductions.map((i) => <li key={i.key}><span className="font-medium">{i.name}</span> {i.headline ? <span className="text-ink-faint">· {i.headline}</span> : null} <Badge tone="teal">{i.status.toLowerCase().replace(/_/g, " ")}</Badge></li>)}</ul>}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
