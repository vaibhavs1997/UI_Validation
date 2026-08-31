import type { Issue, IssueStatus } from '@visionqa/contracts';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
async function request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`${apiUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } }); if (!response.ok) throw new Error('Unable to load issues.'); return response.json() as Promise<T>; }
export async function getIssues(projectId: string): Promise<Issue[]> { return (await request<{ issues: Issue[] }>(`/api/v1/projects/${projectId}/issues`)).issues; }
export async function getIssue(projectId: string, issueId: string): Promise<Issue> { return (await request<{ issue: Issue }>(`/api/v1/projects/${projectId}/issues/${issueId}`)).issue; }
export async function updateIssueStatus(projectId: string, issueId: string, status: IssueStatus): Promise<Issue> { return (await request<{ issue: Issue }>(`/api/v1/projects/${projectId}/issues/${issueId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })).issue; }
