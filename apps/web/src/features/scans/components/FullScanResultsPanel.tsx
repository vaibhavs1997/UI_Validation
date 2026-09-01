'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type {
  FullScanModuleId,
  FullScanModuleState,
  FullScanSummary,
  Issue,
  BrowserPageExecution,
  Scan,
} from '@visionqa/contracts';
import {
  cancelScan,
  getFullScanModules,
  getFullScanSummary,
  getBrowserPages,
  getScanIssues,
} from '../scan.service';
import { ScanStatusBadge } from './ScanStatusBadge';

const labels: Record<FullScanModuleId, string> = {
  'crawl-site-structure': 'Crawl & Site Structure',
  'links-resources': 'Links & Resources',
  'visual-responsive': 'Visual & Responsive',
  'interactions-forms': 'Interactions & Forms',
  'browser-network': 'Browser & Network',
  'accessibility-seo': 'Accessibility & SEO',
  'performance-compatibility': 'Performance & Compatibility',
  'custom-checks': 'Custom Checks',
};
const routes: Record<FullScanModuleId, string> = {
  'crawl-site-structure': '/qa/crawl',
  'links-resources': '/qa/links-resources',
  'visual-responsive': '/qa/visual-responsive',
  'interactions-forms': '/qa/interactions-forms',
  'browser-network': '/qa/browser-network',
  'accessibility-seo': '/qa/accessibility-seo',
  'performance-compatibility': '/qa/performance-compatibility',
  'custom-checks': '/qa/custom-checks',
};

