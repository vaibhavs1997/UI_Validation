 'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Project } from '@visionqa/contracts';

const checks = [
  { title: 'Crawl & Site Structure', description: 'Discover pages, redirects, robots and sitemap information.', href: '/qa/crawl', icon: '⌁' },
  { title: 'Links & Resources', description: 'Find broken links, images and failed resources.', href: '/qa/links-resources', icon: '↗' },
  { title: 'Visual & Responsive', description: 'Detect overlap, clipping and viewport issues.', href: '/qa/visual-responsive', icon: '▧' },
  { title: 'Browser & Network', description: 'Review console errors and failed browser requests.', href: '/qa/browser-network', icon: '◌' },
];

function withTarget(href: string, url: string) { return url.trim() ? `${href}?url=${encodeURIComponent(url.trim())}` : href; }

export function NoProjectDashboard() { return <section className="dashboard-empty-state"><div className="dashboard-empty-icon">✦</div><p className="dashboard-eyebrow">GET STARTED</p><h1 className="dashboard-page-title">Create your first project</h1><p className="dashboard-lead">Create a workspace, then choose a target URL whenever you run a QA check.</p><div className="dashboard-steps">{['Create a project', 'Enter a target URL', 'Run your first check'].map((item, index) => <div className="dashboard-step" key={item}><span>0{index + 1}</span><strong>{item}</strong></div>)}</div><Link className="liquid-primary dashboard-primary-cta" href="/projects/new">Create project <span>→</span></Link></section>; }

export function ProjectGettingStartedDashboard({ project }: { project: Project }) {
  const [url, setUrl] = useState('');
  return <section><div className="dashboard-overview"><div><p className="dashboard-eyebrow">PROJECT OVERVIEW</p><h1 className="dashboard-page-title">{project.name}</h1><p className="dashboard-url">Choose a target URL whenever you run a scan.</p></div><div className="dashboard-overview-meta"><span className="dashboard-meta-label">Workspace</span><strong>Ready for a scan</strong></div></div><div className="dashboard-scan-launcher"><div><p className="dashboard-eyebrow">SCAN TARGET</p><h2>What would you like to validate?</h2><p>Enter a URL to keep this scan focused. It will not change your workspace settings.</p></div><label>Target URL<input className="liquid-control" type="url" placeholder="https://example.com" value={url} onChange={(event) => setUrl(event.target.value)} /></label><div className="dashboard-launch-actions"><Link className={`liquid-primary dashboard-primary-cta${url.trim() ? '' : ' dashboard-cta-disabled'}`} aria-disabled={!url.trim()} href={withTarget('/qa/crawl', url)}>Start with Crawl <span>→</span></Link><Link className="dashboard-secondary-cta" href={withTarget('/full-scan', url)}>Run Full Scan</Link></div></div><div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">RECOMMENDED</p><h2>Start with a focused QA check</h2></div><span>{checks.length} available modules</span></div><div className="dashboard-check-grid">{checks.map((check) => <Link className="dashboard-check-card" href={withTarget(check.href, url)} key={check.href}><span className="dashboard-check-icon">{check.icon}</span><h3>{check.title}</h3><p>{check.description}</p><span className="dashboard-card-action">Configure <b>→</b></span></Link>)}</div></section>;
}
export function ProjectHealthDashboard({ project }: { project: Project }) { return <ProjectGettingStartedDashboard project={project} />; }
