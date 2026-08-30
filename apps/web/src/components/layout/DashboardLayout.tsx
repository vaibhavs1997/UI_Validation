'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser } from '@/features/auth/auth.service';
import { ProjectProvider, useProjects } from '@/features/projects/project-context';
import { AppSidebar } from './AppSidebar';
import { AccountMenu } from './AccountMenu';

function DashboardFrame({ children, user }: Readonly<{ children: React.ReactNode; user: { name?: string; email: string } }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { projects, selectedProject, selectedEnvironment, loading, error, selectProject, selectEnvironment } = useProjects();

  useEffect(() => {
    const routes = ['/issues', '/scans', '/qa/', '/full-scan', '/schedules', '/reports', '/settings/', '/integrations'];
    if (!loading && !projects.length && pathname !== '/dashboard' && pathname !== '/projects/new' && routes.some((route) => route.endsWith('/') ? pathname.startsWith(route) : pathname === route)) router.replace('/dashboard');
  }, [loading, projects.length, pathname, router]);

  return <div className="dashboard-shell"><button className={`sidebar-backdrop ${sidebarOpen ? 'sidebar-backdrop-visible' : ''}`} aria-label="Close navigation" type="button" onClick={() => setSidebarOpen(false)} /><AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><div className="dashboard-content"><header className="dashboard-header"><button className="mobile-menu-button" type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>☰</button><div className="dashboard-heading"><span className="dashboard-heading-icon">✦</span><div><small>VISIONQA WORKSPACE</small><strong>{selectedProject?.name ?? 'Workspace setup'}</strong></div></div><div className="dashboard-header-actions">{selectedProject && <><label className="dashboard-project-pill"><small>PROJECT</small><select aria-label="Current project" value={selectedProject.id} onChange={(event) => selectProject(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="dashboard-status-pill"><span /> <small>ENVIRONMENT</small><select aria-label="Current environment" value={selectedEnvironment?.id ?? ''} onChange={(event) => selectEnvironment(event.target.value)}>{selectedProject.environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}{environment.isDefault ? ' · Default' : ''}</option>)}</select></label></>}<button className="dashboard-icon-button" type="button" aria-label="Help" title="Help">?</button><AccountMenu user={user} /></div></header>{error && <div className="dashboard-context-error" role="alert">Unable to load project. <button type="button" onClick={() => window.location.reload()}>Try again</button></div>}<main className="dashboard-main">{children}</main></div></div>;
}

export function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) { const router = useRouter(); const [user, setUser] = useState<{ name?: string; email: string } | null>(null); const [checking, setChecking] = useState(true); useEffect(() => { void getCurrentUser().then((currentUser) => { setUser(currentUser); setChecking(false); if (!currentUser) router.replace('/login'); }); }, [router]); if (checking || !user) return <div className="min-h-screen bg-[#f6f8fc]" aria-busy="true" />; return <ProjectProvider><DashboardFrame user={user}>{children}</DashboardFrame></ProjectProvider>; }
export default DashboardLayout;