export function FullScanResultsPanel({
  projectId,
  scan,
  onScan,
}: {
  projectId: string;
  scan: Scan;
  onScan: (scan: Scan) => void;
}) {
  const [summary, setSummary] = useState<FullScanSummary | null>(null);
  const [modules, setModules] = useState<FullScanModuleState[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [browserPages, setBrowserPages] = useState<BrowserPageExecution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [nextSummary, nextModules, nextIssues, nextBrowserPages] =
          await Promise.all([
            getFullScanSummary(projectId, scan.id),
            getFullScanModules(projectId, scan.id),
            getScanIssues(projectId, scan.id),
            getBrowserPages(projectId, scan.id),
          ]);
        if (active) {
          setSummary(nextSummary);
          setModules(nextModules.modules);
          setIssues(nextIssues.issues);
          setBrowserPages(nextBrowserPages.executions);
          setError(null);
        }
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unable to load Full Scan results.',
          );
      }
    };
    void load();
    const timer =
      scan.status === 'queued' || scan.status === 'running'
        ? setInterval(() => void load(), 2000)
        : undefined;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [projectId, scan.id, scan.status]);
  const stop = async () => {
    setCancelling(true);
    try {
      onScan(await cancelScan(projectId, scan.id));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to cancel scan.',
      );
    } finally {
      setCancelling(false);
    }
  };
  const severity = summary?.issues.bySeverity ?? {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  const progress =
    scan.fullScanProgress?.overallPercent ?? scan.progress.percent;
  const selectedModules = modules.filter(
    (module) => module.status !== 'NOT_SELECTED',
  );
  return (
    <div className="full-scan-results">
      <div className="scan-detail-card">
        <div className="scan-detail-header">
          <div>
            <h2>Full Scan overview</h2>
            <p>
              {scan.target?.safeDisplayUrl ??
                scan.target?.requestedUrl ??
                'Target unavailable'}{' '}
              · {scan.scope}
            </p>
          </div>
          <ScanStatusBadge status={scan.status} />
        </div>
        {error && (
          <p className="scan-error" role="alert">
            {error}
          </p>
        )}
        <div
          className="scan-progress-line"
          aria-label={`Full Scan ${progress}%`}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="scan-progress-label">
          {progress}% complete · {scan.fullScanProgress?.stage ?? 'DISCOVERY'}
        </p>
        {(scan.status === 'queued' || scan.status === 'running') && (
          <button
            className="dashboard-secondary-button"
            type="button"
            disabled={cancelling}
            onClick={() => void stop()}
          >
            {cancelling ? 'Cancelling…' : 'Cancel Full Scan'}
          </button>
        )}
        <dl className="scan-detail-grid">
          <div>
            <dt>Pages analyzed</dt>
            <dd>
              {summary?.pages.analyzed ?? '—'} /{' '}
              {summary?.pages.eligibleForBrowser ??
                summary?.pages.discovered ??
                '—'}
            </dd>
          </div>
          <div>
            <dt>Modules completed</dt>
            <dd>
              {summary?.modules.completed ?? '—'} /{' '}
              {summary?.modules.selected ?? '—'}
            </dd>
          </div>
          <div>
            <dt>Total issues</dt>
            <dd>{summary?.issues.total ?? '—'}</dd>
          </div>
          <div>
            <dt>Critical · High</dt>
            <dd>
              {severity.critical} · {severity.high}
            </dd>
          </div>
          <div>
            <dt>Medium · Low</dt>
            <dd>
              {severity.medium} · {severity.low}
            </dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>
              {summary?.scan.completedAt && summary.scan.startedAt
                ? `${Math.max(0, new Date(summary.scan.completedAt).getTime() - new Date(summary.scan.startedAt).getTime())}ms`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Browser contexts</dt>
            <dd>
              {summary?.browserExecutions.completed ?? '—'} /{' '}
              {summary?.browserExecutions.planned ?? '—'}
            </dd>
          </div>
          <div>
            <dt>Context failures</dt>
            <dd>{summary?.browserExecutions.failed ?? '—'}</dd>
          </div>
        </dl>
      </div>
      <div className="full-scan-module-results">
        <h2>Selected modules</h2>
        {selectedModules.length ? (
          selectedModules.map((module) => (
            <article className="full-scan-result-module" key={module.module}>
              <div>
                <strong>{labels[module.module]}</strong>
                <p>
                  {module.status} ·{' '}
                  {module.checks
                    ? Object.values(module.checks).filter(
                        (status) => status === 'EXECUTED',
                      ).length
                    : 0}{' '}
                  checks executed
                </p>
              </div>
              <span
                className={`scan-status scan-status-${module.status.toLowerCase()}`}
              >
                {module.status}
              </span>
              <Link href={routes[module.module]}>Open module →</Link>
            </article>
          ))
        ) : (
          <p className="scan-empty-state">
            Module execution states are not available yet.
          </p>
        )}
      </div>
      <div className="scan-detail-card">
        <h2>Page coverage</h2>
        {browserPages.length ? (
          <div className="scan-page-table">
            {browserPages.map((page) => (
              <div className="scan-page-row" key={page.id}>
                <div>
                  <strong>{page.pageUrl}</strong>
                  <small>
                    {page.browser} · {page.viewport.width} ×{' '}
                    {page.viewport.height}
                  </small>
                </div>
                <span>{page.httpStatus ?? '—'}</span>
                <ScanStatusBadge
                  status={
                    page.status === 'COMPLETED'
                      ? 'completed'
                      : page.status === 'FAILED'
                        ? 'failed'
                        : page.status === 'CANCELLED'
                          ? 'cancelled'
                          : page.status === 'UNAVAILABLE'
                            ? 'partial'
                            : 'running'
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="scan-empty-state">
            Browser page contexts will appear after Crawl produces the
            authoritative inventory.
          </p>
        )}
      </div>
      <div className="scan-detail-card">
        <h2>Issues</h2>
        {issues.length ? (
          <div className="scan-page-table">
            {issues.map((issue) => (
              <div className="scan-page-row" key={issue.id}>
                <div>
                  <strong>{issue.title}</strong>
                  <small>
                    {labels[issue.module as FullScanModuleId] ?? issue.module} ·{' '}
                    {issue.primaryUrl}
                  </small>
                </div>
                <span>{issue.severity}</span>
                <ScanStatusBadge
                  status={issue.status === 'FIXED' ? 'completed' : 'running'}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="scan-empty-state">
            {scan.status === 'completed' || scan.status === 'partial'
              ? 'No issues found.'
              : 'Issues will appear after selected detectors execute.'}
          </p>
        )}
      </div>
      <div className="scan-detail-card">
        <h2>Evidence</h2>
        <p className="scan-empty-state">
          Evidence remains private and is available through the existing scan
          evidence endpoint after browser work completes.
        </p>
      </div>
    </div>
  );
}
