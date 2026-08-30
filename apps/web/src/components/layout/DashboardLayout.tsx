'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser, logout } from '@/features/auth/auth.service';
import { ProjectProvider, useProjects } from '@/features/projects/project-context';

const sections = [
  ['OVERVIEW', [['Dashboard', '/dashboard'], ['Issues', '/issues'], ['Scan History', '/scans']]],
  ['QA CHECKS', [['Crawl & Site Structure', '/qa/crawl'], ['Links & Resources', '/qa/links-resources'], ['Visual & Responsive', '/qa/visual-responsive'], ['Interactions & Forms', '/qa/interactions-forms'], ['Browser & Network', '/qa/browser-network'], ['Accessibility & SEO', '/qa/accessibility-seo'], ['Performance & Compatibility', '/qa/performance-compatibility'], ['Custom Checks', '/qa/custom-checks']]],
  ['AUTOMATION', [['Full Scan', '/full-scan'], ['Schedules', '/schedules']]],
  ['REPORTING', [['Reports', '/reports']]],
  ['CONFIGURATION', [['Website Configuration', '/settings/project'], ['Integrations', '/integrations'], ['Settings', '/settings/project']]],
] as const;
const projectRoutes = ['/issues', '/scans', '/qa/', '/full-scan', '/schedules', '/reports', '/settings/', '/integrations'];

function DashboardFrame({ children, user, onLogout }: Readonly<{ children: React.ReactNode; user: { name?: string; email: string }; onLogout: () => void }>) {
  const router = useRouter(); const pathname = usePathname(); const { projects, selectedProject, loading, error, selectProject } = useProjects();
  useEffect(() => { if (!loading && !projects.length && pathname !== '/dashboard' && pathname !== '/projects/new' && projectRoutes.some((route) => route.endsWith('/') ? pathname.startsWith(route) : pathname === route)) router.replace('/dashboard'); }, [loading, projects.length, pathname, router]);
  return <div style={{ display: 'flex', minHeight: '100vh' }}><aside style={{ width: 260, background: '#10182b', color: '#d7def0', padding: 24 }}><strong style={{ color: 'white', fontSize: 20 }}>VisionQA</strong><div style={{ margin: '28px 0', padding: 12, background: '#1c2740', borderRadius: 8 }}>{projects.length ? <select aria-label="Current project" value={selectedProject?.id ?? ''} onChange={(event) => selectProject(event.target.value)} style={{ width: '100%', background: 'transparent', color: 'white', border: 0 }}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select> : <Link href="/projects/new" style={{ color: 'white' }}>+ Create project</Link>}</div>{error && <p style={{ color: '#fca5a5', fontSize: 12 }}>{error}</p>}{sections.map(([title, links]) => <div key={title} style={{ marginBottom: 22 }}><small style={{ color: '#7f8baa', letterSpacing: 1 }}>{title}</small>{links.map(([label, href]) => <Link key={href + label} href={href} style={{ display: 'block', padding: '8px 0', fontSize: 14, opacity: projects.length || href === '/dashboard' ? 1 : 0.45 }}>{label}</Link>)}</div>)}</aside><div style={{ flex: 1 }}><header style={{ height: 72, background: 'white', borderBottom: '1px solid #e6e9f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}><span>{selectedProject?.name ?? 'Workspace setup'}</span><span style={{ color: '#64708a', display: 'flex', alignItems: 'center', gap: 16 }}><span>{user.name || user.email}</span><button type="button" onClick={onLogout} style={{ color: '#ad08d1', fontWeight: 600 }}>Logout</button></span></header><main style={{ padding: 32, maxWidth: 1200 }}>{children}</main></div></div>;
}
export function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) { const router = useRouter(); const [user, setUser] = useState<{ name?: string; email: string } | null>(null); const [checking, setChecking] = useState(true); useEffect(() => { void getCurrentUser().then((currentUser) => { setUser(currentUser); setChecking(false); if (!currentUser) router.replace('/login'); }); }, [router]); async function handleLogout() { await logout(); setUser(null); router.replace('/login'); } if (checking || !user) return <div className="min-h-screen bg-[#f6f8fc]" aria-busy="true" />; return <ProjectProvider><DashboardFrame user={user} onLogout={() => void handleLogout()}>{children}</DashboardFrame></ProjectProvider>; }
export default DashboardLayout;
