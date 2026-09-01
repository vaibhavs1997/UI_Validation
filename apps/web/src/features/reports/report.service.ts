import type { Report, ReportOptions } from '@visionqa/contracts';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Unable to complete report request.');
  }
  return response.json() as Promise<T>;
}

export async function getReports(
  projectId: string,
  query = '',
): Promise<{ reports: Report[]; nextCursor?: string }> {
  return request(
    `/api/v1/projects/${projectId}/reports${query ? `?${query}` : ''}`,
  );
}

export async function generateReport(
  projectId: string,
  scanId: string,
  options: ReportOptions,
  idempotencyKey: string,
): Promise<{ reportId: string; status: Report['status'] }> {
  return request(`/api/v1/projects/${projectId}/scans/${scanId}/reports`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(options),
  });
}

export async function getReport(
  projectId: string,
  reportId: string,
): Promise<Report> {
  return request(`/api/v1/projects/${projectId}/reports/${reportId}`);
}

export async function deleteReport(
  projectId: string,
  reportId: string,
): Promise<void> {
  await request(`/api/v1/projects/${projectId}/reports/${reportId}`, {
    method: 'DELETE',
  });
}
