import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import type {
  CreateScheduleRequest,
  ScheduleRecurrence,
  UpdateScheduleRequest,
} from '@visionqa/contracts';
import {
  FirebaseSessionGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-session.guard.js';
import { SchedulesService } from './schedules.service.js';

const recurrenceSchema = z.object({
  cadence: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  time: z.string().trim(),
  weekday: z.number().int().optional(),
  dayOfMonth: z.number().int().optional(),
});
const templateSchema = z.object({
  targetUrl: z.string().trim().url(),
  scope: z.string().trim().min(1),
  module: z.string().trim().min(1),
  modules: z
    .array(
      z.object({
        module: z.string().trim().min(1),
        checks: z.array(z.string().trim().min(1)).max(100),
      }),
    )
    .max(20)
    .optional(),
  browsers: z
    .array(z.enum(['chromium', 'firefox', 'webkit']))
    .max(3)
    .optional(),
  viewports: z
    .array(
      z.object({
        width: z.number().int().min(1).max(10000),
        height: z.number().int().min(1).max(10000),
        deviceScaleFactor: z.number().min(0.1).max(4).optional(),
      }),
    )
    .max(20)
    .optional(),
  options: z.record(z.unknown()).optional(),
  customCheckIds: z.array(z.string().trim().min(1)).max(25).optional(),
});
const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  enabled: z.boolean().optional(),
  recurrence: recurrenceSchema,
  timezone: z.string().trim().min(1).max(100),
  template: templateSchema,
});
const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  enabled: z.boolean().optional(),
  recurrence: recurrenceSchema.optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  template: templateSchema.partial().optional(),
});

@Controller('api/v1/projects/:projectId/schedules')
@UseGuards(FirebaseSessionGuard)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: CreateScheduleRequest,
  ) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Invalid schedule details.');
    return {
      schedule: await this.schedules.create(
        request.user!.id,
        projectId,
        parsed.data as CreateScheduleRequest,
      ),
    };
  }

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
  ) {
    const schedules = await this.schedules.list(request.user!.id, projectId);
    if (!schedules) throw new NotFoundException('Project not found.');
    return { schedules };
  }

  @Post('preview')
  async preview(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { recurrence?: unknown; timezone?: unknown },
  ) {
    const parsed = z
      .object({
        recurrence: recurrenceSchema,
        timezone: z.string().trim().min(1).max(100),
      })
      .safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Invalid schedule preview.');
    const recurrence = parsed.data.recurrence;
    const normalizedRecurrence: ScheduleRecurrence = {
      cadence: recurrence.cadence,
      time: recurrence.time,
      ...(recurrence.weekday === undefined
        ? {}
        : { weekday: recurrence.weekday }),
      ...(recurrence.dayOfMonth === undefined
        ? {}
        : { dayOfMonth: recurrence.dayOfMonth }),
    };
    return {
      nextRunAt: await this.schedules.preview(
        request.user!.id,
        projectId,
        normalizedRecurrence,
        parsed.data.timezone,
      ),
    };
  }

  @Get(':scheduleId/runs')
  async runs(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('scheduleId') scheduleId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const result = await this.schedules.runs(
      request.user!.id,
      projectId,
      scheduleId,
      query.limit ? Number(query.limit) : 25,
      query.cursor,
    );
    if (!result) throw new NotFoundException('Schedule not found.');
    return result;
  }

  @Post(':scheduleId/run')
  async runNow(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('scheduleId') scheduleId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.schedules.runNow(
      request.user!.id,
      projectId,
      scheduleId,
      idempotencyKey,
    );
  }

  @Get(':scheduleId')
  async find(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    const schedule = await this.schedules.find(
      request.user!.id,
      projectId,
      scheduleId,
    );
    if (!schedule) throw new NotFoundException('Schedule not found.');
    return { schedule };
  }

  @Patch(':scheduleId')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() body: UpdateScheduleRequest,
  ) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success || !Object.keys(parsed.data).length)
      throw new BadRequestException('Invalid schedule details.');
    const schedule = await this.schedules.update(
      request.user!.id,
      projectId,
      scheduleId,
      parsed.data as UpdateScheduleRequest,
    );
    if (!schedule) throw new NotFoundException('Schedule not found.');
    return { schedule };
  }

  @Delete(':scheduleId')
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('scheduleId') scheduleId: string,
  ) {
    const deleted = await this.schedules.archive(
      request.user!.id,
      projectId,
      scheduleId,
    );
    if (!deleted) throw new NotFoundException('Schedule not found.');
    return { deleted: true };
  }
}

@Controller('api/v1/internal/schedules')
export class SchedulerInternalController {
  constructor(private readonly schedules: SchedulesService) {}

  @Post('trigger')
  async trigger(
    @Headers('x-visionqa-scheduler-token') token: string | undefined,
    @Body() body: { scheduleId?: string; scheduleRunId?: string },
  ) {
    const expected = process.env.SCHEDULER_INTERNAL_TOKEN;
    if (!expected || token !== expected)
      throw new UnauthorizedException('Scheduler authorization failed.');
    if (!body.scheduleId || !body.scheduleRunId)
      throw new BadRequestException('Schedule trigger identity is required.');
    return this.schedules.triggerScheduledRun(
      body.scheduleId,
      body.scheduleRunId,
    );
  }
}
