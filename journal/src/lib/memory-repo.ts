import type { Entry, EntryInput, Project, ProjectInput, Ref } from "./schema";
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
  { id: "p-mark", name: "Mark Ellis" },
];

const DAY = 86400000;
const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * DAY).toISOString().slice(0, 10);

const projects: Project[] = [
  { id: "pr-migration", url: "#", name: "Data Migration", kind: "Project", state: "Active", health: "At risk", priority: "P1 Urgent", targetDate: iso(24), nextMilestone: "Vendor contract signed", budget: 85000 },
  { id: "pr-q1", url: "#", name: "Q1 Planning", kind: "Initiative", state: "Active", health: "On track", priority: "P2 High", targetDate: iso(38), nextMilestone: "Leadership sign-off on priorities" },
  { id: "pr-acme", url: "#", name: "Acme Onboarding", kind: "Client", state: "Active", health: "On track", priority: "P2 High", targetDate: iso(12), nextMilestone: "Go-live", budget: 40000 },
  { id: "pr-hiring", url: "#", name: "Team Hiring", kind: "Project", state: "Active", health: "Off track", priority: "P2 High", targetDate: iso(-3), nextMilestone: "Two analysts start", budget: 120000 },
  { id: "pr-office", url: "#", name: "Office Refit", kind: "Project", state: "On hold", health: "Not set", priority: "P4 Low", nextMilestone: "Budget approval" },
];

// [text, days ago, extra fields]
const SEED: Array<[string, number, Partial<Entry>]> = [
  ["d: go with vendor B for the migration, cheaper and SOC2 ready +Data_Migration @James", 40, { impact: "High", rationale: "20% cheaper, SOC2 in place, can start in two weeks", alternatives: "Vendor A (faster, pricier); build in-house (no capacity)", energy: "High", status: "Done" }],
  ["pr: 12 laptops for new analysts £14,400 +Team_Hiring", 26, { stage: "Awaiting approval", waitingOn: "Procurement", reference: "PR-20431", chaseCount: 3, lastChased: iso(-9), status: "Waiting on others", priority: "P2 High" }],
  ["sr: data warehouse access for the migration team +Data_Migration", 19, { stage: "Submitted", waitingOn: "IT", reference: "SR-88102", chaseCount: 1, lastChased: iso(-11), status: "Waiting on others" }],
  ["Can you pull the Q4 headcount numbers by Friday @Sarah +Team_Hiring !2", 35, { status: "Done", energy: "OK" }],
  ["Acme said onboarding felt slow in week one +Acme_Onboarding on the call", 33, { impact: "Medium", energy: "Low", status: "Done" }],
  ["pr: vendor B migration licences £62,000 +Data_Migration", 21, { stage: "PO raised", waitingOn: "Procurement", reference: "PO-55710", chaseCount: 2, lastChased: iso(-6), status: "Waiting on others", priority: "P1 Urgent", impact: "High" }],
  ["^^ Asked my director to approve the extra contractor budget +Data_Migration", 14, { waitingOn: "Management", chaseCount: 2, lastChased: iso(-5), status: "Waiting on others", priority: "P1 Urgent", impact: "High" }],
  ["blocked: waiting on legal sign-off for the vendor contract +Data_Migration", 17, { waitingOn: "Legal", status: "Waiting on others", energy: "Low", impact: "High", chaseCount: 1, lastChased: iso(-10) }],
  ["w: Acme renewal signed for another 2 years +Acme_Onboarding @Priya", 30, { impact: "High", energy: "High", status: "Done" }],
  ["m: 1:1 with Tom, wants more ownership of the roadmap @Tom", 28, { energy: "OK", status: "Done" }],
  ["Who owns the budget line for tooling next year?", 12, { status: "Open", energy: "OK", waitingOn: "Finance" }],
  ["til: forecasting from pipeline stages is far more accurate than gut feel", 25, { energy: "High", status: "Done" }],
  ["Asked finance for the revised forecast @Lena >>", 18, { waitingOn: "Finance", status: "Waiting on others", chaseCount: 1, lastChased: iso(-8), energy: "OK" }],
  ["pr: monitors and docks for the analyst desks £3,200 +Team_Hiring", 34, { stage: "Received", waitingOn: "Procurement", reference: "PR-20211", chaseCount: 4, lastChased: iso(-22), status: "Done" }],
  ["d: freeze hiring for ops until Q1 budget is confirmed +Team_Hiring", 22, { impact: "High", rationale: "Budget not confirmed, risk of over-commit", energy: "Low", status: "Done" }],
  ["Priya said the new dashboard is great, team loves it @Priya", 20, { energy: "High", status: "Done" }],
  ["sr: new starter accounts for two analysts +Team_Hiring", 9, { stage: "Submitted", waitingOn: "IT", reference: "SR-88411", status: "Waiting on others", priority: "P2 High" }],
  ["Client complained about invoice errors again on email", 16, { energy: "Low", status: "Done" }],
  ["^^ Escalated the contractor rates question to leadership", 7, { waitingOn: "Management", status: "Waiting on others", priority: "P2 High" }],
  ["Migration timeline slipping by a week, data quality issues +Data_Migration", 11, { energy: "Low", impact: "High", status: "Open" }],
  ["Please review the Q1 strategy deck before Monday @James +Q1_Planning !1", 6, { energy: "OK", status: "In progress", due: iso(2) }],
  ["w: shipped the new onboarding checklist, cut setup time in half +Acme_Onboarding", 10, { impact: "High", energy: "High", status: "Done" }],
  ["Roadmap priorities for Q1 need sign off from leadership +Q1_Planning", 8, { energy: "OK", status: "Open", waitingOn: "Management", due: iso(5) }],
  ["d: adopt pipeline-stage forecasting for Q1 +Q1_Planning @Lena", 13, { impact: "Medium", energy: "High", status: "Done" }],
  ["Sarah asked me to cover the client pitch next week @Sarah", 5, { energy: "OK", status: "Open", due: iso(4) }],
  ["pr: annual BI tool subscription £9,800 +Q1_Planning", 4, { stage: "Draft", waitingOn: "Procurement", status: "Open", due: iso(3) }],
  ["What if we ran a quarterly client advisory board?", 3, { energy: "High", status: "Done" }],
  ["Risk: key engineer leaving in January +Data_Migration", 3, { energy: "Low", impact: "High", status: "Open" }],
  ["Chased Acme for the signed SOW +Acme_Onboarding >>", 2, { waitingOn: "Client", chaseCount: 2, lastChased: iso(-2), status: "Waiting on others", due: iso(-1) }],
  ["Customer feedback: they want a monthly summary email", 0, { energy: "OK", status: "Inbox" }],
  ["Booked offsite venue for the Q1 planning workshop +Q1_Planning", 1, { energy: "OK", status: "Inbox" }],
];

