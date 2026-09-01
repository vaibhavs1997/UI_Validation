export const qaModules = [
  'crawl-site-structure',
  'links-resources',
  'visual-responsive',
  'interactions-forms',
  'browser-network',
  'accessibility-seo',
  'performance-compatibility',
  'custom-checks',
  'full-scan',
] as const;
export const fullScanModules = qaModules.filter(
  (module): module is Exclude<QaModule, 'full-scan'> => module !== 'full-scan',
);
export type QaModule = (typeof qaModules)[number];
export type FullScanModuleId = Exclude<QaModule, 'full-scan'>;
export type ScanStatus =
  'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
export type ScanType = 'module' | 'full';
export type ScanScope = 'single-page' | 'start-url' | 'path' | 'site';
export interface ScanTarget {
  requestedUrl: string;
  normalizedUrl: string;
  origin: string;
  protocol: 'http' | 'https';
  hostname: string;
  port?: number | null;
  finalUrl?: string | null;
  safeDisplayUrl?: string;
}
export { createScanTarget } from './scan-target.js';
export {
  LegacyScanTargetError,
  resolveScanTarget,
} from './scan-target-resolver.js';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'open' | 'acknowledged' | 'resolved' | 'ignored';
export type BrowserType = 'chromium' | 'firefox' | 'webkit';
export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}
export type ModuleExecutionStatus =
  | 'NOT_SELECTED'
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNAVAILABLE';
export type CheckExecutionStatus =
  'REQUESTED' | 'EXECUTED' | 'SKIPPED' | 'UNAVAILABLE' | 'FAILED';
