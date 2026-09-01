import type { Schedule, ScheduleRun } from '@visionqa/contracts';
import type { ScheduleRepository } from '@visionqa/database/contracts';
import { FirebaseScheduleRepository } from '@visionqa/database/firebase';
import { nextScheduledOccurrence } from '@visionqa/contracts';

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const MIN_POLL_INTERVAL_MS = 30_000;
const MAX_POLL_INTERVAL_MS = 300_000;
const MAX_DUE_SCHEDULES_PER_TICK = 50;

interface TriggerError extends Error {
  retryable?: boolean;
}

export interface ScheduleTrigger {
  trigger(schedule: Schedule, run: ScheduleRun): Promise<void>;
}

class ApiScheduleTrigger implements ScheduleTrigger {
  async trigger(schedule: Schedule, run: ScheduleRun): Promise<void> {
    const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
    const token = process.env.SCHEDULER_INTERNAL_TOKEN;
    if (!token) throw new Error('SCHEDULER_INTERNAL_TOKEN is not configured.');
    const response = await fetch(
      `${apiUrl}/api/v1/internal/schedules/trigger`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-visionqa-scheduler-token': token,
        },
        body: JSON.stringify({
          scheduleId: schedule.id,
          scheduleRunId: run.id,
        }),
      },
    );
    if (response.ok) return;
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const error = new Error(
      typeof body?.message === 'string'
        ? body.message
        : 'The scheduler API rejected the trigger.',
    ) as TriggerError;
    error.retryable =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500;
    throw error;
  }
}

export class ScheduleRunner {
  private readonly repository: ScheduleRepository;
  private readonly trigger: ScheduleTrigger;
  private readonly pollIntervalMs: number;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    repository: ScheduleRepository = new FirebaseScheduleRepository(),
    trigger: ScheduleTrigger = new ApiScheduleTrigger(),
    pollIntervalMs = Number(
      process.env.SCHEDULER_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS,
    ),
  ) {
    this.repository = repository;
    this.trigger = trigger;
    this.pollIntervalMs = Math.max(
      MIN_POLL_INTERVAL_MS,
      Math.min(
        MAX_POLL_INTERVAL_MS,
        pollIntervalMs || DEFAULT_POLL_INTERVAL_MS,
      ),
    );
  }

  async tick(now = new Date()): Promise<void> {
    let due: Schedule[];
    try {
      due = await this.repository.findDue(
        now.toISOString(),
        MAX_DUE_SCHEDULES_PER_TICK,
      );
    } catch (error) {
      console.error(
        JSON.stringify({ event: 'schedule.poll_failed', error: String(error) }),
      );
      return;
    }
    for (const schedule of due) {
      try {
        await this.process(schedule, now);
      } catch {
        console.error(
          JSON.stringify({
            event: 'schedule.trigger_failed',
            scheduleId: schedule.id,
            error: 'The scheduler could not process the occurrence.',
          }),
        );
      }
    }
  }

  private async process(schedule: Schedule, now: Date): Promise<void> {
    if (!schedule.enabled || !schedule.nextRunAt) return;
    const nextRunAt = nextScheduledOccurrence(
      schedule.recurrence,
      schedule.timezone,
      now,
    );
    const run = await this.repository.claimScheduledRun(
      schedule.id,
      schedule.nextRunAt,
      nextRunAt,
      now.toISOString(),
    );
    if (!run) return;
    if (run.status === 'SKIPPED') {
      console.info(
        JSON.stringify({
          event: 'schedule.run_skipped',
          scheduleId: schedule.id,
          scheduleRunId: run.id,
          reason: run.skipReason,
        }),
      );
      return;
    }
    console.info(
      JSON.stringify({
        event: 'schedule.triggered',
        scheduleId: schedule.id,
        scheduleRunId: run.id,
        scheduledFor: run.scheduledFor,
      }),
    );
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await this.trigger.trigger(schedule, run);
        console.info(
          JSON.stringify({
            event: 'schedule.scan_created',
            scheduleId: schedule.id,
            scheduleRunId: run.id,
          }),
        );
        return;
      } catch (error) {
        const retryable = (error as TriggerError).retryable === true;
        if (retryable && attempt < 2) continue;
        await this.repository.updateRun(
          schedule.projectId,
          schedule.id,
          run.id,
          {
            status: 'FAILED',
            errorCode: 'INTERNAL_ERROR',
            errorMessage: 'The scheduler could not trigger the scan.',
          },
        );
        console.error(
          JSON.stringify({
            event: 'schedule.trigger_failed',
            scheduleId: schedule.id,
            scheduleRunId: run.id,
            attempt,
          }),
        );
        return;
      }
    }
  }

  async start(): Promise<void> {
    await this.tick();
    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
    this.timer.unref();
    console.info(
      JSON.stringify({
        event: 'scheduler.started',
        pollIntervalMs: this.pollIntervalMs,
        maxDueSchedulesPerTick: MAX_DUE_SCHEDULES_PER_TICK,
      }),
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
