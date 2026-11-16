import type { Entry, EntryInput, Ref } from "./schema";
import type { Repo } from "./repo";
import { parseCapture } from "./parse";

// Demo mode: an in-memory store seeded with six weeks of realistic entries, used when
// NOTION_TOKEN is not set. Data resets when the server restarts.

const people: Ref[] = [
  { id: "p-sarah", name: "Sarah Khan" },
  { id: "p-james", name: "James Okafor" },
  { id: "p-priya", name: "Priya Shah" },
  { id: "p-tom", name: "Tom Reid" },
  { id: "p-lena", name: "Lena Fischer" },
];
const projects: Ref[] = [
  { id: "pr-migration", name: "Data Migration" },
  { id: "pr-q1", name: "Q1 Planning" },
  { id: "pr-acme", name: "Acme Onboarding" },
  { id: "pr-hiring", name: "Team Hiring" },
];

const SEED: Array<[string, Partial<Entry>]> = [
  ["d: go with vendor B for the migration, cheaper and SOC2 ready +Data_Migration @James", { impact: "High", rationale: "20% cheaper, SOC2 in place, can start in two weeks", alternatives: "Vendor A (faster, pricier); build in-house (no capacity)", energy: "High" }],
  ["Can you pull the Q4 headcount numbers by Friday @Sarah +Team_Hiring !2", { energy: "OK" }],
  ["Acme said onboarding felt slow in week one +Acme_Onboarding on the call", { impact: "Medium", energy: "Low" }],
  ["idea: template the weekly status report so it builds itself", { energy: "High" }],
  ["blocked: waiting on legal sign-off for the vendor contract +Data_Migration", { energy: "Low", impact: "High" }],
  ["w: Acme renewal signed for another 2 years +Acme_Onboarding @Priya", { impact: "High", energy: "High" }],
  ["m: 1:1 with Tom, wants more ownership of the roadmap @Tom", { energy: "OK" }],
  ["Who owns the budget line for tooling next year?", { energy: "OK" }],
  ["til: forecasting from pipeline stages is far more accurate than gut feel", { energy: "High" }],
  ["Asked finance for the revised forecast @Lena >>", { energy: "OK" }],
  ["d: freeze hiring for ops until Q1 budget is confirmed +Team_Hiring", { impact: "High", rationale: "Budget not confirmed, risk of over-commit", energy: "Low" }],
  ["Priya said the new dashboard is great, team loves it @Priya", { energy: "High" }],
  ["Interview with candidate for analyst role went well +Team_Hiring", { energy: "High" }],
  ["Client complained about invoice errors again on email", { energy: "Low" }],
  ["d: move the weekly sync to Thursdays", { impact: "Low", energy: "OK" }],
  ["Migration timeline slipping by a week, data quality issues +Data_Migration", { energy: "Low", impact: "High" }],
  ["Please review the Q1 strategy deck before Monday @James +Q1_Planning !1", { energy: "OK" }],
  ["w: shipped the new onboarding checklist, cut setup time in half +Acme_Onboarding", { impact: "High", energy: "High" }],
  ["Roadmap priorities for Q1 need sign off from leadership +Q1_Planning", { energy: "OK" }],
  ["Lena mentioned the expense process is too manual @Lena #process", { energy: "OK" }],
  ["d: adopt pipeline-stage forecasting for Q1 +Q1_Planning @Lena", { impact: "Medium", energy: "High" }],
  ["Sarah asked me to cover the client pitch next week @Sarah", { energy: "OK" }],
  ["Spent the afternoon fixing travel bookings and timesheets", { energy: "Low" }],
  ["What if we ran a quarterly client advisory board?", { energy: "High" }],
  ["Team morale low after the reorg announcement #team", { energy: "Low", impact: "Medium" }],
  ["Tom delivered the vendor comparison early, great work @Tom", { energy: "High" }],
  ["Chased Acme for the signed SOW +Acme_Onboarding >>", { energy: "OK" }],
  ["Risk: key engineer leaving in January +Data_Migration", { energy: "Low", impact: "High" }],
  ["Booked offsite venue for the Q1 planning workshop +Q1_Planning", { energy: "OK" }],
  ["Customer feedback: they want a monthly summary email", { energy: "OK" }],
];

