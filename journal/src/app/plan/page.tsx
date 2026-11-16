import { Suspense } from "react";
import { loadAll } from "@/lib/journal";
import { PlanView } from "@/components/PlanView";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const { entries, people, projects } = await loadAll();
  return (
    <Suspense>
      <PlanView entries={entries} projects={projects} people={people} />
    </Suspense>
  );
}
