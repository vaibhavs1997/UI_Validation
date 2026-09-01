'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Report } from '@visionqa/contracts';
import { useProjects } from '@/features/projects/project-context';
import { getReport } from '@/features/reports/report.service';

const metric = (value: number | null | undefined, suffix = '') =>
  value === null || value === undefined
    ? 'Unavailable'
    : `${Math.round(value * 100) / 100}${suffix}`;

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { selectedProject } = useProjects();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedProject || !reportId) return;
    void getReport(selectedProject.id, reportId)
      .then(setReport)
      .catch(() => setError('Unable to load this report.'));
  }, [selectedProject, reportId]);
  if (error)
    return (
      <section className="report-page">
        <p className="scan-error" role="alert">
          {error}
        </p>
      </section>
    );
  if (!report)
    return (
      <section className="report-page">
        <p className="dashboard-eyebrow">REPORT</p>
        <h1 className="dashboard-page-title">Loading report…</h1>
      </section>
    );
  const summary = report.summarySnapshot;
  const issues = report.issueSnapshot;
  return (
    <section className="report-page report-print-surface">
      <div className="report-detail-toolbar">
        <Link className="scan-back-link" href="/reports">
          ← Reports
        </Link>
        <div>
          <button
            className="dashboard-secondary-button no-print"
            type="button"
            onClick={() => window.print()}
          >
            Print report
          </button>
          <Link
            className="dashboard-card-action no-print"
            href={`/scans/${report.scanId}`}
          >
            Open scan
          </Link>
        </div>
      </div>
      <header className="report-cover">
        <p className="dashboard-eyebrow">
          VISIONQA · {report.metadata.projectName}
        </p>
        <h1 className="dashboard-page-title">{report.title}</h1>
        <p className="dashboard-lead">
          {summary.target} · {summary.triggerSource} · Report version{' '}
          {report.reportVersion}
        </p>
        <div className="report-status-badge">
          {summary.scanStatus.toUpperCase()}
        </div>
        {summary.scanStatus === 'partial' ||
        summary.scanStatus === 'failed' ||
        summary.scanStatus === 'cancelled' ? (
          <p className="report-incomplete-note">
            This report reflects incomplete scan coverage and does not present
            missing modules as successful.
          </p>
        ) : null}
      </header>
      <section className="report-section">
        <h2>Executive summary</h2>
        <div className="report-summary-grid">
          <div>
            <strong>{summary.pagesAnalyzed}</strong>
            <span>Pages analyzed</span>
          </div>
          <div>
            <strong>{summary.modulesRun}</strong>
            <span>Modules run</span>
          </div>
          {(['critical', 'high', 'medium', 'low'] as const).map((severity) => (
            <div key={severity}>
              <strong>{summary.issueCounts[severity]}</strong>
              <span>{severity}</span>
            </div>
          ))}
        </div>
        <dl className="report-metadata-grid">
          <div>
            <dt>Scope</dt>
            <dd>{summary.scope}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>
              {summary.startedAt
                ? new Date(summary.startedAt).toLocaleString()
                : 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>
              {summary.completedAt
                ? new Date(summary.completedAt).toLocaleString()
                : 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{metric(summary.durationMs, ' ms')}</dd>
          </div>
        </dl>
      </section>
      <section className="report-section">
        <h2>Module coverage</h2>
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Status</th>
                <th>Checks</th>
                <th>Coverage</th>
                <th>Findings</th>
              </tr>
            </thead>
            <tbody>
              {report.moduleSnapshots.map((module) => (
                <tr key={module.module}>
                  <td>{module.module}</td>
                  <td>{module.status}</td>
                  <td>{module.checks.join(', ') || 'Unavailable'}</td>
                  <td>
                    {module.coverage.pagesAnalyzed} pages ·{' '}
                    {module.coverage.executionsCompleted} executions
                  </td>
                  <td>{module.findingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {summary.partialModules.length > 0 && (
          <p className="report-incomplete-note">
            Partial or unavailable modules: {summary.partialModules.join(', ')}
          </p>
        )}
      </section>
      {report.sections.crawl && (
        <section className="report-section">
          <h2>Crawl</h2>
          <div className="report-stat-line">
            <span>
              Discovered <b>{report.sections.crawl.pagesDiscovered}</b>
            </span>
            <span>
              Fetched <b>{report.sections.crawl.pagesFetched}</b>
            </span>
            <span>
              Failed/skipped <b>{report.sections.crawl.failedOrSkippedPages}</b>
            </span>
            <span>
              Robots{' '}
              <b>
                {report.sections.crawl.robots.available
                  ? 'Available'
                  : 'Unavailable'}
              </b>
            </span>
            <span>
              Sitemap{' '}
              <b>
                {report.sections.crawl.sitemap.available
                  ? (report.sections.crawl.sitemap.urlCount ?? 'Available')
                  : 'Unavailable'}
              </b>
            </span>
          </div>
        </section>
      )}
      {report.sections.links && (
        <section className="report-section">
          <h2>Links &amp; resources</h2>
          <div className="report-stat-line">
            <span>
              Checked <b>{report.sections.links.checked}</b>
            </span>
            <span>
              Broken internal <b>{report.sections.links.brokenInternal}</b>
            </span>
            <span>
              Broken external <b>{report.sections.links.brokenExternal}</b>
            </span>
            <span>
              Redirect issues <b>{report.sections.links.redirectIssues}</b>
            </span>
          </div>
        </section>
      )}
      {report.sections.browserNetwork && (
        <section className="report-section">
          <h2>Browser &amp; network</h2>
          <div className="report-stat-line">
            <span>
              Console errors{' '}
              <b>{report.sections.browserNetwork.consoleErrors}</b>
            </span>
            <span>
              Page errors <b>{report.sections.browserNetwork.pageErrors}</b>
            </span>
            <span>
              Failed requests{' '}
              <b>{report.sections.browserNetwork.failedRequests}</b>
            </span>
            <span>
              HTTP errors <b>{report.sections.browserNetwork.httpErrors}</b>
            </span>
            <span>
              Pages executed{' '}
              <b>{report.sections.browserNetwork.pagesExecuted}</b>
            </span>
          </div>
        </section>
      )}
      {report.sections.accessibility && (
        <section className="report-section">
          <h2>Accessibility</h2>
          <p className="report-note">
            {report.sections.accessibility.note}. This is not a formal WCAG
            certification.
          </p>
          <div className="report-stat-line">
            <span>
              Pages affected{' '}
              <b>{report.sections.accessibility.pagesAffected}</b>
            </span>
            <span>
              Selected checks{' '}
              <b>{report.sections.accessibility.selectedChecks.length}</b>
            </span>
            <span>
              Findings{' '}
              <b>
                {Object.values(
                  report.sections.accessibility.findingsByDetector,
                ).reduce((sum, count) => sum + count, 0)}
              </b>
            </span>
          </div>
        </section>
      )}
      {report.sections.seo && (
        <section className="report-section">
          <h2>SEO</h2>
          <p className="report-note">Automated SEO metadata and indexability findings.</p>
          <div className="report-stat-line">
            <span>Pages affected <b>{report.sections.seo.pagesAffected}</b></span>
            <span>Detector findings <b>{Object.values(report.sections.seo.findingsByDetector).reduce((sum, count) => sum + count, 0)}</b></span>
          </div>
        </section>
      )}
      {report.sections.visual && (
        <section className="report-section">
          <h2>Visual</h2>
          <div className="report-stat-line">
            <span>Pages analyzed <b>{report.sections.visual.pagesAnalyzed}</b></span>
            <span>Findings <b>{report.sections.visual.findingCount}</b></span>
            <span>Viewports <b>{report.sections.visual.viewports.length}</b></span>
          </div>
          <p className="report-note">Top affected pages: {report.sections.visual.topAffectedPages.slice(0, 5).map((page) => `${page.pageUrl} (${page.findings})`).join(' · ') || 'None recorded.'}</p>
        </section>
      )}
      {report.sections.interactions && (
        <section className="report-section">
          <h2>Interactions &amp; forms</h2>
          <p className="report-note">Only persisted interaction findings are included; destructive actions are not implied.</p>
          <div className="report-stat-line">
            <span>Form validation findings <b>{report.sections.interactions.formValidationFindings}</b></span>
            <span>Controls analyzed <b>{report.sections.interactions.controlsAnalyzed ?? 'Unavailable'}</b></span>
            <span>Safety-skipped actions <b>{report.sections.interactions.safetySkippedActions ?? 'Unavailable'}</b></span>
          </div>
        </section>
      )}
      {report.sections.performance && (
        <section className="report-section">
          <h2>Performance</h2>
          <div className="report-stat-line">
            <span>
              TTFB <b>{metric(report.sections.performance.ttfbMs, ' ms')}</b>
            </span>
            <span>
              FCP <b>{metric(report.sections.performance.fcpMs, ' ms')}</b>
            </span>
            <span>
              LCP <b>{metric(report.sections.performance.lcpMs, ' ms')}</b>
            </span>
            <span>
              CLS <b>{metric(report.sections.performance.cls)}</b>
            </span>
            <span>
              Load <b>{metric(report.sections.performance.loadMs, ' ms')}</b>
            </span>
            <span>
              Requests{' '}
              <b>{report.sections.performance.requests ?? 'Unavailable'}</b>
            </span>
          </div>
        </section>
      )}
      {report.sections.compatibility && (
        <section className="report-section">
          <h2>Compatibility</h2>
          <p className="report-note">
            State: {report.sections.compatibility.state}.{' '}
            {report.sections.compatibility.note ??
              'Incomplete browser coverage remains visible.'}
          </p>
          <div className="report-stat-line">
            <span>
              Requested{' '}
              <b>
                {report.sections.compatibility.requestedBrowsers.join(', ')}
              </b>
            </span>
            <span>
              Executed{' '}
              <b>
                {report.sections.compatibility.executedBrowsers.join(', ') ||
                  'None'}
              </b>
            </span>
            <span>
              Unavailable{' '}
              <b>
                {report.sections.compatibility.unavailableBrowsers.join(', ') ||
                  'None'}
              </b>
            </span>
          </div>
        </section>
      )}
      {report.sections.customChecks && (
        <section className="report-section">
          <h2>Custom checks</h2>
          <div className="report-stat-line">
            <span>
              Passed <b>{report.sections.customChecks.passed}</b>
            </span>
            <span>
              Failed <b>{report.sections.customChecks.failed}</b>
            </span>
            <span>
              Skipped <b>{report.sections.customChecks.skipped}</b>
            </span>
            <span>
              Errors <b>{report.sections.customChecks.errors}</b>
            </span>
          </div>
          <p>
            {report.sections.customChecks.checks
              .map((check) => `${check.name} v${check.version}`)
              .join(' · ') || 'No checks recorded.'}
          </p>
          {report.sections.customChecks.results.length > 0 && (
            <ul className="report-custom-results">
              {report.sections.customChecks.results.slice(0, 20).map((result, index) => (
                <li key={`${result.checkId}-${result.pageUrl}-${index}`}>
                  <strong>{result.name} v{result.version}</strong> · {result.status} · {result.pageUrl}
                  {result.actual !== undefined ? ` · actual: ${String(result.actual)}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section className="report-section">
        <h2>Issues</h2>
        {report.metadata.truncated.issues && (
          <p className="report-incomplete-note">
            Showing first {issues.length} of{' '}
            {report.metadata.truncated.issueTotal} findings.
          </p>
        )}
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Issue</th>
                <th>Module</th>
                <th>Page</th>
                <th>Status</th>
                <th>Occurrences</th>
              </tr>
            </thead>
            <tbody>
              {issues.length ? (
                issues.map((issue) => (
                  <tr key={issue.issueId}>
                    <td>
                      <span className={`severity-${issue.severity}`}>
                        {issue.severity}
                      </span>
                    </td>
                    <td>
                      <strong>{issue.title}</strong>
                      <small>{issue.description}</small>
                    </td>
                    <td>{issue.module}</td>
                    <td className="report-long-value">{issue.pageUrl}</td>
                    <td>{issue.status}</td>
                    <td>{issue.occurrenceCount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>No findings included.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {report.evidenceReferences.length > 0 && (
        <section className="report-section">
          <h2>Evidence references</h2>
          <ul>
            {report.evidenceReferences.map((item) => (
              <li key={item.evidenceId}>
                {item.type} · {item.page ?? 'Page unavailable'} ·{' '}
                {item.browser ?? 'Browser unavailable'}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="report-section">
        <h2>Scan metadata</h2>
        <p>
          Scan ID {report.scanId} · Generated{' '}
          {new Date(report.generatedAt).toLocaleString()} · Snapshot{' '}
          {report.snapshotHash.slice(0, 16)}…
        </p>
      </section>
    </section>
  );
}
