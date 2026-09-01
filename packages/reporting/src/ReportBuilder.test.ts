import { describe, expect, it } from 'vitest';
import type { Issue, ReportBuilderSources, Scan } from '@visionqa/contracts';
import { ReportBuilder, renderReportHtml, safeReportUrl } from './ReportBuilder.js';

const scan = (overrides: Partial<Scan> = {}) => ({
  id: 'scan-1',
  projectId: 'project-1',
  createdBy: 'user-1',
  target: {
    requestedUrl: 'https://example.com/?token=secret',
    normalizedUrl: 'https://example.com/',
    origin: 'https://example.com',
    protocol: 'https',
    hostname: 'example.com',
  },
  scope: 'site',
  type: 'full',
  module: 'full-scan',
  modules: [
    { module: 'accessibility-seo', checks: ['accessible-name'] },
    { module: 'performance-compatibility', checks: ['lcp'] },
  ],
  checks: ['accessible-name', 'lcp'],
  requestedUrls: ['https://example.com/'],
  viewports: [{ width: 1366, height: 768 }],
  browsers: ['chromium', 'firefox'],
  options: {},
  status: 'partial',
  progress: { completed: 1, total: 2, percent: 50 },
  createdAt: '2026-09-01T09:00:00.000Z',
  updatedAt: '2026-09-01T09:05:00.000Z',
  startedAt: '2026-09-01T09:00:01.000Z',
  completedAt: '2026-09-01T09:05:01.000Z',
  triggerSource: 'SCHEDULE',
  scheduleId: 'schedule-1',
  ...overrides,
}) as Scan;

const issue = (id: string, severity: Issue['severity'], overrides: Partial<Issue> = {}) => ({
  id,
  projectId: 'project-1',
  detectorId: 'accessible-name',
  module: 'accessibility-seo',
  severity,
  status: 'OPEN',
  title: `Issue ${id}`,
  message: '<script>alert(1)</script>',
  fingerprint: id,
  primaryUrl: 'https://example.com/?token=secret',
  firstSeenAt: '2026-09-01T09:01:00.000Z',
  lastSeenAt: '2026-09-01T09:01:00.000Z',
  occurrenceCount: 2,
  createdAt: '2026-09-01T09:01:00.000Z',
  updatedAt: '2026-09-01T09:01:00.000Z',
  ...overrides,
}) as Issue;

function sources(overrides: Partial<ReportBuilderSources> = {}): ReportBuilderSources {
  return {
    projectName: 'Example Project',
    scan: scan(),
    issues: [issue('medium-1', 'medium'), issue('critical-1', 'critical')],
    crawlPages: [],
    crawlSummary: { pagesDiscovered: 2, pagesFetched: 1, pagesFailed: 1, maxDepthReached: 1, durationMs: 2000 },
    resources: [],
    browserExecutions: [],
    browserFacts: [],
    evidence: [],
    customResults: [],
    customCheckSnapshots: [],
    ...overrides,
  };
}

describe('ReportBuilder', () => {
  it('builds an honest bounded snapshot from authoritative sources', () => {
    const report = new ReportBuilder().build({ sources: sources(), scheduleName: 'Nightly QA', timezone: 'Asia/Kolkata', generatedAt: '2026-09-01T10:00:00.000Z' });
    expect(report.title).toBe('VisionQA Scan Report — example.com');
    expect(report.summarySnapshot.triggerSource).toBe('SCHEDULED');
    expect(report.summarySnapshot.scanStatus).toBe('partial');
    expect(report.summarySnapshot.issueCounts.critical).toBe(1);
    expect(report.issueSnapshot.map((item) => item.severity)).toEqual(['critical', 'medium']);
    expect(report.metadata.schedule).toEqual({ id: 'schedule-1', name: 'Nightly QA' });
    expect(report.metadata.timezone).toBe('Asia/Kolkata');
    expect(report.sections.performance).toBeDefined();
    expect(report.sections.performance?.lcpMs).toBeNull();
    expect(report.sections.accessibility?.note).toBe('Automated accessibility findings');
    expect(report.metadata.truncated.issues).toBe(false);
  });

  it('masks sensitive URL query values and bounds issue snapshots', () => {
    expect(safeReportUrl('https://example.com/?token=secret&x=1')).toBe('https://example.com/');
    const issues = Array.from({ length: 205 }, (_, index) => issue(`issue-${index}`, 'low'));
    const report = new ReportBuilder().build({ sources: sources({ issues }) });
    expect(report.issueSnapshot).toHaveLength(200);
    expect(report.metadata.truncated.issues).toBe(true);
    expect(report.metadata.truncated.issueTotal).toBe(205);
  });

  it('keeps report snapshots independent when source issue status changes', () => {
    const input = sources({ issues: [issue('one', 'high', { status: 'OPEN' })] });
    const first = new ReportBuilder().build({ sources: input, generatedAt: '2026-09-01T10:00:00.000Z' });
    input.issues[0]!.status = 'FIXED';
    const second = new ReportBuilder().build({ sources: input, generatedAt: '2026-09-01T11:00:00.000Z' });
    expect(first.issueSnapshot[0]!.status).toBe('OPEN');
    expect(second.issueSnapshot[0]!.status).toBe('FIXED');
    expect(first.snapshotHash).not.toBe(second.snapshotHash);
  });

  it('escapes target-derived text in printable HTML', () => {
    const snapshot = new ReportBuilder().build({ sources: sources({ issues: [issue('xss', 'high')] }) });
    const html = renderReportHtml({ ...snapshot, id: 'report-1', projectId: 'project-1', scanId: 'scan-1', reportVersion: 1, generatedAt: snapshot.metadata.generatedAt });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('break-inside:avoid');
  });

  it('preserves custom-check names and versions while redacting values', () => {
    const report = new ReportBuilder().build({
      sources: sources({
        scan: scan({ module: 'custom-checks', type: 'module', checks: ['custom-check-1'] }),
        customCheckSnapshots: [{ id: 'custom-check-1', name: 'Token check', version: 4, severity: 'high', definition: { targetType: 'DOM', source: 'text', operator: 'CONTAINS', expected: 'safe' } }],
        customResults: [{ customCheckId: 'custom-check-1', scanId: 'scan-1', pageUrl: 'https://example.com/?token=secret', status: 'FAIL', actual: 'token=secret', expected: 'safe', message: 'token=secret', evaluatedAt: '2026-09-01T09:01:00.000Z' }],
      }),
    });
    expect(report.sections.customChecks?.checks[0]).toMatchObject({ name: 'Token check', version: 4 });
    expect(report.sections.customChecks?.results[0]?.actual).toBe('[REDACTED]');
    expect(report.sections.customChecks?.results[0]?.message).toBe('[REDACTED]');
  });
});
