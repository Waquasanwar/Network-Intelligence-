import { Suspense } from "react";
import { loadAll } from "@/lib/journal";
import { TimelineView } from "@/components/TimelineView";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const { entries, people, projects } = await loadAll();
  return (
    <Suspense>
      <TimelineView entries={entries} people={people} projects={projects} />
    </Suspense>
  );
}
