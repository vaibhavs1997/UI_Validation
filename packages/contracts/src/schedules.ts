/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./luxon.d.ts" />
/* eslint-enable @typescript-eslint/triple-slash-reference */
import { DateTime, IANAZone } from 'luxon';
import type {
  BrowserType,
  FullScanModule,
  QaModule,
  ScanOptions,
  ScanScope,
  ScanStatus,
  ScanTarget,
  Viewport,
} from './index.js';

export type ScheduleCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type ScheduleRunSource = 'SCHEDULED' | 'MANUAL_RUN_NOW';
export type ScheduleRunStatus =
  'PENDING' | 'TRIGGERED' | 'SCAN_CREATED' | 'FAILED' | 'SKIPPED';
export type ScheduleRunErrorCode =
  | 'VALIDATION_FAILED'
  | 'PROJECT_NOT_FOUND'
  | 'CUSTOM_CHECK_NOT_FOUND'
  | 'SCAN_CREATE_FAILED'
  | 'INTERNAL_ERROR';
export type ScheduleRunSkipReason = 'PREVIOUS_RUN_ACTIVE';
export type ScheduleOverlapPolicy = 'SKIP_WHILE_RUNNING';

export interface ScheduleRecurrence {
  cadence: ScheduleCadence;
  time: string;
  /** Luxon weekday numbering: Monday = 1 through Sunday = 7. */
  weekday?: number;
  /** Calendar day. Months without this day are skipped explicitly. */
  dayOfMonth?: number;
}

export interface ScheduledScanTemplate {
  target: ScanTarget;
  scope: ScanScope;
  module: QaModule;
  modules?: FullScanModule[];
  browsers: BrowserType[];
  viewports: Viewport[];
  options: ScanOptions;
  customCheckIds: string[];
}

export interface Schedule {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  enabled: boolean;
  recurrence: ScheduleRecurrence;
  timezone: string;
  overlapPolicy: ScheduleOverlapPolicy;
  template: ScheduledScanTemplate;
  nextRunAt?: string | null;
  lastRunAt?: string;
  lastScanId?: string;
  lastRunStatus?: ScheduleRunStatus | ScanStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export interface ScheduleRun {
  id: string;
  projectId: string;
  scheduleId: string;
  source: ScheduleRunSource;
  scheduledFor: string;
  triggeredAt?: string;
  scanId?: string;
  status: ScheduleRunStatus;
  errorCode?: ScheduleRunErrorCode;
  errorMessage?: string;
  skipReason?: ScheduleRunSkipReason;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleTemplateRequest {
  targetUrl: string;
  scope: ScanScope;
  module: QaModule;
  modules?: FullScanModule[];
  browsers?: BrowserType[];
  viewports?: Viewport[];
  options?: ScanOptions;
  customCheckIds?: string[];
}

export interface CreateScheduleRequest {
  name: string;
  description?: string;
  enabled?: boolean;
  recurrence: ScheduleRecurrence;
  timezone: string;
  template: ScheduleTemplateRequest;
}

export type UpdateScheduleRequest = Partial<
  Omit<CreateScheduleRequest, 'template'>
> & { template?: Partial<ScheduleTemplateRequest> };

export interface ScheduleRunPage {
  runs: ScheduleRun[];
  nextCursor?: string;
}

export interface ScheduleRepositoryInput {
  name: string;
  description?: string;
  enabled: boolean;
  recurrence: ScheduleRecurrence;
  timezone: string;
  overlapPolicy: ScheduleOverlapPolicy;
  template: ScheduledScanTemplate;
  nextRunAt?: string;
  createdBy: string;
}

export function isValidIanaTimezone(timezone: string): boolean {
  return IANAZone.isValidZone(timezone);
}

export function validateScheduleRecurrence(
  recurrence: ScheduleRecurrence,
  timezone: string,
): string[] {
  const errors: string[] = [];
  if (!isValidIanaTimezone(timezone)) errors.push('Use a valid IANA timezone.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(recurrence.time))
    errors.push('Schedule time must use HH:mm.');
  if (
    recurrence.cadence === 'WEEKLY' &&
    (!Number.isInteger(recurrence.weekday) ||
      recurrence.weekday! < 1 ||
      recurrence.weekday! > 7)
  )
    errors.push('Weekly schedules need a weekday from 1 to 7.');
  if (recurrence.cadence !== 'WEEKLY' && recurrence.weekday !== undefined)
    errors.push('Weekday is only valid for weekly schedules.');
  if (
    recurrence.cadence === 'MONTHLY' &&
    (!Number.isInteger(recurrence.dayOfMonth) ||
      recurrence.dayOfMonth! < 1 ||
      recurrence.dayOfMonth! > 31)
  )
    errors.push('Monthly schedules need a day from 1 to 31.');
  if (recurrence.cadence !== 'MONTHLY' && recurrence.dayOfMonth !== undefined)
    errors.push('Day of month is only valid for monthly schedules.');
  return errors;
}

function localCandidate(
  date: DateTime,
  recurrence: ScheduleRecurrence,
): DateTime {
  const [hourText, minuteText] = recurrence.time.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return DateTime.fromObject(
    { year: date.year, month: date.month, day: date.day, hour, minute },
    { zone: date.zoneName },
  );
}

/**
 * Returns the next occurrence strictly after `after` as an ISO UTC instant.
 * Luxon owns timezone and DST transitions; no server-local offset arithmetic is
 * performed here. Monthly days that do not exist in a month are skipped.
 */
export function nextScheduledOccurrence(
  recurrence: ScheduleRecurrence,
  timezone: string,
  after: Date = new Date(),
): string | null {
  if (validateScheduleRecurrence(recurrence, timezone).length) return null;
  const instant = DateTime.fromJSDate(after).setZone(timezone);
  const maxDays = recurrence.cadence === 'MONTHLY' ? 900 : 370;
  for (let offset = 0; offset <= maxDays; offset += 1) {
    const date = instant.startOf('day').plus({ days: offset });
    if (recurrence.cadence === 'WEEKLY' && date.weekday !== recurrence.weekday)
      continue;
    if (recurrence.cadence === 'MONTHLY' && date.day !== recurrence.dayOfMonth)
      continue;
    const candidate = localCandidate(date, recurrence);
    if (!candidate.isValid || candidate.toUTC() <= DateTime.fromJSDate(after))
      continue;
    return candidate.toUTC().toISO({ suppressMilliseconds: true });
  }
  return null;
}

export function scheduleRunId(
  scheduleId: string,
  scheduledFor: string,
): string {
  return `scheduled-${scheduleId}-${encodeURIComponent(scheduledFor)}`;
}

export function manualScheduleRunId(
  scheduleId: string,
  idempotencyKey: string,
): string {
  return `manual-${scheduleId}-${encodeURIComponent(idempotencyKey)}`;
}
