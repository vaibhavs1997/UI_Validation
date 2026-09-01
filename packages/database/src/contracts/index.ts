export type UserProfile = { id: string; name: string; email: string };
export type UpsertUserProfile = {
  id: string;
  name?: string | null;
  email: string;
};
export interface UserRepository {
  findById(id: string): Promise<UserProfile | null>;
  upsertProfile(input: UpsertUserProfile): Promise<UserProfile>;
}
export type EnvironmentType =
  'production' | 'staging' | 'qa' | 'development' | 'custom';
export type Environment = {
  id: string;
  projectId?: string;
  name: string;
  type: EnvironmentType;
  baseUrl: string;
  isDefault: boolean;
};
export type Project = {
  id: string;
  name: string;
  baseUrl?: string;
  createdBy: string;
  organizationId: string | null;
  environments: Environment[];
};
export type CreateProjectInput = {
  name: string;
  baseUrl?: string;
  environmentName?: string;
  environmentType?: string;
};
export interface ProjectRepository {
  createProject(ownerId: string, input: CreateProjectInput): Promise<Project>;
  findProjectsForUser(ownerId: string): Promise<Project[]>;
  findProjectByIdForUser(
    ownerId: string,
    projectId: string,
  ): Promise<Project | null>;
  updateProject(
    ownerId: string,
    projectId: string,
    input: Partial<Pick<Project, 'name' | 'baseUrl'>>,
  ): Promise<Project | null>;
  deleteProject(ownerId: string, projectId: string): Promise<boolean>;
}
export type CreateEnvironmentInput = {
  name: string;
  type: EnvironmentType;
  baseUrl: string;
  isDefault?: boolean;
};
export type UpdateEnvironmentInput = Partial<CreateEnvironmentInput>;
export interface EnvironmentRepository {
  create(
    ownerId: string,
    projectId: string,
    input: CreateEnvironmentInput,
  ): Promise<Environment | null>;
  findByProject(
    ownerId: string,
    projectId: string,
  ): Promise<Environment[] | null>;
  findById(
    ownerId: string,
    projectId: string,
    environmentId: string,
  ): Promise<Environment | null>;
  update(
    ownerId: string,
    projectId: string,
    environmentId: string,
    input: UpdateEnvironmentInput,
  ): Promise<Environment | null>;
  delete(
    ownerId: string,
    projectId: string,
    environmentId: string,
  ): Promise<'deleted' | 'only-environment' | null>;
}
import type {
  CreateScanRequest,
  FullScanExecutionPlan,
  Project as ContractProject,
  Scan,
  ScanProgress,
  ScanStatus,
  ScanTarget,
} from '@visionqa/contracts';
import type {
  Schedule,
  ScheduleRepositoryInput,
  ScheduleRun,
  ScheduleRunStatus,
} from '@visionqa/contracts';
export interface ScanRepository {
  create(
    ownerId: string,
    project: ContractProject,
    input: CreateScanRequest & {
      target: ScanTarget;
      checks: string[];
      requestedUrls: string[];
      browsers: Scan['browsers'];
      viewports: Scan['viewports'];
      options: Scan['options'];
      idempotencyKey?: string;
    },
  ): Promise<Scan | null>;
  findById(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<Scan | null>;
  findByProject(ownerId: string, projectId: string): Promise<Scan[] | null>;
  findByIdForWorker(scanId: string): Promise<Scan | null>;
  updateStatus(
    ownerId: string,
    projectId: string,
    scanId: string,
    status: ScanStatus,
    fields?: Partial<Pick<Scan, 'failureCode' | 'failureMessage' | 'progress'>>,
  ): Promise<Scan | null>;
  markStarted(scanId: string): Promise<void>;
  updateProgress(scanId: string, progress: ScanProgress): Promise<void>;
  startCapability(scanId: string, taskKey: string): Promise<void>;
  initializeExecutionPlan(
    scanId: string,
    plan: FullScanExecutionPlan,
  ): Promise<void>;
  updateCapabilityProgress(
    scanId: string,
    taskKey: string,
    completedUnits: number,
    totalUnits?: number,
  ): Promise<void>;
  completeCapability(
    scanId: string,
    taskKey: string,
    status: 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED' | 'UNAVAILABLE',
    message?: string,
  ): Promise<void>;
  initializeBrowserInventory(
    scanId: string,
    pageTargets: import('@visionqa/contracts').ScanPageTarget[],
    totalContexts: number,
  ): Promise<void>;
  updateBrowserProgress(
    scanId: string,
    completed: number,
    failed: number,
    total: number,
  ): Promise<void>;
  reconcileFullScan(scanId: string): Promise<void>;
  isCancellationRequested(scanId: string): Promise<boolean>;
  complete(scanId: string, summary: Record<string, unknown>): Promise<void>;
  fail(
    scanId: string,
    failureCode: string,
    failureMessage: string,
  ): Promise<void>;
}
export interface ScheduleRepository {
  create(
    ownerId: string,
    projectId: string,
    input: ScheduleRepositoryInput,
  ): Promise<Schedule | null>;
  findByProject(ownerId: string, projectId: string): Promise<Schedule[] | null>;
  findById(
    ownerId: string,
    projectId: string,
    scheduleId: string,
  ): Promise<Schedule | null>;
  findByIdForScheduler(scheduleId: string): Promise<Schedule | null>;
  update(
    ownerId: string,
    projectId: string,
    scheduleId: string,
    input: Omit<Partial<ScheduleRepositoryInput>, 'nextRunAt'> & {
      enabled?: boolean;
      nextRunAt?: string | null;
      lastRunAt?: string;
      lastScanId?: string;
      lastRunStatus?: ScheduleRunStatus;
    },
  ): Promise<Schedule | null>;
  archive(
    ownerId: string,
    projectId: string,
    scheduleId: string,
  ): Promise<boolean>;
  findDue(now: string, limit: number): Promise<Schedule[]>;
  claimScheduledRun(
    scheduleId: string,
    expectedScheduledFor: string,
    nextRunAt: string | null,
    now: string,
  ): Promise<ScheduleRun | null>;
  createManualRun(
    ownerId: string,
    projectId: string,
    scheduleId: string,
    runId: string,
    now: string,
  ): Promise<ScheduleRun | null>;
  findRun(
    projectId: string,
    scheduleId: string,
    runId: string,
  ): Promise<ScheduleRun | null>;
  updateRun(
    projectId: string,
    scheduleId: string,
    runId: string,
    input: Partial<
      Pick<
        ScheduleRun,
        | 'status'
        | 'scanId'
        | 'triggeredAt'
        | 'errorCode'
        | 'errorMessage'
        | 'skipReason'
      >
    >,
  ): Promise<ScheduleRun | null>;
  listRuns(
    ownerId: string,
    projectId: string,
    scheduleId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ runs: ScheduleRun[]; nextCursor?: string } | null>;
}
export type {
  BrowserExecutionRepository,
  BrowserFactQuery,
  CustomCheckRepository,
  CustomCheckResultRepository,
  EvidenceRepository,
  IssueRepository,
  ResourceRepository,
  ReportRepository,
} from './storage.js';
