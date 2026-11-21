/**
 * Where someone is in the world, in working terms: their time zone, their local time, how many
 * hours apart they are from a project, and how much of the working day they share with it.
 *
 * Time zones come from the city (or the country when no city is known). Offsets are read from the
 * runtime's own time zone data for the date asked, so daylight saving is handled.
 * Shared by the app and its tests. No I/O.
 */

const CITY: Record<string, string> = {
  dubai: "Asia/Dubai", "abu dhabi": "Asia/Dubai", sharjah: "Asia/Dubai", "al ain": "Asia/Dubai",
  riyadh: "Asia/Riyadh", jeddah: "Asia/Riyadh", dammam: "Asia/Riyadh", khobar: "Asia/Riyadh", neom: "Asia/Riyadh",
  doha: "Asia/Qatar", manama: "Asia/Bahrain", kuwait: "Asia/Kuwait", "kuwait city": "Asia/Kuwait", muscat: "Asia/Muscat",
  cairo: "Africa/Cairo", amman: "Asia/Amman", beirut: "Asia/Beirut", istanbul: "Europe/Istanbul",
  london: "Europe/London", manchester: "Europe/London", birmingham: "Europe/London", edinburgh: "Europe/London", leeds: "Europe/London", glasgow: "Europe/London", bristol: "Europe/London",
  dublin: "Europe/Dublin", paris: "Europe/Paris", amsterdam: "Europe/Amsterdam", berlin: "Europe/Berlin", frankfurt: "Europe/Berlin", munich: "Europe/Berlin",
  madrid: "Europe/Madrid", barcelona: "Europe/Madrid", milan: "Europe/Rome", rome: "Europe/Rome", zurich: "Europe/Zurich", geneva: "Europe/Zurich",
  brussels: "Europe/Brussels", lisbon: "Europe/Lisbon", stockholm: "Europe/Stockholm", warsaw: "Europe/Warsaw", athens: "Europe/Athens",
  mumbai: "Asia/Kolkata", delhi: "Asia/Kolkata", "new delhi": "Asia/Kolkata", bangalore: "Asia/Kolkata", bengaluru: "Asia/Kolkata", hyderabad: "Asia/Kolkata", chennai: "Asia/Kolkata", pune: "Asia/Kolkata",
  karachi: "Asia/Karachi", lahore: "Asia/Karachi", islamabad: "Asia/Karachi", dhaka: "Asia/Dhaka", colombo: "Asia/Colombo",
  singapore: "Asia/Singapore", "kuala lumpur": "Asia/Kuala_Lumpur", "hong kong": "Asia/Hong_Kong", shanghai: "Asia/Shanghai", tokyo: "Asia/Tokyo", sydney: "Australia/Sydney", melbourne: "Australia/Melbourne",
  johannesburg: "Africa/Johannesburg", "cape town": "Africa/Johannesburg", nairobi: "Africa/Nairobi", lagos: "Africa/Lagos",
  "new york": "America/New_York", boston: "America/New_York", toronto: "America/Toronto", chicago: "America/Chicago", "san francisco": "America/Los_Angeles", "los angeles": "America/Los_Angeles",
};
const COUNTRY: Record<string, string> = {
  uae: "Asia/Dubai", "united arab emirates": "Asia/Dubai", "saudi arabia": "Asia/Riyadh", ksa: "Asia/Riyadh", qatar: "Asia/Qatar", bahrain: "Asia/Bahrain", kuwait: "Asia/Kuwait", oman: "Asia/Muscat",
  egypt: "Africa/Cairo", jordan: "Asia/Amman", lebanon: "Asia/Beirut", turkey: "Europe/Istanbul",
  uk: "Europe/London", "united kingdom": "Europe/London", england: "Europe/London", scotland: "Europe/London", ireland: "Europe/Dublin",
  france: "Europe/Paris", netherlands: "Europe/Amsterdam", germany: "Europe/Berlin", spain: "Europe/Madrid", italy: "Europe/Rome", switzerland: "Europe/Zurich", belgium: "Europe/Brussels", portugal: "Europe/Lisbon",
  india: "Asia/Kolkata", pakistan: "Asia/Karachi", bangladesh: "Asia/Dhaka", "sri lanka": "Asia/Colombo", singapore: "Asia/Singapore", malaysia: "Asia/Kuala_Lumpur", "hong kong": "Asia/Hong_Kong", china: "Asia/Shanghai", japan: "Asia/Tokyo", australia: "Australia/Sydney",
  "south africa": "Africa/Johannesburg", kenya: "Africa/Nairobi", nigeria: "Africa/Lagos", usa: "America/New_York", us: "America/New_York", "united states": "America/New_York", canada: "America/Toronto",
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** The time zone for a place: an explicit zone wins, then the city, then the country. Null when unknown. */
export function zoneFor(p: { timeZone?: string | null; primaryCity?: string | null; primaryCountry?: string | null } | string): string | null {
  if (typeof p === "string") return CITY[norm(p)] ?? COUNTRY[norm(p)] ?? null;
  if (p.timeZone && isZone(p.timeZone)) return p.timeZone;
  return CITY[norm(p.primaryCity)] ?? COUNTRY[norm(p.primaryCountry)] ?? null;
}

export function isZone(z: string) { try { new Intl.DateTimeFormat("en-GB", { timeZone: z }); return true; } catch { return false; } }

/** Hours ahead of UTC in that zone on that date (e.g. 4 for Dubai, 5.5 for Mumbai). */
export function offsetHours(zone: string, at = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
  const v = (t: string) => Number(parts.find((x) => x.type === t)?.value);
  const local = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"));
  const utc = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), at.getUTCHours(), at.getUTCMinutes());
  return Math.round(((local - utc) / 3_600_000) * 4) / 4;
}