export type CapabilityExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNAVAILABLE';
export function deriveFullScanStatus(
  states: Record<string, CapabilityExecutionStatus>,
): { status: ScanStatus; allTerminal: boolean } {
  const values = Object.values(states);
  const terminal = values.every((value) =>
    ['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', 'UNAVAILABLE'].includes(
      value,
    ),
  );
  if (!terminal) return { status: 'running', allTerminal: false };
  if (values.includes('CANCELLED'))
    return { status: 'cancelled', allTerminal: true };
  if (values.includes('PARTIAL') || values.includes('UNAVAILABLE'))
    return { status: 'partial', allTerminal: true };
  if (values.includes('FAILED')) return { status: 'failed', allTerminal: true };
  return { status: 'completed', allTerminal: true };
}
export interface ScanProgress {
  completed: number;
  total: number;
  percent: number;
  discovered?: number;
  processed?: number;
  pending?: number;
  failed?: number;
  stage?: 'DISCOVERY' | 'HTTP_ANALYSIS' | 'BROWSER_ANALYSIS' | 'AGGREGATION';
  overallPercent?: number;
}
export interface ScanOptions {
  maxPages?: number;
  maxDepth?: number;
  sameOriginOnly?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  requestTimeoutMs?: number;
  concurrency?: number;
  maxExternalLinks?: number;
  maxHttpResources?: number;
  maxBrowserPages?: number;
  maxCustomChecks?: number;
  maxTotalBrowserExecutions?: number;
  captureEvidence?: boolean;
}
export interface FullScanModule {
  module: FullScanModuleId;
  checks: string[];
}
export interface FullScanRequest {
  projectId: string;
  target: Pick<ScanTarget, 'requestedUrl' | 'normalizedUrl'>;
  scope: ScanScope;
  modules: FullScanModule[];
  browsers?: BrowserType[];
  viewports?: Viewport[];
  options?: ScanOptions;
  customCheckIds?: string[];
}
export interface ScanPageTarget {
  url: string;
  normalizedUrl: string;
  discoveredFrom?: string;
  depth?: number;
  crawlPageId?: string;
  source: 'target' | 'crawl' | 'sitemap';
}
export interface FullScanCapabilityTask {
  key: string;
  capability: 'crawl' | 'http' | 'browser';
  checks: string[];
  modules: FullScanModuleId[];
  browsers?: BrowserType[];
  viewports?: Viewport[];
  dependsOn?: string[];
  status: CapabilityExecutionStatus;
  completedUnits: number;
  totalUnits?: number;
}
export interface FullScanModuleState {
  module: FullScanModuleId;
  status: ModuleExecutionStatus;
  checks: Record<string, CheckExecutionStatus>;
  completedUnits: number;
  totalUnits?: number;
  percent: number;
  message?: string;
}
export interface FullScanExecutionPlan {
  planVersion: 'full-scan-1';
  detectorCatalogVersion: string;
  target: ScanTarget;
  scope: ScanScope;
  modules: FullScanModule[];
  browsers: BrowserType[];
  viewports: Viewport[];
  customCheckSnapshots: CustomCheckSnapshot[];
  options: ScanOptions;
  capabilities: Array<'crawl' | 'http' | 'browser'>;
  tasks: FullScanCapabilityTask[];
  createdAt: string;
}
export interface FullScanProgress {
  overallPercent: number;
  stage?: 'DISCOVERY' | 'HTTP_ANALYSIS' | 'BROWSER_ANALYSIS' | 'AGGREGATION';
  modules: Record<
    FullScanModuleId,
    Pick<
      FullScanModuleState,
      'status' | 'completedUnits' | 'totalUnits' | 'percent'
    >
  >;
  completedUnits: number;
  totalUnits: number;
  pages: { discovered: number; analyzed: number };
  pagesEligibleForBrowser?: number;
  browserExecutionsPlanned?: number;
  browserExecutionsCompleted?: number;
  browserExecutionsFailed?: number;
}
export interface FullScanSummary {
  scan: Pick<
    Scan,
    | 'id'
    | 'status'
    | 'target'
    | 'scope'
    | 'createdAt'
    | 'startedAt'
    | 'completedAt'
  >;
  pages: {
    discovered: number;
    analyzed: number;
    eligibleForBrowser?: number;
  };
  browserExecutions: {
    planned: number;
    completed: number;
    failed: number;
  };
  issues: { total: number; bySeverity: Record<Severity, number> };
  modules: {
    selected: number;
    completed: number;
    partial: number;
    failed: number;
    summaries: Record<string, unknown>;
  };
}
export interface CreateScanRequest {
  url: string;
  scope?: ScanScope;
  environmentId?: string;
  module: QaModule;
  checks?: string[];
  customCheckIds?: string[];
  modules?: FullScanModule[];
  requestedUrls?: string[];
  browsers?: BrowserType[];
  viewports?: Viewport[];
  options?: ScanOptions;
  triggerSource?: 'MANUAL' | 'SCHEDULE';
  scheduleId?: string;
  scheduleRunId?: string;
  idempotencyKey?: string;
}
export interface Scan {
  id: string;
  projectId: string;
  environmentId?: string;
  createdBy: string;
  target?: ScanTarget;
  scope: ScanScope;
  type: ScanType;
  module: QaModule;
  checks: string[];
  customCheckIds?: string[] | undefined;
  customCheckSnapshots?: CustomCheckSnapshot[] | undefined;
  triggerSource?: 'MANUAL' | 'SCHEDULE' | undefined;
  scheduleId?: string | undefined;
  scheduleRunId?: string | undefined;
  idempotencyKey?: string | undefined;
  modules?: FullScanModule[] | undefined;
  executionPlan?: FullScanExecutionPlan | undefined;
  moduleStates?:
    Partial<Record<FullScanModuleId, FullScanModuleState>> | undefined;
  capabilityStates?: Record<string, CapabilityExecutionStatus> | undefined;
  checkStates?: Record<string, CheckExecutionStatus> | undefined;
  fullScanProgress?: FullScanProgress | undefined;
  browserPageTargets?: ScanPageTarget[] | undefined;
  requestedUrls: string[];
  viewports: Viewport[];
  browsers: BrowserType[];
  options: ScanOptions;
  status: ScanStatus;
  progress: ScanProgress;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  cancelledAt?: string | undefined;
  cancellationRequestedAt?: string | undefined;
  failureCode?: string | undefined;
  failureMessage?: string | undefined;
}
export interface ScanSummary {
  id: string;
  projectId: string;
  environmentId?: string;
  target?: ScanTarget;
  scope: ScanScope;
  module: QaModule;
  checks: string[];
  status: ScanStatus;
  progress: ScanProgress;
  createdAt: string;
}
export interface ScanProgressResponse {
  scanId: string;
  status: ScanStatus;
  progress: ScanProgress;
}
export type CrawlStatus = 'DISCOVERED' | 'FETCHED' | 'FAILED' | 'SKIPPED';
export interface CrawlPage {
  id: string;
  scanId: string;
  projectId: string;
  url: string;
  normalizedUrl: string;
  depth: number;
  statusCode?: number;
  contentType?: string;
  title?: string;
  sourceUrl?: string;
  redirectChain: string[];
  discoveredAt: string;
  fetchedAt?: string;
  durationMs?: number;
  crawlStatus: CrawlStatus;
  failureCode?: string;
  failureMessage?: string;
}
export interface CrawlSummary {
  pagesDiscovered: number;
  pagesFetched: number;
  pagesFailed: number;
  maxDepthReached: number;
  durationMs: number;
}
export type ResourceType =
  'LINK' | 'IMAGE' | 'SCRIPT' | 'STYLESHEET' | 'FONT' | 'MEDIA';
