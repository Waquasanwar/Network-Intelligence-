import { loadAll } from "@/lib/journal";
import { ProcurementView } from "@/components/ProcurementView";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  const { entries, projects } = await loadAll();
  return <ProcurementView entries={entries} projects={projects} />;
}
