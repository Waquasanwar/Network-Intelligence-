import { loadAll } from "@/lib/journal";
import { ReviewView } from "@/components/ReviewView";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { entries, people, projects } = await loadAll();
  return <ReviewView entries={entries} people={people} projects={projects} />;
}