export type ResourceStatus =
  'OK' | 'BROKEN' | 'REDIRECTED' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
export interface ResourceReference {
  id: string;
  scanId: string;
  projectId: string;
  sourcePageId?: string;
  sourceUrl: string;
  targetUrl: string;
  normalizedTargetUrl: string;
  resourceType: ResourceType;
  relationship: string;
  isInternal: boolean;
  discoveredAt: string;
  status?: ResourceStatus;
  finalUrl?: string;
  statusCode?: number;
  redirectChain: string[];
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  contentType?: string;
}
export type IssueSeverity = Severity;
export type IssueStatus =
  'OPEN' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'IGNORED' | 'FIXED' | 'REOPENED';
export interface Issue {
  id: string;
  projectId: string;
  detectorId: string;
  module: QaModule;
  severity: IssueSeverity;
  status: IssueStatus;
  title: string;
  message: string;
  fingerprint: string;
  primaryUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  createdAt: string;
  updatedAt: string;
  scanIds?: string[];
}
export interface IssueOccurrence {
  id: string;
  issueId: string;
  projectId: string;
  scanId: string;
  pageId?: string;
  sourceUrl?: string;
  targetUrl?: string;
  evidence: Record<string, unknown>;
  detectedAt: string;
}
export type BrowserExecutionStatus =
  'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'UNAVAILABLE';
export type CoverageStatus =
  'COVERED' | 'FAILED' | 'CANCELLED' | 'UNAVAILABLE' | 'NOT_EXECUTED';
export interface FullScanCoverageRecord {
  detectorId: string;
  normalizedPageUrl: string;
  status: CoverageStatus;
  browser?: BrowserType;
  viewport?: Viewport;
  customCheckId?: string;
  customCheckVersion?: number;
  executionId?: string;
}
export interface CoverageIssueIdentity {
  detectorId: string;
  pageUrl: string;
  browser?: BrowserType;
  viewport?: Viewport;
  customCheckId?: string;
  customCheckVersion?: number;
}
export function coverageCanReconcile(
  issue: CoverageIssueIdentity,
  coverage: FullScanCoverageRecord,
): boolean {
  if (coverage.status !== 'COVERED' || issue.detectorId !== coverage.detectorId)
    return false;
  const canonical = (value: string): string => {
    try {
      const url = new URL(value);
      url.hash = '';
      return url.toString();
    } catch {
      return value;
    }
  };
  return (
    canonical(issue.pageUrl) === coverage.normalizedPageUrl &&
    (!issue.browser || issue.browser === coverage.browser) &&
    (!issue.viewport ||
      (coverage.viewport?.width === issue.viewport.width &&
        coverage.viewport?.height === issue.viewport.height)) &&
    (!issue.customCheckId || issue.customCheckId === coverage.customCheckId) &&
    (!issue.customCheckVersion ||
      issue.customCheckVersion === coverage.customCheckVersion)
  );
}
export interface BrowserFact {
  id: string;
  scanId: string;
  executionId: string;
  kind:
    | 'CONSOLE'
    | 'PAGE_ERROR'
    | 'REQUEST'
    | 'RESPONSE'
    | 'FAILED_REQUEST'
    | 'NETWORK_POLICY_BLOCKED';
  type?: string;
  url?: string;
  resourceType?: string;
  status?: number;
  message?: string;
  source?: string;
  timestamp: string;
}
export interface PerformanceSnapshot {
  pageUrl: string;
  browser: BrowserType;
  viewport: Viewport;
  navigation: {
    ttfbMs: number | null;
    domContentLoadedMs: number | null;
    loadMs: number | null;
  };
  webVitals: { fcpMs: number | null; lcpMs: number | null; cls: number | null };
  network: {
    requestCount: number;
    failedRequestCount: number;
    transferredBytes: number | null;
    encodedBytes: number | null;
  };
  resources: Array<{
    url: string;
    type: string;
    durationMs: number | null;
    transferSize: number | null;
    encodedBodySize: number | null;
    status: number | null;
    initiatorType: string | null;
    renderBlocking: boolean;
  }>;
  browserVersion?: string;
}
export interface BrowserPageExecution {
  id: string;
  scanId: string;
  projectId: string;
  pageUrl: string;
  pageTargetId?: string;
  taskKey?: string;
  browser: BrowserType;
  viewport: Viewport;
  status: BrowserExecutionStatus;
  finalUrl?: string;
  httpStatus?: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  consoleErrorCount: number;
  pageErrorCount: number;
  failedRequestCount: number;
  screenshotEvidenceId?: string;
  performance?: PerformanceSnapshot | undefined;
  visualSignals?:
    { horizontalOverflow: boolean; fixedObstruction: boolean } | undefined;
}
export type BrowserAvailabilityState =
  'REQUESTED' | 'AVAILABLE' | 'EXECUTED' | 'FAILED' | 'UNAVAILABLE';
