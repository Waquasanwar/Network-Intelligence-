import { loadAll } from "@/lib/journal";
import { RequestsView } from "@/components/RequestsView";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const { entries, people } = await loadAll();
  return <RequestsView entries={entries} people={people} />;
}
