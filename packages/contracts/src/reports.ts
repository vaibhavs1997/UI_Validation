import type {
  BrowserFact,
  BrowserPageExecution,
  CrawlPage,
  CrawlSummary,
  CustomCheckResult,
  CustomCheckSnapshot,
  Evidence,
  Issue,
  IssueSeverity,
  ResourceReference,
  Scan,
  Severity,
} from './index.js';

export type ReportStatus = 'READY' | 'FAILED';
export type ReportIssueFilter = 'ALL' | 'OPEN_ONLY';

export interface ReportOptions {
  title?: string;
  includeExecutiveSummary?: boolean;
  includeModules?: boolean;
  includeIssues?: boolean;
  includeEvidenceReferences?: boolean;
  includePassedChecks?: boolean;
  includeTechnicalDetails?: boolean;
  issueFilter?: ReportIssueFilter;
  severityMinimum?: IssueSeverity;
}

export interface ReportFormatAvailability {
  html: true;
  pdf: false;
}

export interface ReportIssueSnapshot {
  issueId: string;
  detectorId: string;
  module: string;
  title: string;
  severity: IssueSeverity;
  status: Issue['status'];
  pageUrl: string;
  browser?: string;
  viewport?: { width: number; height: number };
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  description: string;
  expected?: string | number | boolean | null;
  actual?: string | number | boolean | null;
}

export interface ReportModuleSnapshot {
  module: string;
  status: string;
  checks: string[];
  coverage: {
    pagesAnalyzed: number;
    executionsCompleted: number;
    executionsFailed: number;
    unavailableBrowsers: string[];
  };
  findingCount: number;
  summary: Record<string, unknown>;
}

export interface ReportSummarySnapshot {
  target: string;
  scanType: Scan['type'];
  triggerSource: 'MANUAL' | 'SCHEDULED';
  scope: Scan['scope'];
  startedAt?: string;
  completedAt?: string;
  durationMs: number | null;
  pagesAnalyzed: number;
  modulesRun: number;
  issueCounts: Record<Severity, number>;
  partialModules: string[];
  scanStatus: Scan['status'];
}

export interface ReportCrawlSection {
  pagesDiscovered: number;
  pagesFetched: number;
  failedOrSkippedPages: number;
  robots: { available: boolean; summary?: Record<string, unknown> };
  sitemap: { available: boolean; urlCount?: number };
  comparison?: { matched: number; crawlOnly: number; sitemapOnly: number };
}

export interface ReportLinksSection {
  checked: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  brokenInternal: number;
  brokenExternal: number;
  redirectIssues: number;
  failedResourceTypes: Record<string, number>;
}

export interface ReportVisualSection {
  pagesAnalyzed: number;
  viewports: Array<{ width: number; height: number }>;
  findingCount: number;
  byDetector: Record<string, number>;
  topAffectedPages: Array<{ pageUrl: string; findings: number }>;
  evidenceReferences: ReportEvidenceReference[];
}

export interface ReportInteractionsSection {
  controlsAnalyzed: number | null;
  coveredControls: number | null;
  failedControls: number | null;
  noOpControls: number | null;
  formValidationFindings: number;
  safetySkippedActions: number | null;
}

export interface ReportBrowserNetworkSection {
  consoleErrors: number;
  pageErrors: number;
  failedRequests: number;
  httpErrors: number;
  pagesExecuted: number;
  uniquePages: number;
  browserCoverage: Record<string, number>;
}

export interface ReportAccessibilitySection {
  findingsByDetector: Record<string, number>;
  findingsBySeverity: Record<Severity, number>;
  pagesAffected: number;
  selectedChecks: string[];
  note: 'Automated accessibility findings';
}

export interface ReportSeoSection {
  findingsByDetector: Record<string, number>;
  pagesAffected: number;
  indexability: Record<string, number>;
}

export interface ReportPerformanceSection {
  pagesAnalyzed: number;
  ttfbMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  loadMs: number | null;
  requests: number | null;
  transferBytes: number | null;
  slowResources: number;
  largeResources: number;
}

