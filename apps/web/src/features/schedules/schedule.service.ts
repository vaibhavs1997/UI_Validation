import type {
  CreateScheduleRequest,
  Schedule,
  ScheduleRecurrence,
  ScheduleRun,
  ScheduleRunPage,
  UpdateScheduleRequest,
} from '@visionqa/contracts';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    throw new Error(
      typeof body?.message === 'string'
        ? body.message
        : 'Unable to complete schedule request.',
    );
  }
  return response.json() as Promise<T>;
}

export async function getSchedules(projectId: string): Promise<Schedule[]> {
  return (
    await request<{ schedules: Schedule[] }>(
      `/api/v1/projects/${projectId}/schedules`,
    )
  ).schedules;
}

export async function createSchedule(
  projectId: string,
  input: CreateScheduleRequest,
): Promise<Schedule> {
  return (
    await request<{ schedule: Schedule }>(
      `/api/v1/projects/${projectId}/schedules`,
      { method: 'POST', body: JSON.stringify(input) },
    )
  ).schedule;
}

export async function updateSchedule(
  projectId: string,
  scheduleId: string,
  input: UpdateScheduleRequest,
): Promise<Schedule> {
  return (
    await request<{ schedule: Schedule }>(
      `/api/v1/projects/${projectId}/schedules/${scheduleId}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    )
  ).schedule;
}

export async function deleteSchedule(
  projectId: string,
  scheduleId: string,
): Promise<void> {
  await request<{ deleted: true }>(
    `/api/v1/projects/${projectId}/schedules/${scheduleId}`,
    { method: 'DELETE' },
  );
}

export async function runScheduleNow(
  projectId: string,
  scheduleId: string,
): Promise<{ run: ScheduleRun; scan: import('@visionqa/contracts').Scan }> {
  const idempotencyKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  return request(`/api/v1/projects/${projectId}/schedules/${scheduleId}/run`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export async function getScheduleRuns(
  projectId: string,
  scheduleId: string,
  cursor?: string,
): Promise<ScheduleRunPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return request<ScheduleRunPage>(
    `/api/v1/projects/${projectId}/schedules/${scheduleId}/runs${query}`,
  );
}

export async function getSchedulePreview(
  projectId: string,
  recurrence: ScheduleRecurrence,
  timezone: string,
): Promise<string | null> {
  return (
    await request<{ nextRunAt: string | null }>(
      `/api/v1/projects/${projectId}/schedules/preview`,
      {
        method: 'POST',
        body: JSON.stringify({ recurrence, timezone }),
      },
    )
  ).nextRunAt;
}