/** "UTC+4", "UTC+5:30", "UTC−5". */
export function utcLabel(h: number) {
  const sign = h >= 0 ? "+" : "−"; const a = Math.abs(h); const m = Math.round((a % 1) * 60);
  return `UTC${sign}${Math.floor(a)}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** Their local time, e.g. "14:05". */
export function localTime(zone: string, at = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

/** How a person's clock sits against a project's: hours apart and shared working hours (09:00–18:00 each side). */
export function apart(person: string, project: string, at = new Date()) {
  const diff = offsetHours(person, at) - offsetHours(project, at); // + means the person is ahead
  const start = 9, end = 18; // working day, each in their own time
  // Their 9–18 expressed in project time is (9 − diff) to (18 − diff); overlap with the project's 9–18.
  const overlap = Math.max(0, Math.min(end, end - diff) - Math.max(start, start - diff));
  return { diff, overlap: Math.round(overlap * 2) / 2 };
}

/** "Same time", "3h ahead", "4h 30m behind". */
export function apartLabel(diff: number) {
  if (Math.abs(diff) < 0.25) return "Same time";
  const a = Math.abs(diff); const h = Math.floor(a); const m = Math.round((a - h) * 60);
  return `${h}h${m ? ` ${m}m` : ""} ${diff > 0 ? "ahead" : "behind"}`;
}

export const PATTERNS = { full_time: "Full time", part_time: "Part time", per_project: "Per project" } as const;
export const SETTINGS = { remote: "Remote", hybrid: "Hybrid", onsite: "On site" } as const;
export type Pattern = keyof typeof PATTERNS;
export type Setting = keyof typeof SETTINGS;
export const isPattern = (v: unknown): v is Pattern => typeof v === "string" && v in PATTERNS;
export const isSetting = (v: unknown): v is Setting => typeof v === "string" && v in SETTINGS;

/** Is this person free to start work? now | soon (within 45 days, or finishing up) | later | not looking | unknown. */
export function readiness(p: { availabilityStatus: string; availabilityDate?: Date | null }, now = new Date()): "now" | "soon" | "later" | "no" | "unknown" {
  const s = p.availabilityStatus;
  if (s === "AVAILABLE_NOW" || s === "FRACTIONAL_AVAILABILITY") return "now";
  if (s === "FINISHING_ENGAGEMENT_SOON") return "soon";
  if (s === "UNAVAILABLE_UNTIL" && p.availabilityDate) return p.availabilityDate.getTime() - now.getTime() <= 45 * 86_400_000 ? "soon" : "later";
  if (["HAPPY_WHERE_I_AM", "NOT_LOOKING_KEEP_IN_TOUCH", "TAKING_A_BREAK"].includes(s)) return "no";
  if (s === "NEEDS_REFRESH") return "unknown";
  return "later";
}
