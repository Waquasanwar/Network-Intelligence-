import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import { assessFreshness, ACTIVE_STATUSES } from "@/lib/availability";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { PersonLink } from "@/components/domain/person-link";
import { AvailabilityBadge } from "@/components/domain/badges";
import { DateText } from "@/components/domain/date";
import { AddPersonDrawer } from "@/components/domain/add-person-drawer";
import { AVAILABILITY_LABELS, ROUTE_LABELS, SOURCE_LABELS } from "@/lib/labels";
import type { AvailabilityStatus, EngagementRoute, Prisma } from "@prisma/client";
import { Search } from "lucide-react";

export const metadata = { title: "Network" };

type SP = { q?: string; status?: string; route?: string; location?: string; workedWith?: string; freshness?: string; amanaBench?: string; source?: string; view?: string };

export default async function NetworkPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireInternal();
  const sp = await searchParams;
  const now = new Date();

  const savedViews = await prisma.savedView.findMany({ where: { tenantId: user.tenantId, page: "network" }, orderBy: { name: "asc" } });
  let filters: SP = { ...sp };
  if (sp.view) {
    const v = savedViews.find((s) => s.id === sp.view);
    if (v) filters = { ...(v.query as SP), view: sp.view };
  }

  // Natural-language search: the AI provider turns the query into structured intent (heuristic provider offline).
  const intent = filters.q ? await getAIProvider().parseSearch(filters.q) : null;

  const where: Prisma.PersonWhereInput = { tenantId: user.tenantId };
  const and: Prisma.PersonWhereInput[] = [];
  if (filters.q) {
    const text = filters.q.trim();
    const or: Prisma.PersonWhereInput[] = [
      { firstName: { contains: text, mode: "insensitive" } },
      { lastName: { contains: text, mode: "insensitive" } },
      { headline: { contains: text, mode: "insensitive" } },
      { currentCompany: { contains: text, mode: "insensitive" } },
      { capabilities: { hasSome: [text] } },
    ];
    if (intent) {
      for (const c of intent.capabilities) or.push({ capabilities: { hasSome: [c] } }, { headline: { contains: c, mode: "insensitive" } });
      for (const s of intent.sectors) or.push({ sectors: { hasSome: [s] } });
      for (const l of intent.locations) or.push({ primaryCity: { contains: l, mode: "insensitive" } }, { primaryCountry: { contains: l, mode: "insensitive" } }, { targetLocations: { hasSome: [l] } });
    }
    and.push({ OR: or });
    if (intent?.routes.length) and.push({ engagementPreferences: { hasSome: intent.routes as EngagementRoute[] } });
    if (intent?.availableSoon) and.push({ availabilityStatus: { in: ACTIVE_STATUSES } });
    if (intent?.workedWithOnly) and.push({ relationships: { some: { workedTogether: true } } });
  }
  if (filters.status) and.push({ availabilityStatus: filters.status as AvailabilityStatus });
  if (filters.route) and.push({ engagementPreferences: { has: filters.route as EngagementRoute } });
  if (filters.location) and.push({ OR: [{ primaryCity: { contains: filters.location, mode: "insensitive" } }, { primaryCountry: { contains: filters.location, mode: "insensitive" } }, { targetLocations: { hasSome: [filters.location] } }] });
  if (filters.workedWith) and.push({ relationships: { some: { workedTogether: true } } });
  if (filters.amanaBench) and.push({ amanaBench: true });
  if (filters.source) and.push({ relationships: { some: { sourceType: filters.source as never } } });
  if (and.length) where.AND = and;

  let people = await prisma.person.findMany({
    where,
    include: { relationships: { include: { introducedBy: { select: { firstName: true, lastName: true } }, networkOwner: { select: { name: true } } } }, evidence: { select: { id: true } }, conversations: { select: { approvalStatus: true } } },
    orderBy: [{ updatedAt: "desc" }],
    take: 300,
  });
  if (filters.freshness) people = people.filter((p) => assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate }, now) === (filters.freshness === "stale" ? "stale" : "fresh") || (filters.freshness === "stale" && assessFreshness({ availabilityStatus: p.availabilityStatus, availabilityConfirmedAt: p.availabilityConfirmedAt, nextCheckDate: p.nextCheckDate }, now) === "unknown"));

  const allPeopleLite = await prisma.person.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } });

  const pill = (label: string, key: keyof SP, value: string) => {
    const active = filters[key] === value;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v && k !== "view" && k !== key) params.set(k, v);
    if (!active) params.set(key, value);
    return (
      <Link key={`${key}-${value}`} href={`/network?${params}`} className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${active ? "bg-navy text-white border-navy" : "border-line text-ink-muted hover:border-line-strong"}`}>
        {label}
      </Link>
    );
  };

  return (
    <>
      <PageHeader title="Network" description="Search by relationship, expertise, location and status. Ask in plain language." actions={<AddPersonDrawer people={allPeopleLite} />} />

      <form className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-ink-faint absolute left-2.5 top-2" />
          <Input name="q" defaultValue={filters.q ?? ""} placeholder='e.g. "programme director available soon who we have worked with, open to Dubai"' className="pl-8" />
        </div>
        <Select name="status" defaultValue={filters.status ?? ""} className="w-[200px]">
          <option value="">Any status</option>
          {Object.entries(AVAILABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select name="route" defaultValue={filters.route ?? ""} className="w-[150px]">
          <option value="">Any route</option>
          {Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Input name="location" defaultValue={filters.location ?? ""} placeholder="Location" className="w-[140px]" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {pill("Worked with", "workedWith", "1")}
        {pill("Needs refresh", "freshness", "stale")}
        {pill("Fresh", "freshness", "fresh")}
        {pill("Amana bench", "amanaBench", "1")}
        {pill("Introduced", "source", "INTRODUCTION")}
        <span className="mx-1 text-ink-faint">·</span>
        <span className="text-[11px] text-ink-faint">Saved views:</span>
        {savedViews.map((v) => (
          <Link key={v.id} href={`/network?view=${v.id}`} className={`px-2.5 py-1 rounded-full text-xs border ${filters.view === v.id ? "bg-navy-100 border-navy/20 text-navy" : "border-line text-ink-muted hover:border-line-strong"}`}>{v.name}</Link>
        ))}
        {Object.values(filters).some(Boolean) ? <Link href="/network" className="text-xs text-ink-faint hover:text-ink ml-2">Clear</Link> : null}
      </div>

      {intent && (intent.capabilities.length || intent.locations.length || intent.routes.length || intent.availableSoon || intent.workedWithOnly) ? (
        <div className="mb-3 text-[11px] text-ink-muted flex flex-wrap items-center gap-1.5">
          <span>Understood as:</span>
          {intent.capabilities.map((c) => <Chip key={c}>{c}</Chip>)}
          {intent.sectors.map((c) => <Chip key={c}>{c}</Chip>)}
          {intent.locations.map((c) => <Chip key={c}>📍 {c}</Chip>)}
          {intent.routes.map((c) => <Chip key={c}>{ROUTE_LABELS[c as EngagementRoute]}</Chip>)}
          {intent.availableSoon ? <Chip>available soon</Chip> : null}
          {intent.workedWithOnly ? <Chip>worked with only</Chip> : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-line bg-surface overflow-hidden">
        {people.length === 0 ? (
          <EmptyState title="No one matches" description="Try a broader search, or add the person you have in mind." />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Person</th>
                <th>Provenance</th>
                <th>Expertise</th>
                <th>Location</th>
                <th>Availability</th>
                <th>Routes</th>
                <th>Evidence</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const primary = p.relationships[0];
                return (
                  <tr key={p.id}>
                    <td><PersonLink person={p} sub={p.currentRole ? `${p.currentRole}${p.currentCompany ? ` · ${p.currentCompany}` : ""}` : p.headline} /></td>
                    <td className="text-xs text-ink-muted">
                      {primary ? (
                        <>
                          <div>{SOURCE_LABELS[primary.sourceType]}{primary.workedTogether ? <span className="text-teal"> · worked with</span> : null}</div>
                          <div className="text-[11px] text-ink-faint">{primary.introducedBy ? `via ${primary.introducedBy.firstName} ${primary.introducedBy.lastName}` : `known by ${primary.networkOwner.name.split(" ")[0]}`}</div>
                        </>
                      ) : <span className="text-amber">missing</span>}
                    </td>
                    <td><div className="flex flex-wrap gap-1 max-w-[260px]">{p.capabilities.slice(0, 3).map((c) => <Chip key={c}>{c}</Chip>)}{p.capabilities.length > 3 ? <span className="text-[11px] text-ink-faint">+{p.capabilities.length - 3}</span> : null}</div></td>
                    <td className="text-xs text-ink-muted">{[p.primaryCity, p.primaryCountry].filter(Boolean).join(", ") || "—"}{p.targetLocations.length ? <div className="text-[11px] text-ink-faint">→ {p.targetLocations.join(", ")}</div> : null}</td>
                    <td><AvailabilityBadge status={p.availabilityStatus} confirmedAt={p.availabilityConfirmedAt} nextCheckDate={p.nextCheckDate} /></td>
                    <td className="text-xs text-ink-muted">{p.engagementPreferences.map((r) => ROUTE_LABELS[r]).join(", ") || "—"}</td>
                    <td className="text-xs tabular text-ink-muted">{p.evidence.length} · {p.conversations.filter((c) => c.approvalStatus === "APPROVED").length} conv</td>
                    <td className="text-xs text-ink-muted max-w-[200px]">{p.nextAction ?? "—"}{p.nextActionDate ? <div className="text-[11px] text-ink-faint"><DateText date={p.nextActionDate} relative /></div> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="text-[11px] text-ink-faint mt-2 tabular">{people.length} people</div>
    </>
  );
}
