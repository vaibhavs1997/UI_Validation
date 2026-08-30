export type QaModule =
  | 'crawl'
  | 'links-resources'
  | 'visual-responsive'
  | 'interactions-forms'
  | 'browser-network'
  | 'accessibility-seo'
  | 'performance-compatibility'
  | 'custom-checks';
export type ScanStatus =
  'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ScanType = 'module' | 'full';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'open' | 'acknowledged' | 'resolved' | 'ignored';
export type BrowserType = 'chromium' | 'firefox' | 'webkit';
export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}
export interface ScanProgress {
  completed: number;
  total: number;
  phase: string;
}
export interface CreateScanRequest {
  projectId: string;
  environmentId: string;
  module: QaModule;
  checks?: string[];
  urls?: string[];
  browsers?: BrowserType[];
  viewports?: Viewport[];
  options?: { maxPages?: number; captureEvidence?: boolean };
}
export interface ScanSummary {
  id: string;
  type: ScanType;
  status: ScanStatus;
  progress: ScanProgress;
}
export interface RegisterRequest { name: string; email: string; password: string }
export interface LoginRequest { email: string; password: string }
export interface AuthUser { id: string; name: string; email: string }
export interface AuthResponse { user: AuthUser }
export interface CreateSessionRequest { idToken: string }
export type AuthSessionResponse = AuthResponse;
export type CurrentUserResponse = AuthResponse;

export type EnvironmentType = 'production' | 'staging' | 'qa' | 'development';
export interface Environment {
  id: string;
  name: string;
  type: EnvironmentType;
  baseUrl: string;
  isDefault: boolean;
}
export interface Project {
  id: string;
  name: string;
  baseUrl: string;
  createdBy: string;
  organizationId: string | null;
  environments: Environment[];
}
export interface CreateProjectRequest {
  name: string;
  baseUrl: string;
  environmentName: string;
  environmentType: EnvironmentType;
}
export interface UpdateProjectRequest { name?: string; baseUrl?: string }
export interface ProjectResponse { project: Project }
export interface ProjectsResponse { projects: Project[] }
