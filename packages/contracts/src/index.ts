export const qaModules = ['crawl-site-structure', 'links-resources', 'visual-responsive', 'interactions-forms', 'browser-network', 'accessibility-seo', 'performance-compatibility', 'custom-checks', 'full-scan'] as const;
export type QaModule = typeof qaModules[number];
export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ScanType = 'module' | 'full';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'open' | 'acknowledged' | 'resolved' | 'ignored';
export type BrowserType = 'chromium' | 'firefox' | 'webkit';
export interface Viewport { width: number; height: number; deviceScaleFactor?: number }
export interface ScanProgress { completed: number; total: number; percent: number; discovered?: number; processed?: number; pending?: number; failed?: number }
export interface ScanOptions { maxPages?: number; maxDepth?: number; sameOriginOnly?: boolean; includePatterns?: string[]; excludePatterns?: string[]; requestTimeoutMs?: number; concurrency?: number; maxExternalLinks?: number; captureEvidence?: boolean }
export interface FullScanModule { module: Exclude<QaModule, 'full-scan'>; checks: string[] }
export interface CreateScanRequest { environmentId: string; module: QaModule; checks?: string[]; modules?: FullScanModule[]; requestedUrls?: string[]; browsers?: BrowserType[]; viewports?: Viewport[]; options?: ScanOptions }
export interface Scan { id: string; projectId: string; environmentId: string; createdBy: string; type: ScanType; module: QaModule; checks: string[]; modules?: FullScanModule[] | undefined; requestedUrls: string[]; viewports: Viewport[]; browsers: BrowserType[]; options: ScanOptions; status: ScanStatus; progress: ScanProgress; createdAt: string; updatedAt: string; startedAt?: string | undefined; completedAt?: string | undefined; cancelledAt?: string | undefined; cancellationRequestedAt?: string | undefined; failureCode?: string | undefined; failureMessage?: string | undefined }
export interface ScanSummary { id: string; projectId: string; environmentId: string; module: QaModule; checks: string[]; status: ScanStatus; progress: ScanProgress; createdAt: string }
export interface ScanProgressResponse { scanId: string; status: ScanStatus; progress: ScanProgress }
export type CrawlStatus = 'DISCOVERED' | 'FETCHED' | 'FAILED' | 'SKIPPED';
export interface CrawlPage { id: string; scanId: string; projectId: string; url: string; normalizedUrl: string; depth: number; statusCode?: number; contentType?: string; title?: string; sourceUrl?: string; redirectChain: string[]; discoveredAt: string; fetchedAt?: string; durationMs?: number; crawlStatus: CrawlStatus; failureCode?: string; failureMessage?: string }
export interface CrawlSummary { pagesDiscovered: number; pagesFetched: number; pagesFailed: number; maxDepthReached: number; durationMs: number }
export type ResourceType = 'LINK' | 'IMAGE' | 'SCRIPT' | 'STYLESHEET' | 'FONT' | 'MEDIA';
export type ResourceStatus = 'OK' | 'BROKEN' | 'REDIRECTED' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
export interface ResourceReference { id: string; scanId: string; projectId: string; sourcePageId?: string; sourceUrl: string; targetUrl: string; normalizedTargetUrl: string; resourceType: ResourceType; relationship: string; isInternal: boolean; discoveredAt: string; status?: ResourceStatus; finalUrl?: string; statusCode?: number; redirectChain: string[]; durationMs?: number; errorCode?: string; errorMessage?: string; contentType?: string }
export type IssueSeverity = Severity;
export type IssueStatus = 'OPEN' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'IGNORED' | 'FIXED' | 'REOPENED';
export interface Issue { id: string; projectId: string; detectorId: string; module: QaModule; severity: IssueSeverity; status: IssueStatus; title: string; message: string; fingerprint: string; primaryUrl: string; firstSeenAt: string; lastSeenAt: string; occurrenceCount: number; createdAt: string; updatedAt: string }
export interface IssueOccurrence { id: string; issueId: string; projectId: string; scanId: string; pageId?: string; sourceUrl?: string; targetUrl?: string; evidence: Record<string, unknown>; detectedAt: string }
export type BrowserExecutionStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export interface BrowserFact { id: string; scanId: string; executionId: string; kind: 'CONSOLE' | 'PAGE_ERROR' | 'REQUEST' | 'RESPONSE' | 'FAILED_REQUEST' | 'NETWORK_POLICY_BLOCKED'; type?: string; url?: string; resourceType?: string; status?: number; message?: string; source?: string; timestamp: string; }
export interface BrowserPageExecution { id: string; scanId: string; projectId: string; pageUrl: string; browser: BrowserType; viewport: Viewport; status: BrowserExecutionStatus; finalUrl?: string; httpStatus?: number; startedAt: string; completedAt?: string; durationMs?: number; consoleErrorCount: number; pageErrorCount: number; failedRequestCount: number; screenshotEvidenceId?: string; }
export type EvidenceType = 'SCREENSHOT' | 'DOM_SNAPSHOT' | 'NETWORK' | 'CONSOLE' | 'OTHER';
export interface Evidence { id: string; projectId: string; scanId?: string; executionId?: string; type: EvidenceType; storagePath: string; contentType: string; sizeBytes: number; browser?: BrowserType; viewport?: Viewport; pageUrl?: string; createdAt: string; metadata?: Record<string, string | number | boolean>; }
export interface VisualRect { x: number; y: number; width: number; height: number }
export interface VisualElement { ref: string; tagName: string; textPreview: string; role?: string; selector: string; rect: VisualRect; display: string; visibility: string; position: string; overflow: string; zIndex: string; fontSize: string; lineHeight: string; whiteSpace: string; interactive: boolean; }
export interface VisualPageSnapshot { scanId: string; executionId: string; pageUrl: string; browser: BrowserType; viewport: Viewport; documentWidth: number; documentHeight: number; elements: VisualElement[]; capturedAt: string; }
export interface VisualFinding { id: string; scanId: string; executionId: string; detectorId: string; pageUrl: string; browser: BrowserType; viewport: Viewport; severity: Severity; title: string; message: string; fingerprint: string; elements: Array<{ ref: string; selector: string; rect: VisualRect }>; annotatedEvidenceId?: string; }
export interface RegisterRequest { name: string; email: string; password: string }
export interface LoginRequest { email: string; password: string }
export interface AuthUser { id: string; name: string; email: string }
export interface AuthResponse { user: AuthUser }
export interface CreateSessionRequest { idToken: string }
export type AuthSessionResponse = AuthResponse;
export type CurrentUserResponse = AuthResponse;
export type EnvironmentType = 'production' | 'staging' | 'qa' | 'development' | 'custom';
export interface Environment { id: string; projectId?: string; name: string; type: EnvironmentType; baseUrl: string; isDefault: boolean }
export interface Project { id: string; name: string; baseUrl: string; createdBy: string; organizationId: string | null; environments: Environment[] }
export interface CreateProjectRequest { name: string; baseUrl: string; environmentName: string; environmentType: EnvironmentType }
export interface UpdateProjectRequest { name?: string; baseUrl?: string }
export interface ProjectResponse { project: Project }
export interface ProjectsResponse { projects: Project[] }
export interface CreateEnvironmentRequest { name: string; type: EnvironmentType; baseUrl: string; isDefault?: boolean }
export interface UpdateEnvironmentRequest { name?: string; type?: EnvironmentType; baseUrl?: string; isDefault?: boolean }
export interface EnvironmentResponse { environment: Environment }
export interface EnvironmentsResponse { environments: Environment[] }
