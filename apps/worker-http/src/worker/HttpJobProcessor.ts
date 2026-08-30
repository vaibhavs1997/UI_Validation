import type { HttpScanJob } from '@visionqa/queue';
export class HttpJobProcessor {
  async start(): Promise<void> {
    console.log('VisionQA HTTP worker ready');
  }
  validate(job: HttpScanJob): void { if (job.capability !== 'http' || !job.scanId || !job.targetUrl) throw new Error('Invalid HTTP job.'); }
}
