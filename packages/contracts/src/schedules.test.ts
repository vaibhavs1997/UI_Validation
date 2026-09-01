import { describe, expect, it } from 'vitest';
import {
  nextScheduledOccurrence,
  validateScheduleRecurrence,
} from './schedules.js';

describe('schedule recurrence', () => {
  it('calculates daily and weekly occurrences in explicit timezones', () => {
    expect(
      nextScheduledOccurrence(
        { cadence: 'DAILY', time: '09:00' },
        'Asia/Kolkata',
        new Date('2026-09-01T00:00:00.000Z'),
      ),
    ).toBe('2026-09-01T03:30:00Z');
    expect(
      nextScheduledOccurrence(
        { cadence: 'WEEKLY', time: '09:00', weekday: 1 },
        'UTC',
        new Date('2026-09-01T10:00:00.000Z'),
      ),
    ).toBe('2026-09-07T09:00:00Z');
  });

  it('uses timezone library DST semantics and skips nonexistent monthly days', () => {
    expect(
      nextScheduledOccurrence(
        { cadence: 'DAILY', time: '09:00' },
        'America/New_York',
        new Date('2026-03-07T14:00:00.000Z'),
      ),
    ).toBe('2026-03-08T13:00:00Z');
    expect(
      nextScheduledOccurrence(
        { cadence: 'MONTHLY', time: '10:00', dayOfMonth: 31 },
        'Europe/London',
        new Date('2026-02-01T00:00:00.000Z'),
      ),
    ).toBe('2026-03-31T09:00:00Z');
  });

  it('rejects invalid timezone and recurrence fields', () => {
    expect(
      validateScheduleRecurrence(
        { cadence: 'WEEKLY', time: '25:00', weekday: 8 },
        'Not/AnIanaZone',
      ),
    ).toHaveLength(3);
  });
});
