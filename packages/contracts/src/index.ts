export const qaModules = ['crawl-site-structure', 'links-resources', 'visual-responsive', 'interactions-forms', 'browser-network', 'accessibility-seo', 'performance-compatibility', 'custom-checks', 'full-scan'] as const;
export type QaModule = typeof qaModules[number];
export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ScanType = 'module' | 'full';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'open' | 'acknowledged' | 'resolved' | 'ignored';
export type BrowserType = 'chromium' | 'firefox' | 'webkit';
export interface Viewport { width: number; height: number; deviceScaleFactor?: number }
export interface ScanProgress { completed: number; total: number; percent: number }
export interface ScanOptions { maxPages?: number; maxDepth?: number; captureEvidence?: boolean }
export interface FullScanModule { module: Exclude<QaModule, 'full-scan'>; checks: string[] }
export interface CreateScanRequest { environmentId: string; module: QaModule; checks?: string[]; modules?: FullScanModule[]; requestedUrls?: string[]; browsers?: BrowserType[]; viewports?: Viewport[]; options?: ScanOptions }
export interface Scan { id: string; projectId: string; environmentId: string; createdBy: string; type: ScanType; module: QaModule; checks: string[]; modules?: FullScanModule[] | undefined; requestedUrls: string[]; viewports: Viewport[]; browsers: BrowserType[]; options: ScanOptions; status: ScanStatus; progress: ScanProgress; createdAt: string; updatedAt: string; startedAt?: string | undefined; completedAt?: string | undefined; cancelledAt?: string | undefined; cancellationRequestedAt?: string | undefined; failureCode?: string | undefined; failureMessage?: string | undefined }
export interface ScanSummary { id: string; projectId: string; environmentId: string; module: QaModule; checks: string[]; status: ScanStatus; progress: ScanProgress; createdAt: string }
export interface ScanProgressResponse { scanId: string; status: ScanStatus; progress: ScanProgress }
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
