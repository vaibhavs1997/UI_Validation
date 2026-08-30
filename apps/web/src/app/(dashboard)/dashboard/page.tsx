'use client';
import { NoProjectDashboard, ProjectGettingStartedDashboard } from '@/features/projects/components/ProjectDashboardStates';
import { useProjects } from '@/features/projects/project-context';

export default function DashboardPage() {
  const { projects, selectedProject, loading, error } = useProjects();
  if (loading) return <section aria-busy="true"><p className="text-[#76527f]">Loading workspace…</p></section>;
  if (error) return <section><p className="text-red-700">{error}</p><p className="mt-2 text-[#76527f]">Refresh the page to try again.</p></section>;
  if (!projects.length || !selectedProject) return <NoProjectDashboard />;
  return <ProjectGettingStartedDashboard project={selectedProject} />;
}
