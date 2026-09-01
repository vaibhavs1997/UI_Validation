'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Report, ReportOptions, Scan } from '@visionqa/contracts';
import { useProjects } from '@/features/projects/project-context';
import { getScans } from '@/features/scans/scan.service';
import {
  deleteReport,
  generateReport,
  getReports,
} from '@/features/reports/report.service';

export default function ReportsPage() {
  const { selectedProject } = useProjects();
  const [reports, setReports] = useState<Report[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState('');
  const [title, setTitle] = useState('');
  const [includeIssues, setIncludeIssues] = useState(true);
  const [openOnly, setOpenOnly] = useState(false);
  const [severityMinimum, setSeverityMinimum] =
    useState<ReportOptions['severityMinimum']>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!selectedProject) return;
    try {
      const [reportResult, scanResult] = await Promise.all([
        getReports(selectedProject.id),
        getScans(selectedProject.id),
      ]);
      setReports(reportResult.reports);
      setScans(scanResult);
      setSelectedScan(
        (current) =>
          current ||
          scanResult.find((scan) =>
            ['completed', 'partial', 'failed', 'cancelled'].includes(
              scan.status,
            ),
          )?.id ||
          '',
      );
    } catch {
      setError('Unable to load reports.');
    }
  };
  useEffect(() => {
    void load();
  }, [selectedProject]);

  const create = async () => {
    if (!selectedProject || !selectedScan) return;
    setBusy(true);
    setError(null);
    try {
      await generateReport(
        selectedProject.id,
        selectedScan,
        {
          ...(title.trim() ? { title: title.trim() } : {}),
          includeIssues,
          ...(openOnly ? { issueFilter: 'OPEN_ONLY' as const } : {}),
          ...(severityMinimum ? { severityMinimum } : {}),
          includeEvidenceReferences: false,
        },
        crypto.randomUUID(),
      );
      setTitle('');
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to generate report.',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (report: Report) => {
    if (
      !selectedProject ||
      !window.confirm(
        `Delete report “${report.title}”? The scan and issues will be preserved.`,
      )
    )
      return;
    try {
      await deleteReport(selectedProject.id, report.id);
      setReports((current) => current.filter((item) => item.id !== report.id));
    } catch {
      setError('Unable to delete report.');
    }
  };

  return (
    <section className="report-page">
      <p className="dashboard-eyebrow">SHAREABLE OUTPUT</p>
      <h1 className="dashboard-page-title">Reports</h1>
      <p className="dashboard-lead">
        Create immutable, printable snapshots from completed scan results.
      </p>
      {error && (
        <p className="scan-error" role="alert">
          {error}
        </p>
      )}
      <div className="report-generate-card">
        <div>
          <h2>Generate report</h2>
          <p>Reports never rerun a scan or contact the target site.</p>
        </div>
        <label>
          Scan
          <select
            value={selectedScan}
            onChange={(event) => setSelectedScan(event.target.value)}
          >
            <option value="">Choose a terminal scan</option>
            {scans
              .filter((scan) =>
                ['completed', 'partial', 'failed', 'cancelled'].includes(
                  scan.status,
                ),
              )
              .map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {scan.module} ·{' '}
                  {scan.target?.safeDisplayUrl ?? scan.requestedUrls[0]} ·{' '}
                  {scan.status}
                </option>
              ))}
          </select>
        </label>
        <label>
          Title (optional)
          <input
            value={title}
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="VisionQA Scan Report"
          />
        </label>
        <div className="report-option-row">
          <label>
            <input
              type="checkbox"
              checked={includeIssues}
              onChange={(event) => setIncludeIssues(event.target.checked)}
            />{' '}
            Include issues
          </label>
          <label>
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(event) => setOpenOnly(event.target.checked)}
            />{' '}
            Open issues only
          </label>
          <label>
            Minimum severity
            <select
              value={severityMinimum ?? ''}
              onChange={(event) =>
                setSeverityMinimum(
                  (event.target.value ||
                    undefined) as ReportOptions['severityMinimum'],
                )
              }
            >
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High+</option>
              <option value="medium">Medium+</option>
              <option value="low">Low+</option>
            </select>
          </label>
        </div>
        <button
          className="liquid-primary"
          type="button"
          disabled={busy || !selectedScan}
          onClick={() => void create()}
        >
          {busy ? 'Generating…' : 'Generate report'}
        </button>
      </div>
      <div className="report-list-header">
        <div>
          <h2>Generated reports</h2>
          <p>
            {reports.length
              ? `${reports.length} report${reports.length === 1 ? '' : 's'}`
              : 'No reports yet'}
          </p>
        </div>
      </div>
      {!reports.length && (
        <div className="report-empty-state">
          Choose a completed, partial, failed, or cancelled scan above to create
          the first report.
        </div>
      )}
      {reports.length > 0 && (
        <div className="report-list">
          {reports.map((report) => (
            <article className="report-list-card" key={report.id}>
              <div>
                <span className="report-status-badge">{report.status}</span>
                <h3>{report.title}</h3>
                <p>
                  {report.summarySnapshot.target} ·{' '}
                  {new Date(
                    report.summarySnapshot.completedAt ?? report.generatedAt,
                  ).toLocaleString()}{' '}
                  · {report.summarySnapshot.triggerSource}
                </p>
                <small>
                  {report.metadata.projectName} ·{' '}
                  {report.metadata.truncated.issueTotal} issue
                  {report.metadata.truncated.issueTotal === 1 ? '' : 's'} ·
                  Version {report.reportVersion}
                </small>
              </div>
              <div className="report-actions">
                <Link
                  className="dashboard-card-action"
                  href={`/reports/${report.id}`}
                >
                  Open
                </Link>
                <button
                  className="dashboard-secondary-button"
                  type="button"
                  onClick={() => void remove(report)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
