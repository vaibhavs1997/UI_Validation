import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FirebaseScheduleRepository } from '@visionqa/database/firebase';
import type { ScheduleRepository } from '@visionqa/database/contracts';
import type {
  CreateScheduleRequest,
  Schedule,
  ScheduleRecurrence,
  ScheduleRun,
  ScheduleTemplateRequest,
  ScheduledScanTemplate,
  Scan,
  UpdateScheduleRequest,
} from '@visionqa/contracts';
import {
  nextScheduledOccurrence,
  validateScheduleRecurrence,
} from '@visionqa/contracts';
import { randomUUID } from 'node:crypto';
import { ScansService } from '../scans/scans.service.js';

const MAX_SCHEDULES_PER_PROJECT = 50;
const MAX_ENABLED_SCHEDULES_PER_PROJECT = 25;

function safeErrorMessage(error: unknown): string {
  if (error instanceof BadRequestException) {
    const response = error.getResponse();
    return typeof response === 'string'
      ? response
      : typeof response === 'object' && response && 'message' in response
        ? String((response as { message?: unknown }).message)
        : 'The schedule template is invalid.';
  }
  return 'The scheduled scan could not be created.';
}

function errorCode(error: unknown): NonNullable<ScheduleRun['errorCode']> {
  const message = safeErrorMessage(error).toLowerCase();
  if (message.includes('custom check')) return 'CUSTOM_CHECK_NOT_FOUND';
  if (message.includes('project')) return 'PROJECT_NOT_FOUND';
  if (error instanceof BadRequestException) return 'VALIDATION_FAILED';
  if (error instanceof ServiceUnavailableException) return 'SCAN_CREATE_FAILED';
  return 'INTERNAL_ERROR';
}

@Injectable()
export class SchedulesService {
  private readonly schedules: ScheduleRepository;

  constructor(
    private readonly scans: ScansService,
    schedules: ScheduleRepository = new FirebaseScheduleRepository(),
  ) {
    this.schedules = schedules;
  }

  private async projectScheduleLimit(
    ownerId: string,
    projectId: string,
    enabled: boolean,
    excludingId?: string,
  ): Promise<void> {
    const current = await this.schedules.findByProject(ownerId, projectId);
    if (!current) throw new BadRequestException('Project not found.');
    const schedules = current.filter((schedule) => schedule.id !== excludingId);
    if (schedules.length >= MAX_SCHEDULES_PER_PROJECT)
      throw new BadRequestException(
        'This project has reached its schedule limit.',
      );
    if (
      enabled &&
      schedules.filter((schedule) => schedule.enabled).length >=
        MAX_ENABLED_SCHEDULES_PER_PROJECT
    )
      throw new BadRequestException(
        'This project has reached its enabled schedule limit.',
      );
  }

  private async validateTemplate(
    ownerId: string,
    projectId: string,
    template: ScheduleTemplateRequest,
  ): Promise<ScheduledScanTemplate> {
    const normalized = await this.scans.validateCreateInput(
      ownerId,
      projectId,
      {
        url: template.targetUrl,
        scope: template.scope,
        module: template.module,
        ...(template.modules ? { modules: template.modules } : {}),
        ...(template.browsers ? { browsers: template.browsers } : {}),
        ...(template.viewports ? { viewports: template.viewports } : {}),
        ...(template.options ? { options: template.options } : {}),
        ...(template.customCheckIds
          ? { customCheckIds: template.customCheckIds }
          : {}),
      },
    );
    return {
      target: normalized.target,
      scope: normalized.scope!,
      module: normalized.module,
      ...(normalized.modules ? { modules: normalized.modules } : {}),
      browsers: normalized.browsers,
      viewports: normalized.viewports,
      options: normalized.options,
      customCheckIds: normalized.customCheckIds ?? [],
    };
  }

  private recurrenceOrThrow(
    recurrence: ScheduleRecurrence,
    timezone: string,
  ): void {
    const errors = validateScheduleRecurrence(recurrence, timezone);
    if (errors.length) throw new BadRequestException(errors[0]);
  }

