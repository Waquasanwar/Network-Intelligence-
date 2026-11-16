import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import type { Entry, EntryInput, Ref } from "./schema";
import type { Repo } from "./repo";
import { NotionRepo } from "./notion-repo";
import { MemoryRepo } from "./memory-repo";
import { parseCapture, todayIn } from "./parse";

let repo: Repo | undefined;

export function getRepo(): Repo {
  if (!repo) {
    const token = process.env.NOTION_TOKEN;
    repo = token
      ? new NotionRepo(token, {
          entries: process.env.NOTION_ENTRIES_DS || "41aedc4c-0659-81ab-b67a-000b2f61a672",
          projects: process.env.NOTION_PROJECTS_DS || "41aedc4c-0659-81be-82c2-000b62c660ed",
          people: process.env.NOTION_PEOPLE_DS || "41aedc4c-0659-818e-99bf-000b505e1e0c",
        })
      : new MemoryRepo();
  }
  return repo;
}

export const mode = () => getRepo().mode;

// Notion allows about three requests a second, so reads are cached briefly and every write
// invalidates the cache. Demo mode reads memory directly.
const TAG = "journal";
function cached<T>(key: string, fn: () => Promise<T>) {
  if (getRepo().mode === "demo") return fn();
  return unstable_cache(fn, [key], { tags: [TAG], revalidate: 60 })();
}

export const listEntries = () => cached<Entry[]>("entries", () => getRepo().listEntries());
export const listPeople = () => cached<Ref[]>("people", () => getRepo().listPeople());
export const listProjects = () => cached<Ref[]>("projects", () => getRepo().listProjects());
export const getEntry = (id: string) => getRepo().getEntry(id);

export async function loadAll() {
  const [entries, people, projects] = await Promise.all([listEntries(), listPeople(), listProjects()]);
  return { entries, people, projects, mode: mode() };
}

function invalidate() {
  if (getRepo().mode === "notion") revalidateTag(TAG);
}

/** Match names to existing pages (exact, then unique first-name or prefix match); create the rest. */
export async function resolveRefs(kind: "people" | "projects", names: string[]): Promise<string[]> {
  if (!names.length) return [];
  const existing = kind === "people" ? await listPeople() : await listProjects();
  const ids: string[] = [];
  let created = false;
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    const exact = existing.find((r) => r.name.toLowerCase() === lower);
    const loose = existing.filter((r) => r.name.toLowerCase().startsWith(lower));
    const hit = exact ?? (loose.length === 1 ? loose[0] : undefined);
    if (hit) ids.push(hit.id);
    else {
      const ref = await getRepo().createRef(kind, name);
      existing.push(ref);
      ids.push(ref.id);
      created = true;
    }
  }
  if (created) invalidate();
  return [...new Set(ids)];
}

export async function createEntry(input: EntryInput): Promise<Entry> {
  const [projectIds, peopleIds] = await Promise.all([
    input.projectIds ? Promise.resolve(input.projectIds) : resolveRefs("projects", input.projects ?? []),
    input.peopleIds ? Promise.resolve(input.peopleIds) : resolveRefs("people", input.people ?? []),
  ]);
  const entry = await getRepo().createEntry(input, projectIds, peopleIds);
  invalidate();
  return entry;
}

/** Capture from raw shorthand text, as used by the API endpoint. */
export async function captureText(text: string, overrides: EntryInput = {}): Promise<Entry> {
  const today = todayIn(process.env.JOURNAL_TIMEZONE || "UTC");
  const p = parseCapture(text, today);
  const type = p.type ?? "Note";
  return createEntry({
    status: type === "Request" || type === "Question" || type === "Blocker / Risk" ? "Open" : "Inbox",
    title: p.title,
    body: p.body,
    type,
    tags: p.tags,
    people: p.people,
    projects: p.projects,
    priority: p.priority,
    due: p.due,
    followUp: p.followUp,
    direction: p.direction,
    sentiment: p.sentiment,
    category: p.category,
    source: p.source,
    ...overrides,
  });
}

export async function updateEntry(id: string, input: EntryInput): Promise<void> {
  const projectIds = input.projectIds ?? (input.projects ? await resolveRefs("projects", input.projects) : undefined);
  const peopleIds = input.peopleIds ?? (input.people ? await resolveRefs("people", input.people) : undefined);
  await getRepo().updateEntry(id, input, projectIds, peopleIds);
  invalidate();
}

export async function appendNote(id: string, text: string) {
  await getRepo().appendNote(id, text);
  invalidate();
}

export async function archiveEntry(id: string) {
  await getRepo().archiveEntry(id);
  invalidate();
}
