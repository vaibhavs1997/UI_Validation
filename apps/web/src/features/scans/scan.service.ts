import type { CreateScanRequest, Scan, ScanProgressResponse } from '@visionqa/contracts';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
async function request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`${apiUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } }); if (!response.ok) { const body = await response.json().catch(() => null) as { message?: string } | null; throw new Error(body?.message ?? 'Unable to complete scan request.'); } return response.json() as Promise<T>; }
export async function createScan(projectId: string, input: CreateScanRequest): Promise<Scan> { return (await request<{ scan: Scan }>(`/api/v1/projects/${projectId}/scans`, { method: 'POST', body: JSON.stringify(input) })).scan; }
export async function getScans(projectId: string): Promise<Scan[]> { return (await request<{ scans: Scan[] }>(`/api/v1/projects/${projectId}/scans`)).scans; }
export async function getScan(projectId: string, scanId: string): Promise<Scan> { return (await request<{ scan: Scan }>(`/api/v1/projects/${projectId}/scans/${scanId}`)).scan; }
export async function getScanProgress(projectId: string, scanId: string): Promise<ScanProgressResponse> { return request<ScanProgressResponse>(`/api/v1/projects/${projectId}/scans/${scanId}/progress`); }
export async function cancelScan(projectId: string, scanId: string): Promise<Scan> { return (await request<{ scan: Scan }>(`/api/v1/projects/${projectId}/scans/${scanId}/cancel`, { method: 'POST' })).scan; }
