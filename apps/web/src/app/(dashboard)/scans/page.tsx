'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useProjects } from '@/features/projects/project-context';
import { getScans } from '@/features/scans/scan.service';
import { ScanStatusBadge } from '@/features/scans/components/ScanStatusBadge';
import { TargetUrlDisplay } from '@/features/scans/components/TargetUrlDisplay';
import type { Scan } from '@visionqa/contracts';

export default function ScansPage() { const { selectedProject } = useProjects(); const [scans, setScans] = useState<Scan[]>([]); const [error, setError] = useState<string | null>(null); useEffect(() => { if (!selectedProject) return; void getScans(selectedProject.id).then(setScans).catch(() => setError('Unable to load scan history.')); }, [selectedProject]); return <section className="scan-page"><p className="dashboard-eyebrow">AUTOMATION</p><h1 className="dashboard-page-title">Scan history</h1><p className="dashboard-lead">Review scans and the target URL used for each run.</p>{error && <p className="scan-error" role="alert">{error}</p>}{!error && !scans.length && <div className="scan-empty-state">No scans have been created yet. Choose a target URL from the dashboard to start one.</div>}{scans.length > 0 && <div className="scan-history-list">{scans.map((scan) => <Link className="scan-history-row" href={`/scans/${scan.id}`} key={scan.id}><ScanStatusBadge status={scan.status} /><div><strong>{scan.module}</strong><TargetUrlDisplay url={scan.target?.safeDisplayUrl ?? scan.target?.requestedUrl ?? scan.requestedUrls[0]} /><small>{scan.checks.length} selected check{scan.checks.length === 1 ? '' : 's'} · {new Date(scan.createdAt).toLocaleString()}</small></div><span>→</span></Link>)}</div>}</section>; }
