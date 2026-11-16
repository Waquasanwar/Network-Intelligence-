import { notFound } from "next/navigation";
import { loadAll } from "@/lib/journal";
import { ProjectDetail } from "@/components/ProjectsView";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { entries, people, projects } = await loadAll();
  const project = projects.find((p) => p.id === id || p.id.replace(/-/g, "") === id.replace(/-/g, ""));
  if (!project) notFound();
  const tags = [...new Set(entries.flatMap((e) => e.tags))].sort();
  return <ProjectDetail key={project.id} project={project} entries={entries} projects={projects} people={people} tags={tags} />;
}