export interface BrowserAvailability {
  browser: BrowserType;
  availability: BrowserAvailabilityState;
  reasonCode?: string;
  version?: string;
}
export type CompatibilityState =
  | 'NOT_RUN'
  | 'NOT_COMPARED'
  | 'CONSISTENT'
  | 'DIFFERENCES_FOUND'
  | 'PARTIAL'
  | 'FAILED';
export interface CompatibilityFinding {
  detectorId:
    | 'browser-console-differences'
    | 'browser-request-differences'
    | 'browser-render-differences'
    | 'browser-feature-failures';
  pageUrl: string;
  viewport: Viewport;
  affectedBrowser: BrowserType;
  comparisonBrowsers: BrowserType[];
  differenceType: string;
  normalizedSignature: string;
  severity: Severity;
  title: string;
  message: string;
  fingerprint: string;
  evidenceIds?: string[];
}
export interface CompatibilitySummary {
  state: CompatibilityState;
  requestedBrowsers: BrowserType[];
  executedBrowsers: BrowserType[];
  unavailableBrowsers: BrowserType[];
  pagesCompared: number;
  differences: number;
  byDetector: Record<string, number>;
  byBrowser: Record<string, number>;
}
export type EvidenceType =
  | 'SCREENSHOT'
  | 'VISUAL_ANNOTATION'
  | 'DOM_SNAPSHOT'
  | 'NETWORK'
  | 'CONSOLE'
  | 'OTHER';
export interface Evidence {
  id: string;
  projectId: string;
  scanId?: string;
  executionId?: string;
  type: EvidenceType;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  browser?: BrowserType;
  viewport?: Viewport;
  pageUrl?: string;
  createdAt: string;
  metadata?: Record<string, string | number | boolean>;
}
export interface VisualRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface VisualElement {
  ref: string;
  tagName: string;
  textPreview: string;
  role?: string;
  selector: string;
  rect: VisualRect;
  display: string;
  visibility: string;
  position: string;
  overflow: string;
  overflowX?: string;
  overflowY?: string;
  zIndex: string;
  fontSize: string;
  lineHeight: string;
  whiteSpace: string;
  interactive: boolean;
  clientWidth?: number;
  clientHeight?: number;
  scrollWidth?: number;
  scrollHeight?: number;
  lineClamp?: string;
  textOverflow?: string;
  paintedAboveRefs?: string[];
}
export interface VisualPageSnapshot {
  scanId: string;
  executionId: string;
  pageUrl: string;
  browser: BrowserType;
  viewport: Viewport;
  documentWidth: number;
  documentHeight: number;
  elements: VisualElement[];
  capturedAt: string;
}
export interface VisualFinding {
  id: string;
  scanId: string;
  executionId: string;
  detectorId: string;
  pageUrl: string;
  browser: BrowserType;
  viewport: Viewport;
  severity: Severity;
  title: string;
  message: string;
  fingerprint: string;
  elements: Array<{ ref: string; selector: string; rect: VisualRect }>;
  annotatedEvidenceId?: string;
}
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}
export interface AuthResponse {
  user: AuthUser;
}
export interface CreateSessionRequest {
  idToken: string;
}
export type AuthSessionResponse = AuthResponse;
export type CurrentUserResponse = AuthResponse;
export type EnvironmentType =
  'production' | 'staging' | 'qa' | 'development' | 'custom';
