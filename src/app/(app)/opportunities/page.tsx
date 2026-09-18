import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, Segmented, Pill } from "@/components/ui/page";
import { StageBadge, RouteBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { KANBAN_STAGES, OPPORTUNITY_STATUS_LABELS, ROUTE_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/utils";
import { NewOpportunityDrawer } from "@/components/domain/opportunity-drawers";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ view?: string; route?: string; source?: string }> }) {
  const user = await requireInternal();
  const sp = await searchParams;
  const view = sp.view === "board" ? "board" : "list";
  const [opps, partners] = await Promise.all([
    prisma.opportunity.findMany({ where: { tenantId: user.tenantId, ...(sp.route ? { engagementRoute: sp.route as never } : {}), ...(sp.source ? { sourceType: sp.source as never } : {}) }, include: { matches: { select: { humanDecision: true } }, introductions: { select: { status: true } }, partner: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.partner.findMany({ select: { id: true, name: true } }),
  ]);


  return (
    <>
      <PageHeader title="Opportunities" description="Start from the client's problem, not a vacancy. The route is decided after we know who we have." actions={<><Segmented current={view} items={[{ key: "list", label: "List", href: `/opportunities?view=list${sp.route ? `&route=${sp.route}` : ""}` }, { key: "board", label: "Board", href: `/opportunities?view=board${sp.route ? `&route=${sp.route}` : ""}` }]} /><NewOpportunityDrawer partners={partners} /></>} />

      <div className="flex flex-wrap gap-1.5 mb-4">
        {Object.entries(ROUTE_LABELS).map(([k, v]) => <Pill key={k} href={`/opportunities?view=${view}${sp.route === k ? "" : `&route=${k}`}`} active={sp.route === k}>{v}</Pill>)}
      </div>

      {opps.length === 0 ? <EmptyState title="No opportunities" description="Create one from a business problem." /> : view === "list" ? (
        <div className="rounded-[16px] border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
          <table className="data">
            <thead><tr><th>Opportunity</th><th>Type</th><th>Source</th><th>Client</th><th>Value</th><th>Location</th><th>Stage</th><th>Matches</th><th>Updated</th></tr></thead>
            <tbody>
              {opps.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/opportunities/${o.id}`} className="font-medium text-ink hover:underline underline-offset-4">{o.title}</Link>{o.isAmana ? <Badge tone="teal" filled className="ml-2">Amana</Badge> : null}</td>
                  <td><RouteBadge route={o.engagementRoute} /></td>
                  <td className="text-xs">{o.sourceType.replace(/_/g, " ").toLowerCase()}{o.partner ? <div className="text-[11px] text-ink-faint">{o.partner.name}</div> : null}</td>
                  <td className="text-xs text-ink-muted">{o.clientName ?? "—"}</td>
                  <td className="text-xs tabular">{o.budget ? `${formatMoney(Number(o.budget), o.currency ?? "GBP")}${o.engagementRoute === "PERMANENT" ? "" : "/day"}` : "—"}</td>
                  <td className="text-xs text-ink-muted">{o.location ?? "—"}</td>
                  <td><StageBadge status={o.status} /></td>
                  <td className="text-xs tabular">{o.matches.length} <span className="text-ink-faint">· {o.matches.filter((m) => m.humanDecision === "RECOMMEND").length} rec · {o.introductions.length} intro</span></td>
                  <td><DateText date={o.updatedAt} relative className="text-xs text-ink-faint" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-3 min-h-[400px]">
          {KANBAN_STAGES.map((stage) => {
            const cards = opps.filter((o) => o.status === stage);
            return (
              <div key={stage} className="rounded-[16px] bg-surface-muted/70 border border-line p-2.5">
                <div className="flex items-center justify-between px-1 mb-2"><span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{OPPORTUNITY_STATUS_LABELS[stage]}</span><span className="text-[11px] text-ink-faint tabular">{cards.length}</span></div>
                <div className="space-y-2">
                  {cards.map((o) => (
                    <Link key={o.id} href={`/opportunities/${o.id}`} className="block rounded-[12px] border border-line bg-surface p-3 lift shadow-[var(--shadow-card)]">
                      <div className="text-[13px] font-medium leading-4 text-ink">{o.title}</div>
                      <div className="text-[11px] text-ink-faint mt-1 truncate">{o.clientName ?? "—"}</div>
                      <div className="flex items-center justify-between gap-2 mt-2.5 whitespace-nowrap"><RouteBadge route={o.engagementRoute} /><span className="text-[11px] text-ink-faint tabular flex-none">{o.matches.length} matches</span></div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
