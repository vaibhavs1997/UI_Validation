import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type {
  Schedule,
  ScheduleRepositoryInput,
  ScheduleRun,
  Scan,
  ScanTarget,
} from '@visionqa/contracts';
import type { ScheduleRepository } from '@visionqa/database/contracts';
import { SchedulesService } from './schedules.service.js';

const target: ScanTarget = {
  requestedUrl: 'https://example.com',
  normalizedUrl: 'https://example.com/',
  origin: 'https://example.com',
  protocol: 'https',
  hostname: 'example.com',
};
const normalized = {
  target,
  scope: 'site' as const,
  module: 'full-scan' as const,
  modules: [
    { module: 'accessibility-seo' as const, checks: ['accessible-name'] },
  ],
  checks: ['accessible-name'],
  requestedUrls: [target.normalizedUrl],
  browsers: ['chromium' as const],
  viewports: [{ width: 1366, height: 768 }],
  options: {},
  customCheckIds: [],
};

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'schedule-1',
    projectId: 'project-1',
    name: 'Daily QA',
    enabled: true,
    recurrence: { cadence: 'DAILY', time: '09:00' },
    timezone: 'UTC',
    overlapPolicy: 'SKIP_WHILE_RUNNING',
    template: {
      target,
      scope: 'site',
      module: 'full-scan',
      modules: normalized.modules,
      browsers: normalized.browsers,
      viewports: normalized.viewports,
      options: {},
      customCheckIds: [],
    },
    nextRunAt: '2026-09-01T09:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-1',
    ...overrides,
  };
}

function repository(overrides: Partial<ScheduleRepository> = {}) {
  return {
    findByProject: vi.fn().mockResolvedValue([]),
    findRun: vi.fn().mockResolvedValue(null),
    create: vi
      .fn()
      .mockImplementation(
        async (_owner, _project, input: ScheduleRepositoryInput) =>
          schedule({
            name: input.name,
            enabled: input.enabled,
            ...(input.nextRunAt ? { nextRunAt: input.nextRunAt } : {}),
          }),
      ),
    ...overrides,
  } as unknown as ScheduleRepository;
}

type ScanServiceStub = {
  validateCreateInput: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

function scans(overrides: Record<string, unknown> = {}): ScanServiceStub {
  return {
    validateCreateInput: vi.fn().mockResolvedValue(normalized),
    create: vi.fn().mockResolvedValue({
      id: 'scan-1',
      projectId: 'project-1',
      status: 'queued',
    } as Scan),
    get: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as ScanServiceStub;
}

describe('SchedulesService', () => {
  it('reuses scan validation and persists a real next run', async () => {
    const repo = repository();
    const scanService = scans();
    const result = await new SchedulesService(
      scanService as never,
      repo,
    ).create('user-1', 'project-1', {
      name: 'Daily QA',
      recurrence: { cadence: 'DAILY', time: '09:00' },
      timezone: 'UTC',
      template: {
        targetUrl: target.requestedUrl,
        scope: 'site',
        module: 'full-scan',
        modules: normalized.modules,
      },
    });
    expect(scanService.validateCreateInput).toHaveBeenCalledOnce();
    expect(repo.create).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      expect.objectContaining({ nextRunAt: expect.any(String) }),
    );
    expect(result.nextRunAt).toEqual(expect.any(String));
  });

  it('rejects invalid recurrence before validating or persisting the template', async () => {
    const repo = repository();
    const scanService = scans();
    await expect(
      new SchedulesService(scanService as never, repo).create(
        'user-1',
        'project-1',
        {
          name: 'Invalid',
          recurrence: { cadence: 'DAILY', time: '25:00' },
          timezone: 'UTC',
          template: {
            targetUrl: target.requestedUrl,
            scope: 'site',
            module: 'full-scan',
            modules: normalized.modules,
          },
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(scanService.validateCreateInput).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('keeps Run now idempotent when the durable run already links a scan', async () => {
    const existing = {
      id: 'scan-1',
      projectId: 'project-1',
      status: 'queued',
    } as Scan;
    const run: ScheduleRun = {
      id: 'manual-schedule-1-key',
      projectId: 'project-1',
      scheduleId: 'schedule-1',
      source: 'MANUAL_RUN_NOW',
      scheduledFor: '2026-09-01T09:00:00Z',
      scanId: existing.id,
      status: 'SCAN_CREATED',
      createdAt: existing.id,
      updatedAt: existing.id,
    };
    const repo = repository({
      findById: vi.fn().mockResolvedValue(schedule()),
      createManualRun: vi.fn().mockResolvedValue(run),
    });
    const scanService = scans({ get: vi.fn().mockResolvedValue(existing) });
    const result = await new SchedulesService(
      scanService as never,
      repo,
    ).runNow('user-1', 'project-1', 'schedule-1', 'key');
    expect(result.scan).toBe(existing);
    expect(scanService.create).not.toHaveBeenCalled();
  });

  it('records missing custom checks as a failed run without silent substitution', async () => {
    const run: ScheduleRun = {
      id: 'manual-schedule-1-key',
      projectId: 'project-1',
      scheduleId: 'schedule-1',
      source: 'MANUAL_RUN_NOW',
      scheduledFor: '2026-09-01T09:00:00Z',
      status: 'PENDING',
      createdAt: '2026-09-01T09:00:00Z',
      updatedAt: '2026-09-01T09:00:00Z',
    };
    const repo = repository({
      findById: vi.fn().mockResolvedValue(schedule()),
      createManualRun: vi.fn().mockResolvedValue(run),
      updateRun: vi.fn().mockResolvedValue(null),
    });
    const scanService = scans({
      create: vi
        .fn()
        .mockRejectedValue(
          new BadRequestException(
            'One or more selected custom checks were not found.',
          ),
        ),
    });
    await expect(
      new SchedulesService(scanService as never, repo).runNow(
        'user-1',
        'project-1',
        'schedule-1',
        'key',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updateRun).toHaveBeenCalledWith(
      'project-1',
      'schedule-1',
      run.id,
      expect.objectContaining({
        status: 'FAILED',
        errorCode: 'CUSTOM_CHECK_NOT_FOUND',
      }),
    );
    expect(scanService.create).toHaveBeenCalledOnce();
  });
});
