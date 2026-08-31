'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useProjects } from '@/features/projects/project-context';
import { getIssue, updateIssueStatus } from '@/features/issues/issue.service';
import type { Issue, IssueStatus } from '@visionqa/contracts';
import { TargetUrlDisplay } from '@/features/scans/components/TargetUrlDisplay';

export default function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const { selectedProject } = useProjects();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (selectedProject && issueId) void getIssue(selectedProject.id, issueId).then(setIssue).catch(() => setError('Unable to load this issue.')); }, [selectedProject, issueId]);
  const setStatus = async (status: IssueStatus) => { if (!selectedProject || !issue) return; try { setIssue(await updateIssueStatus(selectedProject.id, issue.id, status)); } catch { setError('Unable to update issue status.'); } };
  return <section className="scan-page"><Link className="scan-back-link" href="/issues">← Issues</Link><p className="dashboard-eyebrow">ISSUE DETAIL</p><h1 className="dashboard-page-title">{issue?.title ?? 'Issue'}</h1>{error && <p className="scan-error" role="alert">{error}</p>}{issue && <><div className="scan-detail-card"><p>{issue.message}</p><dl className="scan-detail-grid"><div><dt>Severity</dt><dd>{issue.severity}</dd></div><div><dt>Status</dt><dd>{issue.status}</dd></div><div><dt>Detector</dt><dd>{issue.detectorId}</dd></div><div><dt>Affected URL</dt><dd><TargetUrlDisplay url={issue.primaryUrl} /></dd></div><div><dt>Occurrences</dt><dd>{issue.occurrenceCount}</dd></div><div><dt>Last seen</dt><dd>{new Date(issue.lastSeenAt).toLocaleString()}</dd></div></dl><div className="scan-actions"><button className="dashboard-secondary-button" type="button" onClick={() => void setStatus('CONFIRMED')}>Confirm</button><button className="dashboard-secondary-button" type="button" onClick={() => void setStatus('IGNORED')}>Ignore</button><button className="dashboard-secondary-button" type="button" onClick={() => void setStatus('FALSE_POSITIVE')}>False positive</button></div></div>{issue.module === 'visual-responsive' && <div className="scan-detail-card"><p className="dashboard-eyebrow">VISUAL CONTEXT</p><h2>Rendered evidence</h2><p>This finding was detected from a rendered browser viewport. Open the related visual scan to compare the original screenshot with its private annotation.</p><dl className="scan-detail-grid"><div><dt>Visual detector</dt><dd>{issue.detectorId}</dd></div><div><dt>Related scans</dt><dd>{issue.scanIds?.length ?? 0}</dd></div><div><dt>Evidence workflow</dt><dd>Screenshot → annotation → occurrence</dd></div></dl>{issue.scanIds?.[0] && <Link className="dashboard-secondary-button" href={`/scans/${issue.scanIds[0]}`}>Open visual scan</Link>}</div>}</>}</section>;
}
