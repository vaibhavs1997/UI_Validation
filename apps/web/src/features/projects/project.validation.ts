import type { CreateProjectRequest, EnvironmentType } from '@visionqa/contracts';

export const environmentTypes: EnvironmentType[] = ['production', 'staging', 'qa', 'development'];
export function validateProjectInput(input: CreateProjectRequest): string | null {
  if (!input.name.trim()) return 'Enter a project name.';
  try { const url = new URL(input.baseUrl); if (!['http:', 'https:'].includes(url.protocol)) return 'Use an http or https URL.'; } catch { return 'Enter a valid website URL.'; }
  if (!input.environmentName.trim()) return 'Enter an environment name.';
  return null;
}
