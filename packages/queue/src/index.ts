import type {
  BrowserType,
  FullScanModuleId,
  QaModule,
  ScanOptions,
  ScanPageTarget,
  Viewport,
} from '@visionqa/contracts';
import { Queue } from 'bullmq';

export const queueNames = {
  crawl: 'qa-crawl',
  http: 'qa-http',
  browser: 'qa-browser',
} as const;
export type QueueCapability = 'crawl' | 'http' | 'browser';
export interface BaseScanJob {
  scanId: string;
  projectId: string;
  environmentId?: string;
  targetUrl: string;
  checks: string[];
  options: ScanOptions;
  pageTargets?: ScanPageTarget[];
  taskKey?: string;
}
export interface CrawlJob extends BaseScanJob {
  capability: 'crawl';
}
export interface HttpScanJob extends BaseScanJob {
  capability: 'http';
}
export interface BrowserScanJob extends BaseScanJob {
  capability: 'browser';
  module: QaModule;
  modules?: FullScanModuleId[];
  browsers: BrowserType[];
  viewports: Viewport[];
}
export type ScanJob = CrawlJob | HttpScanJob | BrowserScanJob;
export interface ScanExecutionTask {
  key: string;
  capability: QueueCapability;
  checks: string[];
  modules?: FullScanModuleId[];
  browsers?: BrowserType[];
  viewports?: Viewport[];
  dependsOn?: string[];
}
export interface ScanExecutionPlan {
  scanId: string;
  tasks: ScanExecutionTask[];
}
export interface ScanJobDispatcher {
  dispatchCrawl(job: CrawlJob): Promise<void>;
  dispatchHttp(job: HttpScanJob): Promise<void>;
  dispatchBrowser(job: BrowserScanJob): Promise<void>;
}
export function scanJobIdentity(
  job: Pick<ScanJob, 'scanId' | 'capability' | 'taskKey'> &
    Partial<Pick<BrowserScanJob, 'browsers'>>,
): string {
  return `${job.scanId}:${job.taskKey ?? `${job.capability}${job.capability === 'browser' && job.browsers?.[0] ? `:${job.browsers[0]}` : ''}`}`;
}
export function createQueueConnection(redisUrl: string): {
  connection: { url: string };
} {
  return { connection: { url: redisUrl } };
}
export class BullMqScanJobDispatcher implements ScanJobDispatcher {
  private readonly queues: Record<QueueCapability, Queue>;
  constructor(redisUrl: string) {
    const connection = { url: redisUrl };
    this.queues = {
      crawl: new Queue(queueNames.crawl, { connection }),
      http: new Queue(queueNames.http, { connection }),
      browser: new Queue(queueNames.browser, { connection }),
    };
  }
  private async add(capability: QueueCapability, job: ScanJob): Promise<void> {
    await this.queues[capability].add(capability, job, {
      jobId: scanJobIdentity(job),
    });
  }
  dispatchCrawl(job: CrawlJob): Promise<void> {
    return this.add('crawl', job);
  }
  dispatchHttp(job: HttpScanJob): Promise<void> {
    return this.add('http', job);
  }
  dispatchBrowser(job: BrowserScanJob): Promise<void> {
    return this.add('browser', job);
  }
}
