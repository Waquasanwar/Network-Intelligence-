// The shape of a journal entry and the option lists, mirroring the Notion "Journal Entries"
// database. Option names must match Notion exactly; new tags are created on the fly.

export const ENTRY_TYPES = [
  "Note",
  "Decision",
  "Request",
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

export const DIRECTIONS = ["Incoming (to me)", "Outgoing (from me)", "Internal"] as const;
export type Direction = (typeof DIRECTIONS)[number];

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
  reviewed?: boolean;
}

export const TYPE_STYLE: Record<EntryType, { color: string; emoji: string }> = {
  Note: { color: "slate", emoji: "📝" },
  Decision: { color: "violet", emoji: "⚖️" },
  Request: { color: "orange", emoji: "🙋" },
  "Comment / Feedback": { color: "sky", emoji: "💬" },
  Idea: { color: "amber", emoji: "💡" },
  Meeting: { color: "stone", emoji: "👥" },
  "Blocker / Risk": { color: "rose", emoji: "🚧" },
  Win: { color: "emerald", emoji: "🏆" },
  Question: { color: "pink", emoji: "❓" },
  Learning: { color: "teal", emoji: "📚" },
};
