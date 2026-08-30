import type { CrawlJob } from '@visionqa/queue';
export class CrawlJobProcessor {
  async start(): Promise<void> {
    console.log('VisionQA crawl worker ready');
  }
  validate(job: CrawlJob): void { if (job.capability !== 'crawl' || !job.scanId || !job.targetUrl) throw new Error('Invalid crawl job.'); }
}