function seed(): Entry[] {
  const hours = [8, 9, 10, 11, 13, 14, 15, 16, 17, 18];
  const today = new Date().toISOString().slice(0, 10);
  return SEED.map(([text, daysAgo, extra], i) => {
    const d = new Date(Date.now() - daysAgo * DAY);
    if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() - 2);
    if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
    d.setUTCHours(hours[(i * 7) % hours.length], (i * 13) % 60, 0, 0);
    if (d.getTime() > Date.now()) d.setTime(Date.now() - (i + 1) * 600000);
    const p = parseCapture(text, today);
    const captured = d.toISOString();
    const closed = extra.status === "Done";
    const entry: Entry = {
      id: `e-${i + 1}`,
      url: "#",
      number: i + 1,
      title: p.title,
      type: p.type ?? "Note",
      status: "Open",
      tags: p.tags,
      category: p.category,
      projectIds: p.projects.map((n) => projects.find((r) => r.name === n)?.id).filter(Boolean) as string[],
      peopleIds: p.people.map((n) => people.find((r) => r.name.startsWith(n))?.id).filter(Boolean) as string[],
      source: p.source,
      direction: p.direction,
      priority: p.priority,
      sentiment: p.sentiment ?? "Neutral",
      due: p.due,
      amount: p.amount,
      reference: p.reference,
      waitingOn: p.waitingOn,
      chaseCount: 0,
      reviewed: daysAgo > 1,
      captured,
      // Closed items were last touched a few days after capture; open ones at their last chase.
      lastEdited: closed ? new Date(Math.min(Date.now(), d.getTime() + ((i % 5) + 2) * DAY)).toISOString() : captured,
      ...extra,
    };
    if (!closed && entry.lastChased) entry.lastEdited = new Date(`${entry.lastChased}T10:00:00Z`).toISOString();
    return entry;
  }).reverse();
}

type Store = { entries: Entry[]; bodies: Map<string, string>; people: Ref[]; projects: Project[]; seq: number; briefs: string[] };
const g = globalThis as unknown as { __journalDemo2?: Store };

function store(): Store {
  if (!g.__journalDemo2) {
    const entries = seed();
    g.__journalDemo2 = { entries, bodies: new Map(), people: [...people], projects: projects.map((p) => ({ ...p })), seq: entries.length, briefs: [] };
  }
  return g.__journalDemo2;
}

function apply(e: Entry, input: EntryInput, projectIds?: string[], peopleIds?: string[]): Entry {
  const next: Entry = { ...e, lastEdited: new Date().toISOString() };
  const keys: Array<keyof EntryInput & keyof Entry> = [
    "title", "type", "status", "tags", "category", "source", "direction", "priority", "impact", "sentiment",
    "energy", "due", "followUp", "rationale", "alternatives", "outcome", "link", "backdate", "reviewed",
    "waitingOn", "stage", "reference", "amount", "chaseCount", "lastChased",
  ];
  for (const k of keys) {
    if (input[k] !== undefined) (next as unknown as Record<string, unknown>)[k] = input[k] ?? undefined;
  }
  if (next.chaseCount === undefined) next.chaseCount = 0;
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
  async createProject(input: ProjectInput) {
    const p: Project = { id: `pr-${Date.now()}`, url: "#", name: input.name || "Untitled project", kind: "Project", state: "Active" };
    store().projects.push(p);
    await this.updateProject(p.id, { ...input, name: undefined });
    return store().projects.find((x) => x.id === p.id)!;
  }
  async updateProject(id: string, input: ProjectInput) {
    const s = store();
    const i = s.projects.findIndex((p) => p.id === id);
    if (i < 0) throw new Error("Project not found");
    const next = { ...s.projects[i] } as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(input)) if (v !== undefined) next[k] = v ?? undefined;
    s.projects[i] = next as unknown as Project;
  }
  async createBriefPage(title: string, sections: Array<{ heading: string; items: string[] }>) {
    store().briefs.unshift([title, ...sections.flatMap((s) => [s.heading, ...s.items])].join("\n"));
    return "#";
  }
  async createRef(kind: "people" | "projects", name: string) {
    const ref = { id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name };
    if (kind === "projects") store().projects.push({ ...ref, url: "#", kind: "Project", state: "Active" });
    else store().people.push(ref);
    return ref;
  }
  async createEntry(input: EntryInput, projectIds: string[], peopleIds: string[]) {
    const s = store();
    const now = new Date().toISOString();
    const base: Entry = {
      id: `e-${++s.seq}`, url: "#", number: s.seq, title: "Untitled", tags: [], projectIds: [], peopleIds: [],
      status: "Inbox", reviewed: false, captured: now, lastEdited: now, chaseCount: 0,
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
