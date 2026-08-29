import type { BrowserType, QaModule, Viewport } from '@visionqa/contracts';
export const queueNames = {
  crawl: 'visionqa.crawl',
  browser: 'visionqa.browser',
  http: 'visionqa.http',
  reports: 'visionqa.reports',
  notifications: 'visionqa.notifications',
} as const;
export interface CrawlJob {
  scanId: string;
  projectId: string;
  startUrls: string[];
}
export interface BrowserScanJob {
  scanId: string;
  url: string;
  module: QaModule;
  browsers: BrowserType[];
  viewports: Viewport[];
}
export interface HttpScanJob {
  scanId: string;
  urls: string[];
}
export interface GenerateReportJob {
  reportId: string;
  scanId: string;
  format: 'pdf' | 'csv' | 'json';
}
export type QueuePayload =
  CrawlJob | BrowserScanJob | HttpScanJob | GenerateReportJob;
export function createQueueConnection(redisUrl: string): {
  connection: { url: string };
} {
  return { connection: { url: redisUrl } };
}
