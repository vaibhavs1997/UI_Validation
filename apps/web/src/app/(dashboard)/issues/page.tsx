'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useProjects } from '@/features/projects/project-context';
import { getIssues } from '@/features/issues/issue.service';
import type { Issue } from '@visionqa/contracts';
import { TargetUrlDisplay } from '@/features/scans/components/TargetUrlDisplay';
export default function IssuesPage() { const { selectedProject } = useProjects(); const [issues, setIssues] = useState<Issue[]>([]); const [error, setError] = useState<string | null>(null); useEffect(() => { if (!selectedProject) return; void getIssues(selectedProject.id).then(setIssues).catch(() => setError('Unable to load issues.')); }, [selectedProject]); return <section className="scan-page"><p className="dashboard-eyebrow">QUALITY CENTER</p><h1 className="dashboard-page-title">Issues</h1><p className="dashboard-lead">Review findings with the affected target URL in context.</p>{error && <p className="scan-error" role="alert">{error}</p>}<div className="scan-detail-card"><div className="scan-page-table">{issues.length ? issues.map((issue) => <Link className="scan-page-row" href={`/issues/${issue.id}`} key={issue.id}><div><strong>{issue.title}</strong><TargetUrlDisplay url={issue.primaryUrl} /><small>{issue.detectorId}</small></div><span>{issue.severity}</span><span>{issue.status}</span></Link>) : <p>No issues found for this project yet. Run a QA check to populate this view.</p>}</div></div></section>; }
