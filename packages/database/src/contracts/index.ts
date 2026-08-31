export type UserProfile = { id: string; name: string; email: string };
export type UpsertUserProfile = { id: string; name?: string | null; email: string };
export interface UserRepository {
  findById(id: string): Promise<UserProfile | null>;
  upsertProfile(input: UpsertUserProfile): Promise<UserProfile>;
}
export type EnvironmentType = 'production' | 'staging' | 'qa' | 'development' | 'custom';
export type Environment = { id: string; projectId?: string; name: string; type: EnvironmentType; baseUrl: string; isDefault: boolean };
export type Project = { id: string; name: string; baseUrl: string; createdBy: string; organizationId: string | null; environments: Environment[] };
export type CreateProjectInput = { name: string; baseUrl: string; environmentName: string; environmentType: string };
export interface ProjectRepository {
  createProject(ownerId: string, input: CreateProjectInput): Promise<Project>;
  findProjectsForUser(ownerId: string): Promise<Project[]>;
  findProjectByIdForUser(ownerId: string, projectId: string): Promise<Project | null>;
  updateProject(ownerId: string, projectId: string, input: Partial<Pick<Project, 'name' | 'baseUrl'>>): Promise<Project | null>;
}
export type CreateEnvironmentInput = { name: string; type: EnvironmentType; baseUrl: string; isDefault?: boolean };
export type UpdateEnvironmentInput = Partial<CreateEnvironmentInput>;
export interface EnvironmentRepository {
  create(ownerId: string, projectId: string, input: CreateEnvironmentInput): Promise<Environment | null>;
  findByProject(ownerId: string, projectId: string): Promise<Environment[] | null>;
  findById(ownerId: string, projectId: string, environmentId: string): Promise<Environment | null>;
  update(ownerId: string, projectId: string, environmentId: string, input: UpdateEnvironmentInput): Promise<Environment | null>;
  delete(ownerId: string, projectId: string, environmentId: string): Promise<'deleted' | 'only-environment' | null>;
}
import type { CreateScanRequest, Project as ContractProject, Scan, ScanProgress, ScanStatus } from '@visionqa/contracts';
export interface ScanRepository {
  create(ownerId: string, project: ContractProject, input: CreateScanRequest & { checks: string[]; requestedUrls: string[]; browsers: Scan['browsers']; viewports: Scan['viewports']; options: Scan['options'] }): Promise<Scan | null>;
  findById(ownerId: string, projectId: string, scanId: string): Promise<Scan | null>;
  findByProject(ownerId: string, projectId: string): Promise<Scan[] | null>;
  updateStatus(ownerId: string, projectId: string, scanId: string, status: ScanStatus, fields?: Partial<Pick<Scan, 'failureCode' | 'failureMessage' | 'progress'>>): Promise<Scan | null>;
  markStarted(scanId: string): Promise<void>;
  updateProgress(scanId: string, progress: ScanProgress): Promise<void>;
  isCancellationRequested(scanId: string): Promise<boolean>;
  complete(scanId: string, summary: Record<string, unknown>): Promise<void>;
  fail(scanId: string, failureCode: string, failureMessage: string): Promise<void>;
}
export type { BrowserExecutionRepository, BrowserFactQuery, EvidenceRepository, IssueRepository, ResourceRepository } from './storage.js';
