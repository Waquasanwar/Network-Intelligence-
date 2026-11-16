import { loadAll } from "@/lib/journal";
import { ProjectsView } from "@/components/ProjectsView";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { entries, projects } = await loadAll();
  return <ProjectsView entries={entries} projects={projects} />;
}