  async create(
    ownerId: string,
    projectId: string,
    input: CreateScheduleRequest,
  ): Promise<Schedule> {
    const enabled = input.enabled !== false;
    await this.projectScheduleLimit(ownerId, projectId, enabled);
    this.recurrenceOrThrow(input.recurrence, input.timezone);
    const template = await this.validateTemplate(
      ownerId,
      projectId,
      input.template,
    );
    const nextRunAt = enabled
      ? nextScheduledOccurrence(input.recurrence, input.timezone)
      : null;
    if (enabled && !nextRunAt)
      throw new BadRequestException(
        'Unable to calculate the next schedule run.',
      );
    const created = await this.schedules.create(ownerId, projectId, {
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      enabled,
      recurrence: input.recurrence,
      timezone: input.timezone,
      overlapPolicy: 'SKIP_WHILE_RUNNING',
      template,
      ...(nextRunAt ? { nextRunAt } : {}),
      createdBy: ownerId,
    });
    if (!created) throw new BadRequestException('Project not found.');
    return created;
  }

  list(ownerId: string, projectId: string): Promise<Schedule[] | null> {
    return this.schedules.findByProject(ownerId, projectId);
  }

  find(ownerId: string, projectId: string, scheduleId: string) {
    return this.schedules.findById(ownerId, projectId, scheduleId);
  }

