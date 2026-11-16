import { notFound } from "next/navigation";
import { getEntry, listEntries, listPeople, listProjects, mode } from "@/lib/journal";
import { EntryEditor } from "@/components/EntryEditor";

export const dynamic = "force-dynamic";

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [found, people, projects, entries] = await Promise.all([
    getEntry(id).catch(() => null),
    listPeople(),
    listProjects(),
    listEntries(),
  ]);
  if (!found) notFound();
  const tags = [...new Set(entries.flatMap((e) => e.tags))].sort();
  return <EntryEditor key={found.entry.lastEdited} entry={found.entry} body={found.body} people={people} projects={projects} tags={tags} mode={mode()} />;
}
