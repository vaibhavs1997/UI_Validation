'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useProjects } from '@/features/projects/project-context';

const groups = [
  ['OVERVIEW', true, [['Dashboard', '/dashboard', '⌂'], ['Issues', '/issues', '◈'], ['Scan History', '/scans', '◷']]],
  ['QA CHECKS', false, [['Crawl & Site Structure', '/qa/crawl', '⌁'], ['Links & Resources', '/qa/links-resources', '↗'], ['Visual & Responsive', '/qa/visual-responsive', '▧'], ['Interactions & Forms', '/qa/interactions-forms', '⌘'], ['Browser & Network', '/qa/browser-network', '⊙'], ['Accessibility & SEO', '/qa/accessibility-seo', '✓'], ['Performance & Compatibility', '/qa/performance-compatibility', '↗'], ['Custom Checks', '/qa/custom-checks', '✦']]],
  ['AUTOMATION', false, [['Full Scan', '/full-scan', '◉'], ['Schedules', '/schedules', '◫']]],
  ['REPORTING', false, [['Reports', '/reports', '▤']]],
  ['CONFIGURATION', false, [['Project Settings', '/settings/project', '⚙'], ['Environments', '/settings/project#environments', '◌'], ['Integrations', '/integrations', '⌘']]],
] as const;

export function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { projects } = useProjects();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ OVERVIEW: true, 'QA CHECKS': true });
  const isActive = (href: string) => href.includes('#') ? pathname === href.split('#')[0] : href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return <aside className={`app-sidebar ${open ? 'app-sidebar-open' : ''}`}>
    <div className="sidebar-top"><div className="sidebar-brand-row"><span className="sidebar-brand-mark">V</span><strong className="dashboard-brand">VisionQA</strong><button className="sidebar-close" type="button" aria-label="Close navigation" onClick={onClose}>×</button></div></div>
    <nav className="sidebar-nav" aria-label="Primary navigation">{groups.map(([title, initiallyOpen, links]) => { const isOpen = expanded[title] ?? initiallyOpen; return <div className="sidebar-group" key={title}><button className="sidebar-group-toggle" type="button" aria-expanded={isOpen} onClick={() => setExpanded((current) => ({ ...current, [title]: !isOpen }))}><span>{title}</span>{title !== 'OVERVIEW' && <span aria-hidden="true">{isOpen ? '⌃' : '⌄'}</span>}</button>{isOpen && <div className="sidebar-links">{links.map(([label, href, icon]) => <Link className={`sidebar-link ${isActive(href) ? 'sidebar-link-active' : ''} ${!projects.length && href !== '/dashboard' ? 'sidebar-link-disabled' : ''}`} href={href} key={href + label} onClick={onClose}><span className="sidebar-link-icon" aria-hidden="true">{icon}</span><span>{label}</span></Link>)}</div>}</div>; })}</nav>
  </aside>;
}
