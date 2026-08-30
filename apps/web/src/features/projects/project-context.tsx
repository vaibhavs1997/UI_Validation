'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Project } from '@visionqa/contracts';
import { getProjects } from './project.service';

type ProjectContextValue = { projects: Project[]; selectedProject: Project | null; loading: boolean; error: string | null; selectProject: (id: string) => void; refreshProjects: () => Promise<void> };
const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [projects, setProjects] = useState<Project[]>([]); const [selectedId, setSelectedId] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const refreshProjects = useCallback(async () => { setLoading(true); try { const next = await getProjects(); setProjects(next); setSelectedId((current) => next.some((project) => project.id === current) ? current : next[0]?.id ?? null); setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load projects.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void refreshProjects(); }, [refreshProjects]);
  const selectProject = useCallback((id: string) => { if (projects.some((project) => project.id === id)) setSelectedId(id); }, [projects]);
  const value = useMemo(() => ({ projects, selectedProject: projects.find((project) => project.id === selectedId) ?? null, loading, error, selectProject, refreshProjects }), [projects, selectedId, loading, error, selectProject, refreshProjects]);
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
export function useProjects(): ProjectContextValue { const context = useContext(ProjectContext); if (!context) throw new Error('useProjects must be used inside ProjectProvider'); return context; }
