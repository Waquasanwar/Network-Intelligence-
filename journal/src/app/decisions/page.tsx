import { loadAll } from "@/lib/journal";
import { DecisionsView } from "@/components/DecisionsView";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const { entries, people, projects } = await loadAll();
  return <DecisionsView entries={entries} people={people} projects={projects} />;
}
