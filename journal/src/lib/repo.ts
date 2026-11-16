import type { Entry, EntryInput, Project, ProjectInput, Ref } from "./schema";

export interface Repo {
  readonly mode: "notion" | "demo";
  listEntries(): Promise<Entry[]>;
  getEntry(id: string): Promise<{ entry: Entry; body: string }>;
  listPeople(): Promise<Ref[]>;
  listProjects(): Promise<Project[]>;
  createProject(input: ProjectInput): Promise<Project>;
  updateProject(id: string, input: ProjectInput): Promise<void>;
  /** Saves the weekly brief somewhere the user will see it; returns a link. */
  createBriefPage(title: string, sections: Array<{ heading: string; items: string[] }>): Promise<string>;
  createRef(kind: "people" | "projects", name: string): Promise<Ref>;
  createEntry(input: EntryInput, projectIds: string[], peopleIds: string[]): Promise<Entry>;
  updateEntry(id: string, input: EntryInput, projectIds?: string[], peopleIds?: string[]): Promise<void>;
  appendNote(id: string, text: string): Promise<void>;
  archiveEntry(id: string): Promise<void>;
}
