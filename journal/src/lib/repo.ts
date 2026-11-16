import type { Entry, EntryInput, Ref } from "./schema";

export interface Repo {
  readonly mode: "notion" | "demo";
  listEntries(): Promise<Entry[]>;
  getEntry(id: string): Promise<{ entry: Entry; body: string }>;
  listPeople(): Promise<Ref[]>;
  listProjects(): Promise<Ref[]>;
  createRef(kind: "people" | "projects", name: string): Promise<Ref>;
  createEntry(input: EntryInput, projectIds: string[], peopleIds: string[]): Promise<Entry>;
  updateEntry(id: string, input: EntryInput, projectIds?: string[], peopleIds?: string[]): Promise<void>;
  appendNote(id: string, text: string): Promise<void>;
  archiveEntry(id: string): Promise<void>;
}