export interface ReportCompatibilitySection {
  state: string;
  requestedBrowsers: string[];
  executedBrowsers: string[];
  unavailableBrowsers: string[];
  pagesCompared: number;
  differences: number;
  byBrowser: Record<string, number>;
  note?: string;
}

export interface ReportCustomCheckSection {
  checksExecuted: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  checks: Array<{ id: string; name: string; version: number; results: number }>;
  results: Array<{
    checkId: string;
    name: string;
    version: number;
    status: string;
    pageUrl: string;
    expected?: string | number | boolean | null | undefined;
    actual?: string | number | boolean | null | undefined;
    message: string;
  }>;
  topFailures: Array<{ checkId: string; message: string; pageUrl: string }>;
}

export interface ReportEvidenceReference {
  evidenceId: string;
  type: Evidence['type'];
  page?: string;
  browser?: string;
  viewport?: { width: number; height: number };
}

export interface ReportSections {
  crawl?: ReportCrawlSection;
  links?: ReportLinksSection;
  visual?: ReportVisualSection;
  interactions?: ReportInteractionsSection;
  browserNetwork?: ReportBrowserNetworkSection;
  accessibility?: ReportAccessibilitySection;
  seo?: ReportSeoSection;
  performance?: ReportPerformanceSection;
  compatibility?: ReportCompatibilitySection;
  customChecks?: ReportCustomCheckSection;
}

export interface ReportMetadata {
  projectName: string;
  reportTitle: string;
  timezone: string;
  generatedAt: string;
  options: Required<
    Pick<
      ReportOptions,
      | 'includeExecutiveSummary'
      | 'includeModules'
      | 'includeIssues'
      | 'includeEvidenceReferences'
      | 'includePassedChecks'
      | 'includeTechnicalDetails'
      | 'issueFilter'
    >
  > & Pick<ReportOptions, 'severityMinimum'>;
  schedule?: { id: string; name?: string };
  truncated: {
    issues: boolean;
    evidence: boolean;
    issueTotal: number;
    evidenceTotal: number;
  };
}

export interface Report {
  id: string;
  projectId: string;
  scanId: string;
  title: string;
  status: ReportStatus;
  reportVersion: number;
  generatedAt: string;
  generatedBy?: string;
  formatAvailability: ReportFormatAvailability;
  summarySnapshot: ReportSummarySnapshot;
  moduleSnapshots: ReportModuleSnapshot[];
  issueSnapshot: ReportIssueSnapshot[];
  sections: ReportSections;
  evidenceReferences: ReportEvidenceReference[];
  metadata: ReportMetadata;
  snapshotHash: string;
  createdAt: string;
  updatedAt: string;
  failureMessage?: string;
}

export type ReportRepositoryInput = Omit<
  Report,
  'id' | 'createdAt' | 'updatedAt'
> & { id?: string };

export interface ReportListOptions {
  scanId?: string;
  status?: ReportStatus;
  limit?: number;
  cursor?: string;
}

export interface ReportBuilderSources {
  projectName: string;
  scan: Scan;
  issues: Issue[];
  crawlPages: CrawlPage[];
  crawlSummary: CrawlSummary;
  resources: ResourceReference[];
  browserExecutions: BrowserPageExecution[];
  browserFacts: BrowserFact[];
  evidence: Evidence[];
  customResults: CustomCheckResult[];
  customCheckSnapshots: CustomCheckSnapshot[];
  robots?: Record<string, unknown> | null;
  sitemapUrls?: string[];
  comparison?: { matched: string[]; crawlOnly: string[]; sitemapOnly: string[] };
}

export interface ReportBuilderInput {
  sources: ReportBuilderSources;
  options?: ReportOptions;
  generatedAt?: string;
  timezone?: string;
  scheduleName?: string;
}

export type ReportSnapshot = Pick<
  Report,
  | 'title'
  | 'formatAvailability'
  | 'summarySnapshot'
  | 'moduleSnapshots'
  | 'issueSnapshot'
  | 'sections'
  | 'evidenceReferences'
  | 'metadata'
  | 'snapshotHash'
>;