  async update(
    ownerId: string,
    projectId: string,
    scheduleId: string,
    input: UpdateScheduleRequest,
  ): Promise<Schedule | null> {
    const current = await this.schedules.findById(
      ownerId,
      projectId,
      scheduleId,
    );
    if (!current) return null;
    const enabled = input.enabled ?? current.enabled;
    await this.projectScheduleLimit(ownerId, projectId, enabled, scheduleId);
    const recurrence = input.recurrence ?? current.recurrence;
    const timezone = input.timezone ?? current.timezone;
    this.recurrenceOrThrow(recurrence, timezone);
    const currentTemplate = current.template;
    const requested = input.template ?? {};
    const mergedTemplate: ScheduleTemplateRequest = {
      targetUrl: requested.targetUrl ?? currentTemplate.target.requestedUrl,
      scope: requested.scope ?? currentTemplate.scope,
      module: requested.module ?? currentTemplate.module,
      ...((requested.modules ?? currentTemplate.modules)
        ? { modules: requested.modules ?? currentTemplate.modules }
        : {}),
      ...((requested.browsers ?? currentTemplate.browsers)
        ? { browsers: requested.browsers ?? currentTemplate.browsers }
        : {}),
      ...((requested.viewports ?? currentTemplate.viewports)
        ? { viewports: requested.viewports ?? currentTemplate.viewports }
        : {}),
      ...((requested.options ?? currentTemplate.options)
        ? { options: requested.options ?? currentTemplate.options }
        : {}),
      ...((requested.customCheckIds ?? currentTemplate.customCheckIds)
        ? {
            customCheckIds:
              requested.customCheckIds ?? currentTemplate.customCheckIds,
          }
        : {}),
    };
    const template = await this.validateTemplate(
      ownerId,
      projectId,
      mergedTemplate,
    );
    const nextRunAt = enabled
      ? nextScheduledOccurrence(recurrence, timezone)
      : null;
    if (enabled && !nextRunAt)
      throw new BadRequestException(
        'Unable to calculate the next schedule run.',
      );
    return this.schedules.update(ownerId, projectId, scheduleId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      enabled,
      recurrence,
      timezone,
      overlapPolicy: 'SKIP_WHILE_RUNNING',
      template,
      nextRunAt,
    });
  }

  archive(ownerId: string, projectId: string, scheduleId: string) {
    return this.schedules.archive(ownerId, projectId, scheduleId);
  }

  runs(
    ownerId: string,
    projectId: string,
    scheduleId: string,
    limit = 25,
    cursor?: string,
  ) {
    return this.schedules.listRuns(
      ownerId,
      projectId,
      scheduleId,
      limit,
      cursor,
    );
  }

  async preview(
    ownerId: string,
    projectId: string,
    recurrence: ScheduleRecurrence,
    timezone: string,
  ): Promise<string | null> {
    const schedules = await this.schedules.findByProject(ownerId, projectId);
    if (!schedules) throw new BadRequestException('Project not found.');
    this.recurrenceOrThrow(recurrence, timezone);
    return nextScheduledOccurrence(recurrence, timezone);
  }

  private scanInput(schedule: Schedule, run: ScheduleRun) {
    const template = schedule.template;
    return {
      url: template.target.requestedUrl,
      scope: template.scope,
      module: template.module,
      ...(template.modules ? { modules: template.modules } : {}),
      browsers: template.browsers,
      viewports: template.viewports,
      options: template.options,
      ...(template.customCheckIds.length
        ? { customCheckIds: template.customCheckIds }
        : {}),
      triggerSource: 'SCHEDULE' as const,
      scheduleId: schedule.id,
      scheduleRunId: run.id,
      idempotencyKey: run.id,
    };
  }

  private async createScanForRun(
    schedule: Schedule,
    run: ScheduleRun,
  ): Promise<Scan> {
    if (run.scanId) {
      const existing = await this.scans.get(
        schedule.createdBy,
        schedule.projectId,
        run.scanId,
      );
      if (existing) return existing;
    }
    await this.schedules.updateRun(schedule.projectId, schedule.id, run.id, {
      status: 'TRIGGERED',
      triggeredAt: new Date().toISOString(),
    });
    try {
      const scan = await this.scans.create(
        schedule.createdBy,
        schedule.projectId,
        this.scanInput(schedule, run),
      );
      await this.schedules.updateRun(schedule.projectId, schedule.id, run.id, {
        status: 'SCAN_CREATED',
        scanId: scan.id,
      });
      return scan;
    } catch (error) {
      await this.schedules.updateRun(schedule.projectId, schedule.id, run.id, {
        status: 'FAILED',
        errorCode: errorCode(error),
        errorMessage: safeErrorMessage(error),
      });
      throw error;
    }
  }

  async runNow(
    ownerId: string,
    projectId: string,
    scheduleId: string,
    idempotencyKey?: string,
  ): Promise<{ run: ScheduleRun; scan: Scan }> {
    const schedule = await this.schedules.findById(
      ownerId,
      projectId,
      scheduleId,
    );
    if (!schedule) throw new BadRequestException('Schedule not found.');
    const key = idempotencyKey?.trim() || randomUUID();
    if (key.length > 128)
      throw new BadRequestException('Idempotency key is too long.');
    const run = await this.schedules.createManualRun(
      ownerId,
      projectId,
      scheduleId,
      key,
      new Date().toISOString(),
    );
    if (!run) throw new BadRequestException('Schedule not found.');
    const scan = await this.createScanForRun(schedule, run);
    const updated =
      (await this.schedules.findRun(schedule.projectId, schedule.id, run.id)) ??
      run;
    return { run: updated, scan };
  }

  async triggerScheduledRun(
    scheduleId: string,
    runId: string,
  ): Promise<{ run: ScheduleRun; scan?: Scan }> {
    const schedule = await this.schedules.findByIdForScheduler(scheduleId);
    if (!schedule) throw new BadRequestException('Schedule not found.');
    const run = await this.schedules.findRun(
      schedule.projectId,
      schedule.id,
      runId,
    );
    if (!run) throw new BadRequestException('Schedule run not found.');
    if (run.status === 'SKIPPED') return { run };
    const scan = await this.createScanForRun(schedule, run);
    const updated =
      (await this.schedules.findRun(schedule.projectId, schedule.id, run.id)) ??
      run;
    return { run: updated, scan };
  }

  async markTriggerFailed(
    scheduleId: string,
    runId: string,
    error: unknown,
  ): Promise<ScheduleRun | null> {
    const schedule = await this.schedules.findByIdForScheduler(scheduleId);
    if (!schedule) return null;
    return this.schedules.updateRun(schedule.projectId, schedule.id, runId, {
      status: 'FAILED',
      errorCode: 'INTERNAL_ERROR',
      errorMessage: safeErrorMessage(error),
    });
  }
}
