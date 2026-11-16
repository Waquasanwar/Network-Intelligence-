import { loadAll } from "@/lib/journal";
import { InsightsTabs } from "@/components/InsightsTabs";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const { entries, people, projects } = await loadAll();
  return <InsightsTabs entries={entries} people={people} projects={projects} />;
}
