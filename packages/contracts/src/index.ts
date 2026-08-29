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
