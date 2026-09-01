import { describe, expect, it, vi } from 'vitest';
import type { Schedule, ScheduleRun } from '@visionqa/contracts';
import type { ScheduleRepository } from '@visionqa/database/contracts';
import { ScheduleRunner, type ScheduleTrigger } from './ScheduleRunner.js';

const schedule: Schedule = {
  id: 'schedule-1',
  projectId: 'project-1',
  name: 'Daily QA',
  enabled: true,
  recurrence: { cadence: 'DAILY', time: '09:00' },
  timezone: 'UTC',
  overlapPolicy: 'SKIP_WHILE_RUNNING',
  template: {} as Schedule['template'],
  nextRunAt: '2026-09-01T09:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  createdBy: 'user-1',
};

function repository(overrides: Partial<ScheduleRepository> = {}) {
  return {
    findDue: vi.fn().mockResolvedValue([schedule]),
    claimScheduledRun: vi.fn().mockResolvedValue({
      id: 'scheduled-run-1',
      projectId: schedule.projectId,
      scheduleId: schedule.id,
      source: 'SCHEDULED',
      scheduledFor: schedule.nextRunAt!,
      status: 'PENDING',
      createdAt: '2026-09-01T09:00:00Z',
      updatedAt: '2026-09-01T09:00:00Z',
    } satisfies ScheduleRun),
    updateRun: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as ScheduleRepository;
}

describe('ScheduleRunner', () => {
  it('claims one due occurrence and triggers through the API boundary', async () => {
    const repo = repository();
    const trigger: ScheduleTrigger = {
      trigger: vi.fn().mockResolvedValue(undefined),
    };
    const runner = new ScheduleRunner(repo, trigger, 30_000);
    await runner.tick(new Date('2026-09-01T09:01:00Z'));
    expect(repo.claimScheduledRun).toHaveBeenCalledWith(
      schedule.id,
      schedule.nextRunAt!,
      '2026-09-02T09:00:00Z',
      '2026-09-01T09:01:00.000Z',
    );
    expect(trigger.trigger).toHaveBeenCalledOnce();
  });

  it('does not trigger a claimed overlapping occurrence', async () => {
    const repo = repository({
      claimScheduledRun: vi.fn().mockResolvedValue({
        id: 'scheduled-run-1',
        projectId: schedule.projectId,
        scheduleId: schedule.id,
        source: 'SCHEDULED',
        scheduledFor: schedule.nextRunAt!,
        status: 'SKIPPED',
        skipReason: 'PREVIOUS_RUN_ACTIVE',
        createdAt: schedule.nextRunAt!,
        updatedAt: schedule.nextRunAt!,
      } satisfies ScheduleRun),
    });
    const trigger: ScheduleTrigger = { trigger: vi.fn() };
    await new ScheduleRunner(repo, trigger, 30_000).tick(
      new Date('2026-09-01T09:01:00Z'),
    );
    expect(trigger.trigger).not.toHaveBeenCalled();
  });

  it('retries one transient trigger failure and persists a final failure', async () => {
    const repo = repository();
    const transient = Object.assign(new Error('temporary'), {
      retryable: true,
    });
    const trigger: ScheduleTrigger = {
      trigger: vi
        .fn()
        .mockRejectedValueOnce(transient)
        .mockRejectedValueOnce(new Error('down')),
    };
    await new ScheduleRunner(repo, trigger, 30_000).tick(
      new Date('2026-09-01T09:01:00Z'),
    );
    expect(trigger.trigger).toHaveBeenCalledTimes(2);
    expect(repo.updateRun).toHaveBeenCalledWith(
      schedule.projectId,
      schedule.id,
      'scheduled-run-1',
      expect.objectContaining({
        status: 'FAILED',
        errorCode: 'INTERNAL_ERROR',
      }),
    );
  });
});
