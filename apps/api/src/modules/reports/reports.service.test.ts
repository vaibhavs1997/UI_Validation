import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Report, ReportBuilderSources } from '@visionqa/contracts';
import { ReportsService } from './reports.service.js';

const sources = (status: 'completed' | 'running' = 'completed'): ReportBuilderSources => ({
  projectName: 'Example',
  scan: {
    id: 'scan-1', projectId: 'project-1', createdBy: 'user-1',
    target: { requestedUrl: 'https://example.com', normalizedUrl: 'https://example.com/', origin: 'https://example.com', protocol: 'https', hostname: 'example.com' },
    scope: 'single-page', type: 'module', module: 'accessibility-seo', checks: ['accessible-name'], requestedUrls: ['https://example.com/'], browsers: ['chromium'], viewports: [{ width: 1366, height: 768 }], options: {}, status, progress: { completed: 1, total: 1, percent: 100 }, createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:01:00.000Z', completedAt: status === 'completed' ? '2026-09-01T09:01:00.000Z' : undefined,
  } as ReportBuilderSources['scan'],
  issues: [], crawlPages: [], crawlSummary: { pagesDiscovered: 0, pagesFetched: 0, pagesFailed: 0, maxDepthReached: 0, durationMs: 0 }, resources: [], browserExecutions: [], browserFacts: [], evidence: [], customResults: [], customCheckSnapshots: [],
});

describe('ReportsService', () => {
  it('builds and persists a ready report from a terminal scan', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(null), list: vi.fn().mockResolvedValue({ reports: [] }), create: vi.fn().mockResolvedValue({ id: 'report-1', status: 'READY' } as Report), delete: vi.fn() };
    const service = new ReportsService({ reportSources: vi.fn().mockResolvedValue(sources()) } as never);
    (service as unknown as { reports: typeof repo }).reports = repo;
    (service as unknown as { schedules: { findByIdForScheduler: ReturnType<typeof vi.fn> } }).schedules = { findByIdForScheduler: vi.fn().mockResolvedValue(null) };
    const result = await service.generate('user-1', 'project-1', 'scan-1', {}, 'same-request');
    expect(result.status).toBe('READY');
    expect(repo.create).toHaveBeenCalledWith('user-1', 'project-1', expect.objectContaining({ status: 'READY', reportVersion: 1 }));
  });

  it('rejects a running scan before creating a report', async () => {
    const create = vi.fn();
    const service = new ReportsService({ reportSources: vi.fn().mockResolvedValue(sources('running')) } as never);
    (service as unknown as { reports: { create: typeof create } }).reports = { create };
    await expect(service.generate('user-1', 'project-1', 'scan-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns the existing deterministic report for an idempotent retry', async () => {
    const existing = { id: 'report-existing', status: 'READY' } as Report;
    const repo = { findById: vi.fn().mockResolvedValue(existing), create: vi.fn() };
    const service = new ReportsService({ reportSources: vi.fn().mockResolvedValue(sources()) } as never);
    (service as unknown as { reports: typeof repo }).reports = repo;
    await expect(service.generate('user-1', 'project-1', 'scan-1', {}, 'same-request')).resolves.toBe(existing);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
