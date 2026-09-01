import { createHash } from 'node:crypto';
import type {
  BrowserPageExecution,
  Issue,
  ReportBuilderInput,
  ReportBuilderSources,
  ReportIssueSnapshot,
  ReportModuleSnapshot,
  ReportOptions,
  ReportSections,
  ReportSnapshot,
  Severity,
} from '@visionqa/contracts';

export const MAX_REPORT_SNAPSHOT_BYTES = 1_000_000;
const MAX_ISSUES = 200;
const MAX_EVIDENCE = 100;
const MAX_PAGES = 100;
const MAX_CUSTOM_RESULTS = 200;
const MAX_TEXT = 500;
const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const severityRank = new Map(severityOrder.map((value, index) => [value, index]));
const clampText = (value: string, limit = MAX_TEXT) => value.slice(0, limit);

export function safeReportUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return clampText(url.toString(), 240);
  } catch {
    return clampText(value.replace(/[?#].*$/, ''), 240);
  }
}

export function redactReportValue<T extends string | number | boolean | null>(
  value: T | undefined,
): T | string | null | undefined {
  if (typeof value !== 'string') return value;
  if (/(token|secret|password|authorization|api[_-]?key|cookie)\s*=/i.test(value)) return '[REDACTED]';
  return clampText(value);
}

function normalizedOptions(options: ReportOptions = {}) {
  return {
    includeExecutiveSummary: options.includeExecutiveSummary ?? true,
    includeModules: options.includeModules ?? true,
    includeIssues: options.includeIssues ?? true,
    includeEvidenceReferences: options.includeEvidenceReferences ?? false,
    includePassedChecks: options.includePassedChecks ?? false,
    includeTechnicalDetails: options.includeTechnicalDetails ?? false,
    issueFilter: options.issueFilter ?? 'ALL',
    ...(options.severityMinimum ? { severityMinimum: options.severityMinimum } : {}),
  };
}

function issueCounts(issues: Issue[]) {
  return Object.fromEntries(severityOrder.map((severity) => [severity, issues.filter((issue) => issue.severity === severity).length])) as Record<Severity, number>;
}

function statusForScan(status: ReportBuilderSources['scan']['status']): string {
  return status === 'completed' ? 'COMPLETED' : status === 'partial' ? 'PARTIAL' : status === 'failed' ? 'FAILED' : status === 'cancelled' ? 'CANCELLED' : status.toUpperCase();
}

function durationMs(startedAt?: string, completedAt?: string): number | null {
  if (!startedAt || !completedAt) return null;
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function selectedModules(sources: ReportBuilderSources) {
  if (sources.scan.module === 'full-scan') return (sources.scan.modules ?? []).map((item) => ({ module: item.module, checks: item.checks }));
  return [{ module: sources.scan.module, checks: sources.scan.checks }];
}
function moduleFindings(sources: ReportBuilderSources, module: string) { return sources.issues.filter((issue) => issue.module === module); }
function pageUrlFor(issue: Issue) { return safeReportUrl(issue.primaryUrl); }

function reportIssues(sources: ReportBuilderSources, options: ReturnType<typeof normalizedOptions>): ReportIssueSnapshot[] {
  const minimum = options.severityMinimum ? severityRank.get(options.severityMinimum) ?? severityOrder.length : severityOrder.length;
  return sources.issues.filter((issue) => {
    const open = ['OPEN', 'CONFIRMED', 'REOPENED'].includes(issue.status);
    return (options.issueFilter !== 'OPEN_ONLY' || open) && (severityRank.get(issue.severity) ?? severityOrder.length) <= minimum;
  }).sort((left, right) => (severityRank.get(left.severity) ?? 99) - (severityRank.get(right.severity) ?? 99) || left.title.localeCompare(right.title) || pageUrlFor(left).localeCompare(pageUrlFor(right)) || left.id.localeCompare(right.id)).slice(0, MAX_ISSUES).map((issue) => ({
    issueId: issue.id,
    detectorId: issue.detectorId,
    module: issue.module,
    title: clampText(issue.title),
    severity: issue.severity,
    status: issue.status,
    pageUrl: pageUrlFor(issue),
    occurrenceCount: issue.occurrenceCount,
    firstSeenAt: issue.firstSeenAt,
    lastSeenAt: issue.lastSeenAt,
    description: clampText(issue.message),
  }));
}

function browserCoverage(executions: BrowserPageExecution[]) {
  return Object.fromEntries([...new Set(executions.map((execution) => execution.browser))].map((browser) => [browser, executions.filter((execution) => execution.browser === browser && execution.status === 'COMPLETED').length]));
}

function moduleSnapshots(sources: ReportBuilderSources): ReportModuleSnapshot[] {
  const states = sources.scan.moduleStates ?? {};
  return selectedModules(sources).map(({ module, checks }) => {
    const state = states[module as keyof typeof states];
    const findings = moduleFindings(sources, module);
    const executions = sources.browserExecutions.filter((execution) => ['COMPLETED', 'FAILED', 'CANCELLED', 'UNAVAILABLE'].includes(execution.status));
    const pagesAnalyzed = module === 'crawl-site-structure' ? sources.crawlPages.filter((page) => page.crawlStatus === 'FETCHED').length : new Set(executions.map((execution) => execution.pageUrl)).size;
    return {
      module,
      status: state?.status ?? statusForScan(sources.scan.status),
      checks: state ? Object.keys(state.checks) : checks,
      coverage: {
        pagesAnalyzed,
        executionsCompleted: executions.filter((execution) => execution.status === 'COMPLETED').length,
        executionsFailed: executions.filter((execution) => ['FAILED', 'CANCELLED'].includes(execution.status)).length,
        unavailableBrowsers: [...new Set(executions.filter((execution) => execution.status === 'UNAVAILABLE').map((execution) => execution.browser))],
      },
      findingCount: findings.length,
      summary: { findings: findings.length, bySeverity: issueCounts(findings) },
    };
  });
}

function performanceSection(sources: ReportBuilderSources) {
  const snapshots = sources.browserExecutions.map((execution) => execution.performance).filter((item): item is NonNullable<BrowserPageExecution['performance']> => Boolean(item));
  const average = (values: Array<number | null>) => { const available = values.filter((value): value is number => value !== null); return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null; };
  const resources = snapshots.flatMap((snapshot) => snapshot.resources);
  const transfers = snapshots.map((snapshot) => snapshot.network.transferredBytes).filter((value): value is number => value !== null);
  return {
    pagesAnalyzed: snapshots.length,
    ttfbMs: average(snapshots.map((item) => item.navigation.ttfbMs)),
    fcpMs: average(snapshots.map((item) => item.webVitals.fcpMs)),
    lcpMs: average(snapshots.map((item) => item.webVitals.lcpMs)),
    cls: average(snapshots.map((item) => item.webVitals.cls)),
    loadMs: average(snapshots.map((item) => item.navigation.loadMs)),
    requests: snapshots.length ? snapshots.reduce((sum, item) => sum + item.network.requestCount, 0) : null,
    transferBytes: transfers.length ? transfers.reduce((sum, value) => sum + value, 0) : null,
    slowResources: resources.filter((resource) => (resource.durationMs ?? 0) > 2000).length,
    largeResources: resources.filter((resource) => (resource.transferSize ?? 0) > 1024 * 1024).length,
  };
}

function sections(sources: ReportBuilderSources, evidenceReferences: ReportSnapshot['evidenceReferences']): ReportSections {
  const modules = new Set<string>(selectedModules(sources).map((item) => item.module));
  const selected = (module: string) => modules.has(module);
  const issuesFor = (module: string) => moduleFindings(sources, module);
  const result: ReportSections = {};
  if (selected('crawl-site-structure')) result.crawl = {
    pagesDiscovered: sources.crawlSummary.pagesDiscovered,
    pagesFetched: sources.crawlSummary.pagesFetched,
    failedOrSkippedPages: sources.crawlPages.filter((page) => ['FAILED', 'SKIPPED'].includes(page.crawlStatus)).length,
    robots: { available: Boolean(sources.robots), ...(sources.robots ? { summary: sources.robots } : {}) },
    sitemap: { available: Boolean(sources.sitemapUrls?.length), ...(sources.sitemapUrls?.length ? { urlCount: sources.sitemapUrls.length } : {}) },
    ...(sources.comparison ? { comparison: { matched: sources.comparison.matched.length, crawlOnly: sources.comparison.crawlOnly.length, sitemapOnly: sources.comparison.sitemapOnly.length } } : {}),
  };
  if (selected('links-resources')) {
    const resources = sources.resources;
    result.links = {
      checked: resources.length,
      byType: Object.fromEntries([...new Set(resources.map((resource) => resource.resourceType))].map((type) => [type, resources.filter((resource) => resource.resourceType === type).length])),
      byStatus: Object.fromEntries([...new Set(resources.map((resource) => resource.status ?? 'UNKNOWN'))].map((status) => [status, resources.filter((resource) => (resource.status ?? 'UNKNOWN') === status).length])),
      brokenInternal: resources.filter((resource) => resource.isInternal && resource.status === 'BROKEN').length,
      brokenExternal: resources.filter((resource) => !resource.isInternal && resource.status === 'BROKEN').length,
      redirectIssues: resources.filter((resource) => resource.status === 'REDIRECTED' || resource.redirectChain.length > 0).length,
      failedResourceTypes: Object.fromEntries([...new Set(resources.filter((resource) => ['FAILED', 'BLOCKED'].includes(resource.status ?? '')).map((resource) => resource.resourceType))].map((type) => [type, resources.filter((resource) => resource.resourceType === type && ['FAILED', 'BLOCKED'].includes(resource.status ?? '')).length])),
    };
  }
  if (selected('visual-responsive')) {
    const findings = issuesFor('visual-responsive');
    const topAffectedPages = [...new Set(findings.map((issue) => issue.primaryUrl))].map((pageUrl) => ({ pageUrl: safeReportUrl(pageUrl), findings: findings.filter((issue) => issue.primaryUrl === pageUrl).length })).sort((a, b) => b.findings - a.findings || a.pageUrl.localeCompare(b.pageUrl)).slice(0, MAX_PAGES);
    result.visual = {
      pagesAnalyzed: new Set(sources.browserExecutions.map((execution) => execution.pageUrl)).size,
      viewports: [...new Map(sources.browserExecutions.map((execution) => [`${execution.viewport.width}x${execution.viewport.height}`, execution.viewport])).values()],
      findingCount: findings.length,
      byDetector: Object.fromEntries([...new Set(findings.map((issue) => issue.detectorId))].map((id) => [id, findings.filter((issue) => issue.detectorId === id).length])),
      topAffectedPages,
      evidenceReferences: evidenceReferences.filter((item) => item.type === 'SCREENSHOT' || item.type === 'VISUAL_ANNOTATION'),
    };
  }
  if (selected('interactions-forms')) {
    const findings = issuesFor('interactions-forms');
    result.interactions = { controlsAnalyzed: null, coveredControls: null, failedControls: null, noOpControls: null, formValidationFindings: findings.length, safetySkippedActions: null };
  }
  if (selected('browser-network')) {
    const facts = sources.browserFacts;
    result.browserNetwork = {
      consoleErrors: facts.filter((fact) => fact.kind === 'CONSOLE').length,
      pageErrors: facts.filter((fact) => fact.kind === 'PAGE_ERROR').length,
      failedRequests: facts.filter((fact) => fact.kind === 'FAILED_REQUEST').length,
      httpErrors: facts.filter((fact) => fact.kind === 'RESPONSE' && (fact.status ?? 0) >= 400).length,
      pagesExecuted: sources.browserExecutions.length,
      uniquePages: new Set(sources.browserExecutions.map((execution) => execution.pageUrl)).size,
      browserCoverage: browserCoverage(sources.browserExecutions),
    };
  }
  if (selected('accessibility-seo')) {
    const findings = issuesFor('accessibility-seo');
    result.accessibility = {
      findingsByDetector: Object.fromEntries([...new Set(findings.map((issue) => issue.detectorId))].map((id) => [id, findings.filter((issue) => issue.detectorId === id).length])),
      findingsBySeverity: issueCounts(findings),
      pagesAffected: new Set(findings.map((issue) => issue.primaryUrl)).size,
      selectedChecks: selectedModules(sources).find((item) => item.module === 'accessibility-seo')?.checks ?? [],
      note: 'Automated accessibility findings',
    };
    const seo = findings.filter((issue) => /seo|metadata|canonical|index/i.test(issue.detectorId));
    result.seo = { findingsByDetector: Object.fromEntries([...new Set(seo.map((issue) => issue.detectorId))].map((id) => [id, seo.filter((issue) => issue.detectorId === id).length])), pagesAffected: new Set(seo.map((issue) => issue.primaryUrl)).size, indexability: {} };
  }
  if (selected('performance-compatibility')) {
    result.performance = performanceSection(sources);
    const requested = sources.scan.browsers;
    const executed = [...new Set(sources.browserExecutions.filter((item) => item.status === 'COMPLETED').map((item) => item.browser))];
    const unavailable = [...new Set(sources.browserExecutions.filter((item) => ['FAILED', 'UNAVAILABLE'].includes(item.status)).map((item) => item.browser))];
    const differences = issuesFor('performance-compatibility').filter((issue) => issue.detectorId.startsWith('browser-')).length;
    const state = requested.length < 2 ? 'NOT_COMPARED' : unavailable.length || executed.length < requested.length ? 'PARTIAL' : differences ? 'DIFFERENCES_FOUND' : 'CONSISTENT';
    result.compatibility = { state, requestedBrowsers: requested, executedBrowsers: executed, unavailableBrowsers: unavailable, pagesCompared: new Set(sources.browserExecutions.map((item) => `${item.pageUrl}|${item.viewport.width}x${item.viewport.height}`)).size, differences, byBrowser: Object.fromEntries(requested.map((browser) => [browser, issuesFor('performance-compatibility').filter((issue) => issue.message.includes(browser)).length])), ...(state === 'CONSISTENT' ? { note: 'No differences detected in tested contexts' } : {}) };
  }
  if (selected('custom-checks')) {
    const results = sources.customResults.slice(0, MAX_CUSTOM_RESULTS);
    result.customChecks = {
      checksExecuted: sources.customResults.length,
      passed: sources.customResults.filter((item) => item.status === 'PASS').length,
      failed: sources.customResults.filter((item) => item.status === 'FAIL').length,
      skipped: sources.customResults.filter((item) => item.status === 'SKIPPED').length,
      errors: sources.customResults.filter((item) => item.status === 'ERROR').length,
      checks: sources.customCheckSnapshots.map((check) => ({ id: check.id, name: clampText(check.name, 120), version: check.version, results: sources.customResults.filter((item) => item.customCheckId === check.id).length })),
      results: results.map((item) => {
        const check = sources.customCheckSnapshots.find((candidate) => candidate.id === item.customCheckId);
        return {
          checkId: item.customCheckId,
          name: clampText(check?.name ?? item.customCheckId, 120),
          version: check?.version ?? 0,
          status: item.status,
          pageUrl: safeReportUrl(item.pageUrl),
          ...(item.expected !== undefined ? { expected: redactReportValue(item.expected) } : {}),
          ...(item.actual !== undefined ? { actual: redactReportValue(item.actual) } : {}),
          message: clampText(redactReportValue(item.message) ?? ''),
        };
      }),
      topFailures: results.filter((item) => item.status === 'FAIL').slice(0, 20).map((item) => ({ checkId: item.customCheckId, message: redactReportValue(item.message) ?? '', pageUrl: safeReportUrl(item.pageUrl) })),
    };
  }
  return result;
}

export class ReportBuilder {
  build(input: ReportBuilderInput): ReportSnapshot {
    const sources = input.sources;
    const options = normalizedOptions(input.options);
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const target = safeReportUrl(sources.scan.target?.requestedUrl ?? sources.scan.requestedUrls[0] ?? 'Target unavailable');
    const host = (() => { try { return new URL(target).hostname; } catch { return target; } })();
    const title = clampText(input.options?.title?.trim() || `VisionQA Scan Report — ${host}`, 160);
    const filteredIssues = reportIssues(sources, options);
    const evidenceReferences = options.includeEvidenceReferences ? sources.evidence.slice(0, MAX_EVIDENCE).map((item) => ({ evidenceId: item.id, type: item.type, ...(item.pageUrl ? { page: safeReportUrl(item.pageUrl) } : {}), ...(item.browser ? { browser: item.browser } : {}), ...(item.viewport ? { viewport: item.viewport } : {}) })) : [];
    const selected = selectedModules(sources);
    const moduleData = moduleSnapshots(sources);
    const summarySnapshot = {
      target,
      scanType: sources.scan.type,
      triggerSource: sources.scan.triggerSource === 'SCHEDULE' ? 'SCHEDULED' as const : 'MANUAL' as const,
      scope: sources.scan.scope,
      ...(sources.scan.startedAt ? { startedAt: sources.scan.startedAt } : {}),
      ...(sources.scan.completedAt ? { completedAt: sources.scan.completedAt } : {}),
      durationMs: durationMs(sources.scan.startedAt, sources.scan.completedAt),
      pagesAnalyzed: sources.browserExecutions.length ? new Set(sources.browserExecutions.map((item) => item.pageUrl)).size : sources.crawlSummary.pagesFetched,
      modulesRun: selected.length,
      issueCounts: issueCounts(sources.issues),
      partialModules: moduleData.filter((item) => ['PARTIAL', 'FAILED', 'UNAVAILABLE', 'CANCELLED'].includes(item.status)).map((item) => item.module),
      scanStatus: sources.scan.status,
    };
    const metadata = {
      projectName: clampText(sources.projectName, 160),
      reportTitle: title,
      timezone: input.timezone ?? 'UTC',
      options,
      ...(sources.scan.scheduleId ? { schedule: { id: sources.scan.scheduleId, ...(input.scheduleName ? { name: clampText(input.scheduleName, 160) } : {}) } } : {}),
      truncated: { issues: filteredIssues.length < sources.issues.length, evidence: options.includeEvidenceReferences && evidenceReferences.length < sources.evidence.length, issueTotal: sources.issues.length, evidenceTotal: sources.evidence.length },
      generatedAt,
    };
    const content = {
      title,
      formatAvailability: { html: true as const, pdf: false as const },
      summarySnapshot,
      moduleSnapshots: options.includeModules ? moduleData : [],
      issueSnapshot: options.includeIssues ? filteredIssues : [],
      sections: sections(sources, evidenceReferences),
      evidenceReferences,
      metadata,
    };
    const serialized = JSON.stringify(content);
    if (serialized.length > MAX_REPORT_SNAPSHOT_BYTES) throw new Error('REPORT_SNAPSHOT_TOO_LARGE');
    const snapshotHash = createHash('sha256').update(serialized).digest('hex');
    return { ...content, snapshotHash };
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function renderReportHtml(report: ReportSnapshot & { id: string; projectId: string; scanId: string; reportVersion: number; generatedAt: string }): string {
  const rows = report.issueSnapshot.map((issue) => `<tr><td>${escapeHtml(issue.severity.toUpperCase())}</td><td>${escapeHtml(issue.title)}<br><small>${escapeHtml(issue.description)}</small></td><td>${escapeHtml(issue.module)}</td><td class="url">${escapeHtml(issue.pageUrl)}</td><td>${escapeHtml(issue.status)}</td><td>${issue.occurrenceCount}</td></tr>`).join('');
  const modules = report.moduleSnapshots.map((module) => `<tr><td>${escapeHtml(module.module)}</td><td>${escapeHtml(module.status)}</td><td>${module.checks.map(escapeHtml).join(', ')}</td><td>${module.coverage.pagesAnalyzed}</td><td>${module.findingCount}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>@page{margin:18mm}body{font:14px Arial,sans-serif;color:#32133f}h1,h2{break-after:avoid}table{border-collapse:collapse;width:100%;margin:12px 0 24px}th,td{border:1px solid #decfe3;padding:7px;text-align:left;vertical-align:top}th{background:#f3e8f5}.url{overflow-wrap:anywhere}tr{break-inside:avoid}.muted{color:#76527f}@media print{.no-print{display:none}}</style></head><body><main><header><p class="muted">VisionQA · ${escapeHtml(report.metadata.projectName)}</p><h1>${escapeHtml(report.title)}</h1><p>${escapeHtml(report.summarySnapshot.target)} · ${escapeHtml(report.summarySnapshot.scanStatus.toUpperCase())} · ${escapeHtml(report.summarySnapshot.triggerSource)}</p><p class="muted">Generated ${escapeHtml(report.generatedAt)}</p></header><section><h2>Executive Summary</h2><p>Pages analyzed: <b>${report.summarySnapshot.pagesAnalyzed}</b> · Modules run: <b>${report.summarySnapshot.modulesRun}</b> · Issues: <b>${report.metadata.truncated.issueTotal}</b></p><p>${severityOrder.map((severity) => `${escapeHtml(severity)}: ${report.summarySnapshot.issueCounts[severity]}`).join(' · ')}</p></section><section><h2>Module Coverage</h2><table><thead><tr><th>Module</th><th>Status</th><th>Checks</th><th>Pages</th><th>Findings</th></tr></thead><tbody>${modules || '<tr><td colspan="5">No module details selected.</td></tr>'}</tbody></table></section><section><h2>Issues</h2>${report.metadata.truncated.issues ? `<p>Showing first ${report.issueSnapshot.length} of ${report.metadata.truncated.issueTotal} findings.</p>` : ''}<table><thead><tr><th>Severity</th><th>Issue</th><th>Module</th><th>Page</th><th>Status</th><th>Occurrences</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No findings included.</td></tr>'}</tbody></table></section><section><h2>Scan Metadata</h2><dl><dt>Scan ID</dt><dd>${escapeHtml(report.scanId)}</dd><dt>Report version</dt><dd>${report.reportVersion}</dd><dt>Scope</dt><dd>${escapeHtml(report.summarySnapshot.scope)}</dd></dl></section></main></body></html>`;
}
