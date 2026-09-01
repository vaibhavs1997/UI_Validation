import type { CreateCustomCheckRequest, CreateEnvironmentRequest, CreateProjectRequest, CustomCheck, Environment, Project, ProjectsResponse, UpdateCustomCheckRequest, UpdateEnvironmentRequest } from '@visionqa/contracts';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired.' : 'Unable to load project data.');
  return response.json() as Promise<T>;
}

export async function getProjects(): Promise<Project[]> { return (await request<ProjectsResponse>('/api/v1/projects')).projects; }
export async function createProject(input: CreateProjectRequest): Promise<Project> { return (await request<{ project: Project }>('/api/v1/projects', { method: 'POST', body: JSON.stringify(input) })).project; }
export async function updateProject(projectId: string, input: { name: string }): Promise<Project> { return (await request<{ project: Project }>(`/api/v1/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(input) })).project; }
export async function deleteProject(projectId: string): Promise<void> { await request<{ deleted: true }>(`/api/v1/projects/${projectId}`, { method: 'DELETE' }); }
export async function createEnvironment(projectId: string, input: CreateEnvironmentRequest): Promise<Environment> { return (await request<{ environment: Environment }>(`/api/v1/projects/${projectId}/environments`, { method: 'POST', body: JSON.stringify(input) })).environment; }
export async function updateEnvironment(projectId: string, environmentId: string, input: UpdateEnvironmentRequest): Promise<Environment> { return (await request<{ environment: Environment }>(`/api/v1/projects/${projectId}/environments/${environmentId}`, { method: 'PATCH', body: JSON.stringify(input) })).environment; }
export async function deleteEnvironment(projectId: string, environmentId: string): Promise<void> { await request<{ deleted: true }>(`/api/v1/projects/${projectId}/environments/${environmentId}`, { method: 'DELETE' }); }
export async function getCustomChecks(projectId: string): Promise<CustomCheck[]> { return (await request<{ checks: CustomCheck[] }>(`/api/v1/projects/${projectId}/custom-checks`)).checks; }
export async function createCustomCheck(projectId: string, input: CreateCustomCheckRequest): Promise<CustomCheck> { return (await request<{ check: CustomCheck }>(`/api/v1/projects/${projectId}/custom-checks`, { method: 'POST', body: JSON.stringify(input) })).check; }
export async function updateCustomCheck(projectId: string, checkId: string, input: UpdateCustomCheckRequest): Promise<CustomCheck> { return (await request<{ check: CustomCheck }>(`/api/v1/projects/${projectId}/custom-checks/${checkId}`, { method: 'PATCH', body: JSON.stringify(input) })).check; }
export async function deleteCustomCheck(projectId: string, checkId: string): Promise<void> { await request<{ deleted: true }>(`/api/v1/projects/${projectId}/custom-checks/${checkId}`, { method: 'DELETE' }); }
