// Pattern analysis over journal entries. Runs in the browser so times use the viewer's timezone.

import { ENTRY_TYPES, isClosed, loggedAt, type Entry, type Ref } from "./schema";

export const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const TIME_BLOCKS = ["Before 9", "9–12", "12–2", "2–5", "After 5"];

const isDateOnly = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso);
/** Parse an ISO datetime, or a bare date as local midday. */
const toDate = (iso: string) => (isDateOnly(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso));
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Local calendar date (YYYY-MM-DD) of an ISO datetime or date. */
export function localDate(iso: string): string {
  return isDateOnly(iso) ? iso : ymd(new Date(iso));
}

export function weekday(iso: string): string {
  return WEEKDAY_ORDER[(toDate(iso).getDay() + 6) % 7];
}

export function timeBlock(iso: string): string | undefined {
  if (isDateOnly(iso)) return undefined; // backdated to a day, no time
  const h = new Date(iso).getHours();
  return h < 9 ? TIME_BLOCKS[0] : h < 12 ? TIME_BLOCKS[1] : h < 14 ? TIME_BLOCKS[2] : h < 17 ? TIME_BLOCKS[3] : TIME_BLOCKS[4];
}

/** Monday of the entry's week, YYYY-MM-DD. */
export function weekStart(iso: string): string {
  const d = toDate(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}

function countBy<T>(items: T[], key: (t: T) => string | string[] | undefined) {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    for (const v of Array.isArray(k) ? k : k ? [k] : []) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

function top(m: Map<string, number>, n: number) {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
}

/** Rows of { [x]: label, [series...]: count } for stacked charts. */
function matrix<T>(items: T[], xs: string[], x: (t: T) => string | undefined, s: (t: T) => string | undefined, xKey: string) {
  const rows = xs.map((label) => ({ [xKey]: label }) as Record<string, string | number>);
  const series = new Set<string>();
  for (const it of items) {
    const xv = x(it);
    const sv = s(it) ?? "Not set";
    const row = rows.find((r) => r[xKey] === xv);
    if (!row) continue;
    series.add(sv);
    row[sv] = ((row[sv] as number) ?? 0) + 1;
  }
  return { rows, series: [...series] };
}

export function filterPeriod(entries: Entry[], days: number | null, now = new Date()): Entry[] {
  if (!days) return entries;
  const cutoff = now.getTime() - days * 86400000;
  return entries.filter((e) => toDate(loggedAt(e)).getTime() >= cutoff);
}

export function computeInsights(entries: Entry[], people: Ref[], projects: Ref[], now = new Date()) {
  const name = (refs: Ref[]) => (id: string) => refs.find((r) => r.id === id)?.name ?? "Unknown";
  const personName = name(people);
  const projectName = name(projects);

  // Entries per week, stacked by type.
  const weeks = [...new Set(entries.map((e) => weekStart(loggedAt(e))))].sort();
  const perWeek = matrix(entries, weeks, (e) => weekStart(loggedAt(e)), (e) => e.type, "week");

  const byWeekday = matrix(entries, WEEKDAY_ORDER, (e) => weekday(loggedAt(e)), (e) => e.type, "day");
  const byTime = matrix(entries.filter((e) => timeBlock(loggedAt(e))), TIME_BLOCKS, (e) => timeBlock(loggedAt(e)), (e) => e.energy, "block");
  const categories = [...new Set(entries.map((e) => e.category ?? "Uncategorised"))];
  const sentimentByCategory = matrix(entries, categories, (e) => e.category ?? "Uncategorised", (e) => e.sentiment, "category");

  const typeMix = ENTRY_TYPES.map((t) => ({ name: t, count: entries.filter((e) => e.type === t).length })).filter((r) => r.count);

  // Requests: turnaround and who they come from.
  const requests = entries.filter((e) => e.type === "Request");
  const closedReq = requests.filter((e) => e.status === "Done");
  const turnaround = closedReq.length
    ? closedReq.reduce((s, e) => s + (new Date(e.lastEdited).getTime() - toDate(loggedAt(e)).getTime()) / 86400000, 0) / closedReq.length
    : null;
  const openReq = requests.filter((e) => !isClosed(e));
  const today = ymd(now);
  const overdue = entries.filter((e) => e.due && e.due.slice(0, 10) < today && !isClosed(e));
  const requestsByPerson = top(countBy(requests, (e) => e.peopleIds.map(personName)), 6);

  // Decisions that are a month old with no recorded outcome.
  const monthAgo = now.getTime() - 30 * 86400000;
  const decisions = entries.filter((e) => e.type === "Decision");
  const toRevisit = decisions.filter((e) => !e.outcome && toDate(loggedAt(e)).getTime() < monthAgo);

  // Capture streak: consecutive weekdays (Mon–Fri) with at least one entry, ending today or the last working day.
  const days = new Set(entries.map((e) => localDate(loggedAt(e))));
  let streak = 0;
  const cursor = new Date(now);
  if (!days.has(ymd(cursor))) cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 400; i++) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      if (!days.has(ymd(cursor))) break;
      streak++;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  const busiestDay = top(countBy(entries, (e) => weekday(loggedAt(e))), 1)[0];
  const lowEnergy = top(countBy(entries.filter((e) => e.energy === "Low"), (e) => timeBlock(loggedAt(e))), 1)[0];
  const negative = top(countBy(entries.filter((e) => e.sentiment === "Negative"), (e) => e.category), 1)[0];
  const topTag = top(countBy(entries, (e) => e.tags), 1)[0];

  const observations: string[] = [];
  if (busiestDay) observations.push(`${busiestDay.name} is your busiest day (${busiestDay.count} entries).`);
  if (lowEnergy) observations.push(`Low energy shows up most ${lowEnergy.name === "Before 9" || lowEnergy.name === "After 5" ? lowEnergy.name.toLowerCase() : `between ${lowEnergy.name}`}.`);
  if (negative) observations.push(`${negative.name} produces the most negative entries (${negative.count}).`);
  if (topTag) observations.push(`#${topTag.name} is your most used tag.`);
  if (turnaround !== null) observations.push(`Requests take ${turnaround.toFixed(1)} days on average to close.`);
  if (toRevisit.length) observations.push(`${toRevisit.length} decision${toRevisit.length > 1 ? "s are" : " is"} over a month old with no outcome recorded.`);

  return {
    total: entries.length,
    perWeek,
    byWeekday,
    byTime,
    sentimentByCategory,
    typeMix,
    topTags: top(countBy(entries, (e) => e.tags), 10),
    topPeople: top(countBy(entries, (e) => e.peopleIds.map(personName)), 8),
    topProjects: top(countBy(entries, (e) => e.projectIds.map(projectName)), 8),
    requestsByPerson,
    turnaround,
    openRequests: openReq.length,
    overdue: overdue.length,
    decisions: decisions.length,
    toRevisit,
    streak,
    observations,
  };
}

export type Insights = ReturnType<typeof computeInsights>;
