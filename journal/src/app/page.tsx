import { loadAll } from "@/lib/journal";
import { TodayView } from "@/components/TodayView";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { entries, people, projects } = await loadAll();
  const tags = [...new Set(entries.flatMap((e) => e.tags))].sort();
  return <TodayView entries={entries} people={people} projects={projects} tags={tags} />;
}
