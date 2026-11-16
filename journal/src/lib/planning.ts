// Planning and bottleneck analysis: what is stuck, who it is waiting on, what to chase,
// procurement flow, weekly priorities and project health. Pure functions over entries.

import {
  OPEN_STAGES, STAGES, isClosed, isProcurement, isTracked, loggedAt,
  type Entry, type Project, type Ref, type Stage, type WaitingOn,
} from "./schema";

export const CHASE_AFTER_WORKDAYS = 3; // nudge after three quiet working days
export const STUCK_AFTER_WORKDAYS = 7; // stuck after a quiet working week and a half

const DAY = 86400000;
const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const toDate = (s: string) => (isDateOnly(s) ? new Date(`${s}T12:00:00`) : new Date(s));
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (s: string, n: number) => {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

/** Working days (Mon–Fri) strictly after `from` up to and including `to`. */
export function workdaysBetween(from: string, to: string): number {
  const a = toDate(from.slice(0, 10));
  const b = toDate(to.slice(0, 10));
  if (b <= a) return 0;
  let n = 0;
  const d = new Date(a);
  while (d < b) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

export const daysBetween = (from: string, to: string) => Math.max(0, Math.floor((toDate(to.slice(0, 10)).getTime() - toDate(from.slice(0, 10)).getTime()) / DAY));

/** Last time anything happened on an entry: a chase, an edit, or when it was logged. */
export function lastTouch(e: Entry): string {
  return [e.lastChased, e.lastEdited, loggedAt(e)].filter(Boolean).map((s) => s!.slice(0, 10)).sort().pop()!;
}

export const isOpenAsk = (e: Entry) => isTracked(e) && !isClosed(e) && !(e.stage && !OPEN_STAGES.includes(e.stage));
export const isWaiting = (e: Entry) => isOpenAsk(e) && (e.status === "Waiting on others" || !!e.waitingOn);
export const quietWorkdays = (e: Entry, today: string) => workdaysBetween(lastTouch(e), today);
export const ageDays = (e: Entry, today: string) => daysBetween(loggedAt(e), today);

export function chaseDue(e: Entry, today: string): boolean {
  if (!isWaiting(e)) return false;
  if (e.followUp && e.followUp.slice(0, 10) <= today) return true;
  return quietWorkdays(e, today) >= CHASE_AFTER_WORKDAYS;
}

export function isStuck(e: Entry, today: string): boolean {
  return isOpenAsk(e) && quietWorkdays(e, today) >= STUCK_AFTER_WORKDAYS;
}

// --- Bottlenecks --------------------------------------------------------------------------

export interface Bottleneck {
  who: WaitingOn | "Unassigned";
  count: number;
  avgDays: number;
  oldestDays: number;
  chases: number;
  amount: number;
  stuck: number;
}

export function bottlenecks(entries: Entry[], today: string): Bottleneck[] {
  const groups = new Map<Bottleneck["who"], Entry[]>();
  for (const e of entries.filter(isWaiting)) {
    const k = e.waitingOn ?? "Unassigned";
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.entries()]
    .map(([who, list]) => {
      const ages = list.map((e) => ageDays(e, today));
      return {
        who,
        count: list.length,
        avgDays: Math.round(ages.reduce((a, b) => a + b, 0) / list.length),
        oldestDays: Math.max(...ages),
        chases: list.reduce((s, e) => s + (e.chaseCount || 0), 0),
        amount: list.reduce((s, e) => s + (e.amount || 0), 0),
        stuck: list.filter((e) => isStuck(e, today)).length,
      };
    })
    // Weight by total waiting time so a few very old items rank above many fresh ones.
    .sort((a, b) => b.avgDays * b.count - a.avgDays * a.count);
}

// --- Procurement --------------------------------------------------------------------------

export function procurement(entries: Entry[], today: string) {
  const items = entries.filter(isProcurement);
  const open = items.filter((e) => !isClosed(e) && (!e.stage || OPEN_STAGES.includes(e.stage)));
  const byStage = STAGES.filter((s) => s !== "Closed" && s !== "Rejected").map((stage: Stage) => {
    const list = items.filter((e) => (e.stage ?? "Submitted") === stage && (stage === "Received" ? !isClosed(e) || daysBetween(e.lastEdited, today) <= 30 : true));
    return {
      stage,
      count: list.length,
      amount: list.reduce((s, e) => s + (e.amount || 0), 0),
      avgDays: list.length ? Math.round(list.reduce((s, e) => s + ageDays(e, today), 0) / list.length) : 0,
    };
  });
  const closed = items.filter((e) => isClosed(e) || e.stage === "Received" || e.stage === "Closed");
  const cycle = closed.length ? closed.reduce((s, e) => s + daysBetween(loggedAt(e), e.lastEdited), 0) / closed.length : null;
  return {
    open,
    byStage,
    pendingAmount: open.reduce((s, e) => s + (e.amount || 0), 0),
    stuck: open.filter((e) => isStuck(e, today)).sort((a, b) => quietWorkdays(b, today) - quietWorkdays(a, today)),
    avgCycleDays: cycle,
  };
}

// --- Chasing -----------------------------------------------------------------------------

export function chaseStats(entries: Entry[], today: string) {
  const asks = entries.filter(isTracked);
  const closedWithChases = asks.filter((e) => isClosed(e) && e.chaseCount > 0);
  const closed = asks.filter(isClosed);
  return {
    dueNow: entries.filter((e) => chaseDue(e, today)).sort((a, b) => quietWorkdays(b, today) - quietWorkdays(a, today)),
    totalChases: asks.reduce((s, e) => s + (e.chaseCount || 0), 0),
    avgChasesToClose: closed.length ? closed.reduce((s, e) => s + (e.chaseCount || 0), 0) / closed.length : null,
    closedNeedingChase: closed.length ? closedWithChases.length / closed.length : null,
    mostChased: asks.filter((e) => !isClosed(e) && e.chaseCount > 0).sort((a, b) => b.chaseCount - a.chaseCount).slice(0, 5),
  };
}

export const upward = (entries: Entry[]) =>
  entries.filter((e) => isOpenAsk(e) && (e.direction === "Upward (to management)" || e.waitingOn === "Management"));

// --- Priorities ---------------------------------------------------------------------------

export interface Priority {
  entry: Entry;
  score: number;
  reasons: string[];
}

const PRIORITY_POINTS: Record<string, number> = { "P1 Urgent": 40, "P2 High": 25, "P3 Normal": 10, "P4 Low": 0 };

export function priorities(entries: Entry[], projects: Project[], today: string, horizonDays = 7): Priority[] {
  const end = addDays(today, horizonDays);
  const out: Priority[] = [];
  for (const e of entries) {
    if (isClosed(e) || e.type === "Win" || e.type === "Learning" || e.type === "Note" && !e.due) continue;
    if (!isTracked(e) && !e.due && !e.followUp && e.type !== "Decision") continue;
    if (e.type === "Decision" && (e.outcome || ageDays(e, today) < 30)) continue;
    const reasons: string[] = [];
    let score = PRIORITY_POINTS[e.priority ?? ""] ?? 5;
    if (e.priority === "P1 Urgent") reasons.push("Urgent");
    if (e.due) {
      const d = e.due.slice(0, 10);
      if (d < today) {
        score += 35 + Math.min(20, daysBetween(d, today) * 2);
        reasons.push(`Overdue ${daysBetween(d, today)}d`);
      } else if (d <= end) {
        score += 20;
        reasons.push(d === today ? "Due today" : `Due ${toDate(d).toLocaleDateString("en-GB", { weekday: "short" })}`);
      }
    }
    if (chaseDue(e, today)) {
      score += 15;
      reasons.push(`Chase ${e.waitingOn ?? "owner"} (${quietWorkdays(e, today)}d quiet)`);
    }
    if (isStuck(e, today)) {
      score += Math.min(20, quietWorkdays(e, today));
      reasons.push("Stuck");
    }
    if (e.impact === "High") {
      score += 12;
      reasons.push("High impact");
    }
    if (e.direction === "Upward (to management)" || e.waitingOn === "Management") {
      score += 8;
      reasons.push("With management");
    }
    if (isProcurement(e) && e.amount) {
      score += Math.min(10, Math.round(e.amount / 10000));
      reasons.push(`£${Math.round(e.amount).toLocaleString("en-GB")} pending`);
    }
    if (e.type === "Decision") reasons.push("Decision needs an outcome");
    const proj = projects.filter((p) => e.projectIds.includes(p.id));
    if (proj.some((p) => p.health === "Off track" || p.health === "At risk")) {
      score += 8;
      reasons.push(`${proj.find((p) => p.health === "Off track" || p.health === "At risk")!.name} at risk`);
    }
    if (proj.some((p) => p.priority === "P1 Urgent")) score += 6;
    if (score >= 15 || reasons.length) out.push({ entry: e, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score);
}

// --- Calendar helpers ---------------------------------------------------------------------

export function weekStartOf(day: string): string {
  const d = toDate(day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}

export const weekDays = (day: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(day), i));

export function monthGrid(day: string): string[] {
  const d = toDate(day);
  const first = ymd(new Date(d.getFullYear(), d.getMonth(), 1, 12));
  const start = weekStartOf(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// --- Projects -----------------------------------------------------------------------------

export function projectStats(project: Project, entries: Entry[], today: string) {
  const list = entries.filter((e) => e.projectIds.includes(project.id));
  const open = list.filter(isOpenAsk);
  const overdue = list.filter((e) => e.due && e.due.slice(0, 10) < today && !isClosed(e));
  const stuck = open.filter((e) => isStuck(e, today));
  const waiting = open.filter(isWaiting);
  const spend = list.filter((e) => isProcurement(e) && !isClosed(e)).reduce((s, e) => s + (e.amount || 0), 0);
  const last = list.map((e) => lastTouch(e)).sort().pop();
  const nextDue = list
    .filter((e) => e.due && !isClosed(e) && e.due.slice(0, 10) >= today)
    .sort((a, b) => a.due!.localeCompare(b.due!))[0];
  const risks = list.filter((e) => e.type === "Blocker / Risk" && !isClosed(e));
  // A suggested health from the evidence; the user's own Health setting always wins on screen.
  const pressure = overdue.length * 2 + stuck.length * 2 + risks.length + (project.targetDate && project.targetDate < today ? 3 : 0);
  const suggested = pressure >= 5 ? "Off track" : pressure >= 2 ? "At risk" : "On track";
  return {
    entries: list,
    open,
    overdue,
    stuck,
    waiting,
    risks,
    decisions: list.filter((e) => e.type === "Decision"),
    spend,
    lastActivity: last,
    quietDays: last ? daysBetween(last, today) : null,
    nextDue,
    suggested: suggested as "On track" | "At risk" | "Off track",
  };
}

// --- Weekly brief -------------------------------------------------------------------------

export function weeklyBrief(entries: Entry[], projects: Project[], people: Ref[], today: string) {
  const weekStart = weekStartOf(today);
  const weekEnd = addDays(weekStart, 6);
  const name = (ids: string[], refs: Ref[]) => ids.map((id) => refs.find((r) => r.id === id)?.name).filter(Boolean).join(", ");
  const line = (e: Entry, extra?: string) => {
    const bits = [e.title];
    const proj = name(e.projectIds, projects);
    if (proj) bits.push(`[${proj}]`);
    if (extra) bits.push(`— ${extra}`);
    return bits.join(" ");
  };
  const top = priorities(entries, projects, today).slice(0, 10);
  const chase = chaseStats(entries, today).dueNow.slice(0, 10);
  const dueThisWeek = entries
    .filter((e) => e.due && !isClosed(e) && e.due.slice(0, 10) >= weekStart && e.due.slice(0, 10) <= weekEnd)
    .sort((a, b) => a.due!.localeCompare(b.due!));
  const mgmt = upward(entries);
  const proc = procurement(entries, today);
  const atRisk = projects
    .filter((p) => p.state !== "Done")
    .map((p) => ({ p, s: projectStats(p, entries, today) }))
    .filter(({ p, s }) => p.health === "Off track" || p.health === "At risk" || s.suggested !== "On track");

  const sections = [
    { heading: "Top priorities this week", items: top.map((t) => line(t.entry, t.reasons.join(" · "))) },
    { heading: "Chase", items: chase.map((e) => line(e, `${e.waitingOn ?? "owner"}, ${quietWorkdays(e, today)} working days quiet${e.chaseCount ? `, chased ${e.chaseCount}x` : ""}`)) },
    { heading: "Due this week", items: dueThisWeek.map((e) => line(e, toDate(e.due!.slice(0, 10)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }))) },
    { heading: "Waiting on management", items: mgmt.map((e) => line(e, `${ageDays(e, today)} days open`)) },
    {
      heading: "Procurement to push",
      items: proc.open.map((e) => {
        const amount = e.amount ? `£${Math.round(e.amount).toLocaleString("en-GB")}` : "";
        const extras = [e.stage ?? "Submitted", e.reference && !e.title.includes(e.reference) ? e.reference : "", amount && !e.title.includes(amount) ? amount : "", `${ageDays(e, today)}d old`];
        return line(e, extras.filter(Boolean).join(", "));
      }),
    },
    { heading: "Projects needing attention", items: atRisk.map(({ p, s }) => `${p.name} — ${p.health && p.health !== "Not set" ? p.health : s.suggested}: ${s.overdue.length} overdue, ${s.stuck.length} stuck${p.nextMilestone ? `; next: ${p.nextMilestone}` : ""}`) },
  ];
  const title = `Week of ${toDate(weekStart).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}: priorities`;
  return { title, weekStart, weekEnd, top, sections, people: people.length };
}