// Spread entries over the last six weeks at plausible working hours (UTC).
function seed(): Entry[] {
  const now = Date.now();
  const hours = [8, 9, 10, 11, 13, 14, 15, 16, 17, 18];
  const today = new Date().toISOString().slice(0, 10);
  return SEED.map(([text, extra], i) => {
    const daysAgo = Math.floor((SEED.length - 1 - i) * 1.4);
    const d = new Date(now - daysAgo * 86400000);
    if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() - 2);
    if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
    d.setUTCHours(hours[(i * 7) % hours.length], (i * 13) % 60, 0, 0);
    if (d.getTime() > now) d.setTime(now - (i + 1) * 600000);
    const p = parseCapture(text, today);
    const type = p.type ?? "Note";
    const old = daysAgo > 6;
    const status =
      type === "Request" || type === "Question" || type === "Blocker / Risk"
        ? old && i % 3 !== 0 ? "Done" : i % 2 ? "Waiting on others" : "Open"
        : type === "Decision" || type === "Win" || type === "Learning" ? "Done" : old ? "Done" : "Inbox";
    const captured = d.toISOString();
    return {
      id: `e-${i + 1}`,
      url: "#",
      number: i + 1,
      title: p.title,
      type,
      status,
      tags: p.tags,
      category: p.category,
      projectIds: p.projects.map((n) => projects.find((r) => r.name === n)?.id).filter(Boolean) as string[],
      peopleIds: p.people.map((n) => people.find((r) => r.name.startsWith(n))?.id).filter(Boolean) as string[],
      source: p.source,
      direction: p.direction,
      priority: p.priority,
      sentiment: p.sentiment ?? "Neutral",
      due: p.due ?? (type === "Request" ? new Date(d.getTime() + 4 * 86400000).toISOString().slice(0, 10) : undefined),
      reviewed: daysAgo > 2,
      captured,
      lastEdited: status === "Done" ? new Date(Math.min(now, d.getTime() + ((i % 5) + 1) * 86400000)).toISOString() : captured,
      ...extra,
    } satisfies Entry;
  }).reverse();
}

type Store = { entries: Entry[]; bodies: Map<string, string>; people: Ref[]; projects: Ref[]; seq: number };
const g = globalThis as unknown as { __journalDemo?: Store };

function store(): Store {
  if (!g.__journalDemo) {
    const entries = seed();
    g.__journalDemo = { entries, bodies: new Map(), people: [...people], projects: [...projects], seq: entries.length };
  }
  return g.__journalDemo;
}

function apply(e: Entry, input: EntryInput, projectIds?: string[], peopleIds?: string[]): Entry {
  const next: Entry = { ...e, lastEdited: new Date().toISOString() };
  const keys: Array<keyof EntryInput & keyof Entry> = [
    "title", "type", "status", "tags", "category", "source", "direction", "priority", "impact", "sentiment",
    "energy", "due", "followUp", "rationale", "alternatives", "outcome", "link", "backdate", "reviewed",
  ];
  for (const k of keys) {
    if (input[k] !== undefined) (next as unknown as Record<string, unknown>)[k] = input[k] ?? undefined;
  }
  if (projectIds) next.projectIds = projectIds;
  if (peopleIds) next.peopleIds = peopleIds;
  return next;
}

export class MemoryRepo implements Repo {
  readonly mode = "demo" as const;

  async listEntries() {
    return [...store().entries].sort((a, b) => b.captured.localeCompare(a.captured));
  }
  async getEntry(id: string) {
    const s = store();
    const entry = s.entries.find((e) => e.id === id);
    if (!entry) throw new Error("Entry not found");
    return { entry, body: s.bodies.get(id) ?? "" };
  }
  async listPeople() {
    return store().people;
  }
  async listProjects() {
    return store().projects;
  }
  async createRef(kind: "people" | "projects", name: string) {
    const ref = { id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name };
    store()[kind].push(ref);
    return ref;
  }
  async createEntry(input: EntryInput, projectIds: string[], peopleIds: string[]) {
    const s = store();
    const now = new Date().toISOString();
    const base: Entry = {
      id: `e-${++s.seq}`, url: "#", number: s.seq, title: "Untitled", tags: [], projectIds: [], peopleIds: [],
      status: "Inbox", reviewed: false, captured: now, lastEdited: now,
    };
    const entry = apply(base, input, projectIds, peopleIds);
    s.entries.unshift(entry);
    if (input.body) s.bodies.set(entry.id, input.body);
    return entry;
  }
  async updateEntry(id: string, input: EntryInput, projectIds?: string[], peopleIds?: string[]) {
    const s = store();
    const i = s.entries.findIndex((e) => e.id === id);
    if (i < 0) throw new Error("Entry not found");
    s.entries[i] = apply(s.entries[i], input, projectIds, peopleIds);
  }
  async appendNote(id: string, text: string) {
    const s = store();
    s.bodies.set(id, [s.bodies.get(id), text].filter(Boolean).join("\n"));
  }
  async archiveEntry(id: string) {
    const s = store();
    s.entries = s.entries.filter((e) => e.id !== id);
  }
}
