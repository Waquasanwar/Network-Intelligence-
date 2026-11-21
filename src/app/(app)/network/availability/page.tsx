import Link from "next/link";
import { requireInternal } from "@/server/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Avatar } from "@/components/ui/avatar";
import { AvailabilityView } from "@/components/domain/availability";
import { zoneFor, offsetHours, utcLabel, localTime, apart, readiness } from "@/lib/place";
import { fullName, cn } from "@/lib/utils";

export const metadata = { title: "Availability" };

type Sp = { when?: string; pattern?: string; setting?: string; bench?: string; req?: string };
const ORDER = { now: 0, soon: 1, later: 2, unknown: 3, no: 4 } as const;

/**
 * Who can start, how they want to work, and where they are in the world. Measure it against an open
 * requirement and everyone shows the hours apart and the working day they share with it.
 */
export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const user = await requireInternal();
  const sp = await searchParams;
  const now = new Date();
  const [rows, briefs] = await Promise.all([
    prisma.person.findMany({ where: { tenantId: user.tenantId }, select: { id: true, firstName: true, lastName: true, headline: true, availabilityStatus: true, availabilityDate: true, workPattern: true, daysPerWeek: true, workSetting: true, primaryCity: true, primaryCountry: true, timeZone: true, amanaBench: true } }),
    prisma.brief.findMany({ where: { tenantId: user.tenantId, status: { notIn: ["FILLED", "CLOSED"] } }, select: { id: true, title: true, locations: true, account: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 12 }),
  ]);
  const brief = briefs.find((b) => b.id === sp.req) ?? null;
  const projectZone = brief?.locations[0] ? zoneFor(brief.locations[0]) : null;
  const project = brief && projectZone ? { zone: projectZone, label: brief.locations[0] } : null;

  const people = rows.map((p) => {
    const zone = zoneFor(p); const ready = readiness(p, now);
    const fit = zone && project ? apart(zone, project.zone, now) : null;
    return { ...p, zone, ready, offset: zone ? offsetHours(zone, now) : null, fit };
  });
  const count = (f: (x: (typeof people)[number]) => boolean) => people.filter(f).length;
  // Free people first; when nobody has said they are free, start from everyone.
  const when = sp.when ?? (people.some((x) => x.ready === "now" || x.ready === "soon") ? "free" : "all");
  const shown = people
    .filter((x) => when === "all" || (when === "free" ? x.ready === "now" || x.ready === "soon" : x.ready === when))
    .filter((x) => !sp.pattern || x.workPattern.includes(sp.pattern))
    .filter((x) => !sp.setting || x.workSetting.includes(sp.setting))
    .filter((x) => sp.bench !== "1" || x.amanaBench)
    .sort((a, b) => ORDER[a.ready] - ORDER[b.ready] || (b.fit?.overlap ?? -1) - (a.fit?.overlap ?? -1) || a.lastName.localeCompare(b.lastName));

  // The world strip: one column per time zone, with the people in it.
  const zones = new Map<number, { offset: number; zone: string; cities: Set<string>; people: typeof shown }>();
  for (const x of shown) {
    if (x.offset === null || !x.zone) continue;
    const z = zones.get(x.offset) ?? { offset: x.offset, zone: x.zone, cities: new Set<string>(), people: [] as typeof shown };
    if (x.primaryCity) z.cities.add(x.primaryCity); z.people.push(x); zones.set(x.offset, z);
  }
  const strip = [...zones.values()].sort((a, b) => a.offset - b.offset);
  const projectOffset = project ? offsetHours(project.zone, now) : null;
  const unplaced = shown.filter((x) => x.offset === null).length;

  const q = (patch: Partial<Sp>) => { const n = { ...sp, ...patch }; const s = new URLSearchParams(Object.entries(n).filter(([, v]) => v) as [string, string][]); return `/network/availability${s.toString() ? `?${s}` : ""}`; };
  const pill = (active: boolean) => cn("chip", active && "!border-ink !bg-ink !text-canvas");

  return (
    <>
      <PageHeader title="Availability" description="Who can start, how they want to work, and where they are in the world." />

      <div className="mb-5 flex flex-col gap-3" data-availability-filters>
        <div className="flex flex-wrap gap-2">
          <Link href={q({ when: "free" })} className={pill(when === "free")}>Free now or soon · {count((x) => x.ready === "now" || x.ready === "soon")}</Link>
          <Link href={q({ when: "now" })} className={pill(when === "now")}>Free now · {count((x) => x.ready === "now")}</Link>
          <Link href={q({ when: "soon" })} className={pill(when === "soon")}>Free soon · {count((x) => x.ready === "soon")}</Link>
          <Link href={q({ when: "all" })} className={pill(when === "all")}>Everyone · {people.length}</Link>
          <span className="mx-1 hidden h-8 w-px bg-line sm:block" aria-hidden="true" />
          {[["full_time", "Full time"], ["part_time", "Part time"], ["per_project", "Per project"]].map(([k, l]) => <Link key={k} href={q({ pattern: sp.pattern === k ? undefined : k })} className={pill(sp.pattern === k)}>{l} · {count((x) => x.workPattern.includes(k))}</Link>)}
          {[["remote", "Remote"], ["onsite", "On site"]].map(([k, l]) => <Link key={k} href={q({ setting: sp.setting === k ? undefined : k })} className={pill(sp.setting === k)}>{l}</Link>)}
          <Link href={q({ bench: sp.bench === "1" ? undefined : "1" })} className={pill(sp.bench === "1")}>Amana bench · {count((x) => x.amanaBench)}</Link>
        </div>
        {briefs.length ? (
          <div className="flex flex-wrap items-center gap-2" data-measure>
            <span className="text-[12.5px] text-ink-faint">Measure against</span>
            {briefs.map((b) => <Link key={b.id} href={q({ req: sp.req === b.id ? undefined : b.id })} className={pill(sp.req === b.id)}>{b.title}{b.locations[0] && !b.title.includes(b.locations[0]) ? ` · ${b.locations[0]}` : ""}</Link>)}
          </div>
        ) : null}
      </div>

      {strip.length ? (
        <section className="mb-6" aria-label="Where they are in the world" data-world-strip>
          <div className="world">
            {strip.map((z) => {
              const near = projectOffset !== null && Math.abs(z.offset - projectOffset) <= 3;
              const here = projectOffset !== null && z.offset === projectOffset;
              return (
                <div key={z.offset} className={cn("world-col", near && "is-near", here && "is-here")} data-offset={z.offset}>
                  <div className="world-head">
                    <b className="tabular">{localTime(z.zone, now)}</b>
                    <span>{utcLabel(z.offset)}</span>
                    <small className="truncate">{[...z.cities].slice(0, 2).join(", ") || "—"}</small>
                  </div>
                  <div className="world-people">
                    {z.people.slice(0, 12).map((x) => <Link key={x.id} href={`/network/${x.id}`} title={`${fullName(x)} · ${x.primaryCity ?? x.primaryCountry ?? ""}`} className={cn("world-face", `is-${x.ready}`)}><Avatar person={x} size="sm" /></Link>)}
                    {z.people.length > 12 ? <span className="world-more">+{z.people.length - 12}</span> : null}
                  </div>
                  {here ? <div className="world-tag">{project!.label}</div> : null}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-ink-faint">{project ? `Shaded columns are within three hours of ${project.label}. ` : ""}Each face is ringed by when they can start: mint now, gold soon.{unplaced ? ` ${unplaced} more have no location on record.` : ""}</p>
        </section>
      ) : null}

      <ul className="feed divide-y divide-line" data-availability-list>
        {shown.length === 0 ? <li className="py-8 text-center text-[14px] text-ink-muted">Nobody matches those filters yet.</li> : shown.map((x) => (
          <li key={x.id} className="flex flex-col gap-2.5 py-3.5 sm:flex-row sm:items-center" data-person>
            <Link href={`/network/${x.id}`} className="flex min-w-0 items-center gap-3 sm:w-[260px] sm:flex-none">
              <Avatar person={x} />
              <span className="min-w-0"><b className="block truncate text-[14px] font-semibold text-ink">{fullName(x)}</b><span className="block truncate text-[12px] text-ink-faint">{x.headline ?? ""}</span></span>
            </Link>
            <AvailabilityView p={x} project={project} compact className="min-w-0 flex-1" />
            {x.amanaBench ? <span className="tag is-mint flex-none">Bench</span> : null}
          </li>
        ))}
      </ul>
    </>
  );
}
