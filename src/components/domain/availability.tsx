import { MapPin, Briefcase, Clock3, Layers, Wifi, Building2, Shuffle } from "lucide-react";
import { AVAILABILITY_LABELS } from "@/lib/labels";
import { zoneFor, localTime, offsetHours, utcLabel, apart, apartLabel, readiness, PATTERNS, SETTINGS, isPattern, isSetting } from "@/lib/place";
import { LocalClock } from "./local-clock";
import { cn } from "@/lib/utils";
import type { AvailabilityStatus } from "@prisma/client";

export type AvailabilityPerson = {
  availabilityStatus: AvailabilityStatus; availabilityDate?: Date | null;
  workPattern?: string[]; daysPerWeek?: number | null; workSetting?: string[];
  primaryCity?: string | null; primaryCountry?: string | null; timeZone?: string | null;
};

const READY_LABEL = { now: "Free now", soon: "Free soon", later: "Later", no: "Not looking", unknown: "Not confirmed" } as const;
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** "Available now", or "Free from 3 Dec" when there is a date. */
export function statusLine(p: AvailabilityPerson) {
  if (p.availabilityStatus === "UNAVAILABLE_UNTIL" && p.availabilityDate) return `Free from ${day(p.availabilityDate)}`;
  return AVAILABILITY_LABELS[p.availabilityStatus];
}

/** The state of someone's availability as a dot and a word, coloured by how soon they can start. */
export function ReadyPill({ p, onInk = false }: { p: AvailabilityPerson; onInk?: boolean }) {
  const r = readiness({ availabilityStatus: p.availabilityStatus, availabilityDate: p.availabilityDate ?? null });
  return (
    <span className={cn("ready-pill", `is-${r}`, onInk && "on-ink")} data-ready={r} title={READY_LABEL[r]}>
      <span className="ready-dot" aria-hidden="true" />{statusLine(p)}
    </span>
  );
}

/** Days a week as five dots, filled for the days they give. */
function DayDots({ n }: { n: number }) {
  return <span className="day-dots" aria-label={`${n} ${n === 1 ? "day" : "days"} a week`}>{[1, 2, 3, 4, 5].map((d) => <span key={d} data-on={d <= n || undefined} />)}</span>;
}

const PATTERN_ICON = { full_time: Briefcase, part_time: Clock3, per_project: Layers };
const SETTING_ICON = { remote: Wifi, hybrid: Shuffle, onsite: Building2 };

/**
 * Availability at a glance: can they start, how they want to work, where they will work, and where
 * they are in the world, with their local time and, against a project, the hours apart and the
 * working day they share. No paragraphs: a pill, chips and a small place card.
 */
export function AvailabilityView({ p, project, onInk = false, compact = false, className }: {
  p: AvailabilityPerson; project?: { zone: string; label: string } | null; onInk?: boolean; compact?: boolean; className?: string;
}) {
  const zone = zoneFor(p);
  const patterns = (p.workPattern ?? []).filter(isPattern);
  const settings = (p.workSetting ?? []).filter(isSetting);
  const fit = zone && project ? apart(zone, project.zone) : null;
  const place = p.primaryCity ?? p.primaryCountry;
  return (
    <div className={cn("avail", onInk && "on-ink", compact && "is-compact", className)} data-availability>
      <ReadyPill p={p} onInk={onInk} />
      {patterns.length || settings.length ? (
        <span className="avail-chips">
          {patterns.map((k) => { const I = PATTERN_ICON[k]; return <span key={k} className="avail-chip"><I className="h-3.5 w-3.5" aria-hidden="true" />{PATTERNS[k]}{k === "part_time" && p.daysPerWeek ? <DayDots n={p.daysPerWeek} /> : null}</span>; })}
          {settings.length === 3 ? <span className="avail-chip"><Wifi className="h-3.5 w-3.5" aria-hidden="true" />Anywhere</span> : settings.map((k) => { const I = SETTING_ICON[k]; return <span key={k} className="avail-chip"><I className="h-3.5 w-3.5" aria-hidden="true" />{SETTINGS[k]}</span>; })}
        </span>
      ) : null}
      {place ? (
        <span className="avail-place" data-place>
          <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          <span className="truncate">{place}</span>
          {zone ? <><span className="avail-sep" aria-hidden="true" /><LocalClock zone={zone} initial={localTime(zone)} /><span className="avail-faint">{utcLabel(offsetHours(zone))}</span></> : null}
          {fit && project ? <><span className="avail-sep" aria-hidden="true" /><span className={cn("avail-fit", fit.overlap >= 6 ? "is-good" : fit.overlap >= 3 ? "is-ok" : "is-far")} title={`${fit.overlap} working hours shared with ${project.label}`}>{apartLabel(fit.diff)} {project.label} · {fit.overlap}h shared</span></> : null}
        </span>
      ) : null}
    </div>
  );
}
