// The shape of a journal entry and the option lists, mirroring the Notion "Journal Entries"
// database. Option names must match Notion exactly; new tags are created on the fly.

export const ENTRY_TYPES = [
  "Note",
  "Decision",
  "Request",
  "Purchase Request",
  "Service Request",
  "Comment / Feedback",
  "Idea",
  "Meeting",
  "Blocker / Risk",
  "Win",
  "Question",
  "Learning",
] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const STATUSES = ["Inbox", "Open", "In progress", "Waiting on others", "Done", "Dropped"] as const;
export type Status = (typeof STATUSES)[number];
export const CLOSED_STATUSES: Status[] = ["Done", "Dropped"];

export const CATEGORIES = [
  "Strategy",
  "Delivery",
  "Operations",
  "People & Team",
  "Sales & Clients",
  "Finance",
  "Product",
  "Personal growth",
  "Admin",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SOURCES = ["Own thought", "Meeting", "Email", "Chat (Slack/Teams)", "Call", "In person", "Document"] as const;
export type Source = (typeof SOURCES)[number];

export const DIRECTIONS = ["Incoming (to me)", "Outgoing (from me)", "Upward (to management)", "Internal"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const WAITING_ON = ["Procurement", "Finance", "Management", "Legal", "IT", "Vendor", "Client", "Team", "Other"] as const;
export type WaitingOn = (typeof WAITING_ON)[number];

/** Purchase and service request pipeline, in order. */
export const STAGES = ["Draft", "Submitted", "Awaiting approval", "Approved", "PO raised", "Ordered", "Received", "Closed", "Rejected"] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ["Draft", "Submitted", "Awaiting approval", "Approved", "PO raised", "Ordered"];

/** Types that are "asks" and need to be followed through until closed. */
export const TRACKED_TYPES = ["Request", "Purchase Request", "Service Request", "Question", "Blocker / Risk"] as const;
export const PROCUREMENT_TYPES = ["Purchase Request", "Service Request"] as const;

export const HEALTH = ["On track", "At risk", "Off track", "Not set"] as const;
export type Health = (typeof HEALTH)[number];

export const PRIORITIES = ["P1 Urgent", "P2 High", "P3 Normal", "P4 Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const LEVELS = ["High", "Medium", "Low"] as const;
export type Level = (typeof LEVELS)[number];

export const SENTIMENTS = ["Positive", "Neutral", "Negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const ENERGIES = ["High", "OK", "Low"] as const;
export type Energy = (typeof ENERGIES)[number];

export interface Entry {
  id: string;
  url: string;
  number?: number;
  title: string;
  type?: EntryType;
  status?: Status;
  tags: string[];
  category?: Category;
  projectIds: string[];
  peopleIds: string[];
  source?: Source;
  direction?: Direction;
  priority?: Priority;
  impact?: Level;
  sentiment?: Sentiment;
  energy?: Energy;
  due?: string;
  followUp?: string;
  rationale?: string;
  alternatives?: string;
  outcome?: string;
  link?: string;
  backdate?: string;
  waitingOn?: WaitingOn;
  stage?: Stage;
  reference?: string;
  amount?: number;
  chaseCount: number;
  lastChased?: string;
  reviewed: boolean;
  captured: string; // ISO datetime
  lastEdited: string; // ISO datetime
}

/** Captured time, or the backdate when one is set. Use for every time-based view. */
export function loggedAt(e: Pick<Entry, "captured" | "backdate">): string {
  return e.backdate || e.captured;
}

export function isClosed(e: Pick<Entry, "status">): boolean {
  return !!e.status && CLOSED_STATUSES.includes(e.status);
}

export function isOverdue(e: Pick<Entry, "due" | "status">, today: string): boolean {
  return !!e.due && e.due.slice(0, 10) < today && !isClosed(e);
}

export interface Ref {
  id: string;
  name: string;
}

export interface Project extends Ref {
  url: string;
  kind?: string;
  state?: string;
  health?: Health;
  priority?: Priority;
  targetDate?: string;
  nextMilestone?: string;
  budget?: number;
  notes?: string;
}

export function isTracked(e: Pick<Entry, "type">): boolean {
  return !!e.type && (TRACKED_TYPES as readonly string[]).includes(e.type);
}

export function isProcurement(e: Pick<Entry, "type">): boolean {
  return !!e.type && (PROCUREMENT_TYPES as readonly string[]).includes(e.type);
}

/** Fields a capture or an edit may set. Relations are given by name and resolved server-side. */
export interface EntryInput {
  title?: string;
  body?: string;
  type?: EntryType;
  status?: Status;
  tags?: string[];
  category?: Category | null;
  projects?: string[];
  people?: string[];
  projectIds?: string[];
  peopleIds?: string[];
  source?: Source | null;
  direction?: Direction | null;
  priority?: Priority | null;
  impact?: Level | null;
  sentiment?: Sentiment | null;
  energy?: Energy | null;
  due?: string | null;
  followUp?: string | null;
  rationale?: string;
  alternatives?: string;
  outcome?: string;
  link?: string | null;
  backdate?: string | null;
  waitingOn?: WaitingOn | null;
  stage?: Stage | null;
  reference?: string;
  amount?: number | null;
  chaseCount?: number;
  lastChased?: string | null;
  reviewed?: boolean;
}

export interface ProjectInput {
  name?: string;
  kind?: string | null;
  state?: string | null;
  health?: Health | null;
  priority?: Priority | null;
  targetDate?: string | null;
  nextMilestone?: string;
  budget?: number | null;
  notes?: string;
}

export const TYPE_STYLE: Record<EntryType, { color: string; emoji: string }> = {
  Note: { color: "slate", emoji: "📝" },
  Decision: { color: "violet", emoji: "⚖️" },
  Request: { color: "orange", emoji: "🙋" },
  "Purchase Request": { color: "amber", emoji: "🧾" },
  "Service Request": { color: "sky", emoji: "🛠️" },
  "Comment / Feedback": { color: "sky", emoji: "💬" },
  Idea: { color: "amber", emoji: "💡" },
  Meeting: { color: "stone", emoji: "👥" },
  "Blocker / Risk": { color: "rose", emoji: "🚧" },
  Win: { color: "emerald", emoji: "🏆" },
  Question: { color: "pink", emoji: "❓" },
  Learning: { color: "teal", emoji: "📚" },
};
