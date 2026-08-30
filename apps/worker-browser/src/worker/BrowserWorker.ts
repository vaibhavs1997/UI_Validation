import type { BrowserScanJob } from '@visionqa/queue';
export class BrowserWorker {
  async start(): Promise<void> {
    console.log('VisionQA browser worker ready');
  }
  validate(job: BrowserScanJob): void { if (job.capability !== 'browser' || !job.scanId || !job.targetUrl || !job.viewports.length) throw new Error('Invalid browser job.'); }
}