export interface Environment {
  id: string;
  projectId?: string;
  name: string;
  type: EnvironmentType;
  baseUrl: string;
  isDefault: boolean;
}
export interface Project {
  id: string;
  name: string;
  baseUrl?: string;
  createdBy: string;
  organizationId: string | null;
  environments: Environment[];
}
export interface CreateProjectRequest {
  name: string;
  baseUrl?: string;
  environmentName?: string;
  environmentType?: EnvironmentType;
}
export interface UpdateProjectRequest {
  name?: string;
  baseUrl?: string;
}
export interface ProjectResponse {
  project: Project;
}
export interface ProjectsResponse {
  projects: Project[];
}
export type CustomCheckTargetType =
  | 'DOM'
  | 'TEXT'
  | 'ATTRIBUTE'
  | 'HTTP'
  | 'METADATA'
  | 'BROWSER'
  | 'PERFORMANCE';
export type CustomCheckOperator =
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'GREATER_THAN'
  | 'GREATER_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_OR_EQUAL'
  | 'COUNT_EQUALS'
  | 'COUNT_GREATER_THAN'
  | 'COUNT_LESS_THAN'
  | 'VISIBLE'
  | 'HIDDEN'
  | 'ENABLED'
  | 'DISABLED';
export type CustomCheckExpected = string | number | boolean;
export interface CustomCheckDefinition {
  targetType: CustomCheckTargetType;
  source: string;
  selector?: string;
  property?: string;
  operator: CustomCheckOperator;
  expected?: CustomCheckExpected;
  options?: { caseSensitive?: boolean };
}
export interface CustomCheck {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  enabled: boolean;
  definition: CustomCheckDefinition;
  severity: Severity;
  version: number;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}
export interface CustomCheckSnapshot {
  id: string;
  name: string;
  definition: CustomCheckDefinition;
  severity: Severity;
  version: number;
}
export interface CreateCustomCheckRequest {
  name: string;
  description?: string;
  enabled?: boolean;
  definition: CustomCheckDefinition;
  severity: Severity;
}
export type UpdateCustomCheckRequest = Partial<CreateCustomCheckRequest>;
export type CustomCheckResultStatus = 'PASS' | 'FAIL' | 'SKIPPED' | 'ERROR';
export interface CustomCheckResult {
  id?: string;
  customCheckId: string;
  scanId: string;
  pageUrl: string;
  status: CustomCheckResultStatus;
  actual?: CustomCheckExpected | null | undefined;
  expected?: CustomCheckExpected | null | undefined;
  message: string;
  browser?: BrowserType | undefined;
  viewport?: Viewport | undefined;
  elementRef?: string | undefined;
  evidenceId?: string | undefined;
  evaluatedAt: string;
}
export interface CustomCheckSummary {
  checksExecuted: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  pagesChecked: number;
  findings: number;
  byCheck: Record<
    string,
    { passed: number; failed: number; skipped: number; errors: number }
  >;
}
export interface CreateEnvironmentRequest {
  name: string;
  type: EnvironmentType;
  baseUrl: string;
  isDefault?: boolean;
}
export interface UpdateEnvironmentRequest {
  name?: string;
  type?: EnvironmentType;
  baseUrl?: string;
  isDefault?: boolean;
}
export interface EnvironmentResponse {
  environment: Environment;
}
export interface EnvironmentsResponse {
  environments: Environment[];
}
export * from './schedules.js';
export * from './reports.js';
