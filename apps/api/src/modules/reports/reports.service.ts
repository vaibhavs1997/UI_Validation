import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { ReportOptions, Report } from '@visionqa/contracts';
import {
  FirebaseReportRepository,
  FirebaseScheduleRepository,
} from '@visionqa/database/firebase';
import { ReportBuilder } from '@visionqa/reporting';
import { ScansService } from '../scans/scans.service.js';

const terminalStatuses = new Set(['completed', 'partial', 'failed', 'cancelled']);

@Injectable()
export class ReportsService {
  private readonly reports = new FirebaseReportRepository();
  private readonly schedules = new FirebaseScheduleRepository();
  private readonly builder = new ReportBuilder();

  constructor(private readonly scans: ScansService) {}

  async generate(
    ownerId: string,
    projectId: string,
    scanId: string,
    options: ReportOptions = {},
    idempotencyKey?: string,
  ): Promise<Report> {
    const sources = await this.scans.reportSources(ownerId, projectId, scanId);
    if (!sources) throw new BadRequestException('Scan not found.');
    if (!terminalStatuses.has(sources.scan.status))
      throw new BadRequestException('SCAN_NOT_TERMINAL');

    const key = idempotencyKey?.trim();
    if (key && key.length > 128)
      throw new BadRequestException('Idempotency-Key is too long.');
    const reportId = key
      ? `report-${createHash('sha256').update(`${projectId}|${scanId}|${key}`).digest('hex')}`
      : randomUUID();
    if (key) {
      const existing = await this.reports.findById(ownerId, projectId, reportId);
      if (existing) return existing;
    }

    const existingReports = await this.reports.list(ownerId, projectId, {
      scanId,
      limit: 100,
    });
    const reportVersion = Math.max(
      0,
      ...(existingReports?.reports ?? []).map((report) => report.reportVersion),
    ) + 1;
    const schedule = sources.scan.scheduleId
      ? await this.schedules.findByIdForScheduler(sources.scan.scheduleId)
      : null;
    const scheduleName =
      schedule?.projectId === projectId ? schedule.name : undefined;
    console.info(JSON.stringify({ event: 'report.generation_started', scanId }));
    let snapshot: ReturnType<ReportBuilder['build']>;
    try {
      snapshot = this.builder.build({
        sources,
        options,
        generatedAt: new Date().toISOString(),
        timezone: schedule?.projectId === projectId ? schedule.timezone : 'UTC',
        ...(scheduleName ? { scheduleName } : {}),
      });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'UNKNOWN';
      console.error(JSON.stringify({ event: 'report.failed', scanId, code }));
      if (code === 'REPORT_SNAPSHOT_TOO_LARGE')
        throw new BadRequestException('Report exceeds the supported size limit.');
      throw new InternalServerErrorException('Unable to generate report.');
    }
    const report = await this.reports.create(ownerId, projectId, {
      id: reportId,
      scanId,
      title: snapshot.title,
      status: 'READY',
      reportVersion,
      generatedAt: snapshot.metadata.generatedAt,
      generatedBy: ownerId,
      formatAvailability: snapshot.formatAvailability,
      summarySnapshot: snapshot.summarySnapshot,
      moduleSnapshots: snapshot.moduleSnapshots,
      issueSnapshot: snapshot.issueSnapshot,
      sections: snapshot.sections,
      evidenceReferences: snapshot.evidenceReferences,
      metadata: snapshot.metadata,
      snapshotHash: snapshot.snapshotHash,
    });
    if (!report) throw new BadRequestException('Unable to create report.');
    console.info(JSON.stringify({ event: 'report.ready', reportId, scanId }));
    return report;
  }

  async list(ownerId: string, projectId: string, options: Parameters<FirebaseReportRepository['list']>[2]) {
    return this.reports.list(ownerId, projectId, options);
  }

  get(ownerId: string, projectId: string, reportId: string) {
    return this.reports.findById(ownerId, projectId, reportId);
  }

  async delete(ownerId: string, projectId: string, reportId: string): Promise<boolean> {
    const deleted = await this.reports.delete(ownerId, projectId, reportId);
    if (deleted) console.info(JSON.stringify({ event: 'report.deleted', reportId }));
    return deleted;
  }
}
