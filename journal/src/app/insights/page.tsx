import { loadAll } from "@/lib/journal";
import { InsightsView } from "@/components/InsightsView";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const { entries, people, projects } = await loadAll();
  return <InsightsView entries={entries} people={people} projects={projects} />;
}
