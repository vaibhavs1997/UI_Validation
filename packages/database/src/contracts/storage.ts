import type {
  BrowserFact,
  BrowserPageExecution,
  CrawlPage,
  CrawlStatus,
  CustomCheck,
  CustomCheckDefinition,
  CustomCheckResult,
  CustomCheckSummary,
  Evidence,
  EvidenceType,
  Issue,
  IssueOccurrence,
  IssueStatus,
  ResourceReference,
  ResourceType,
  Severity,
} from '@visionqa/contracts';
import type {
  Report,
  ReportListOptions,
  ReportRepositoryInput,
} from '@visionqa/contracts';
export interface CustomCheckRepository {
  create(
    ownerId: string,
    projectId: string,
    input: {
      name: string;
      description?: string;
      enabled?: boolean;
      definition: CustomCheckDefinition;
      severity: Severity;
    },
  ): Promise<CustomCheck | null>;
  list(ownerId: string, projectId: string): Promise<CustomCheck[] | null>;
  find(
    ownerId: string,
    projectId: string,
    checkId: string,
  ): Promise<CustomCheck | null>;
  update(
    ownerId: string,
    projectId: string,
    checkId: string,
    input: Partial<{
      name: string;
      description?: string;
      enabled: boolean;
      definition: CustomCheckDefinition;
      severity: Severity;
    }>,
  ): Promise<CustomCheck | null>;
  delete(ownerId: string, projectId: string, checkId: string): Promise<boolean>;
}
export interface CustomCheckResultRepository {
  create(
    input: Omit<CustomCheckResult, 'id'> & { projectId: string },
  ): Promise<CustomCheckResult>;
  findByScan(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: {
      customCheckId?: string;
      status?: CustomCheckResult['status'];
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ results: CustomCheckResult[]; nextCursor?: string }>;
  summary(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<CustomCheckSummary>;
}

export interface CrawlPageRepository {
  createDiscovered(
    page: Omit<CrawlPage, 'id' | 'discoveredAt' | 'crawlStatus'> &
      Partial<Pick<CrawlPage, 'discoveredAt'>>,
  ): Promise<CrawlPage>;
  markFetched(
    scanId: string,
    normalizedUrl: string,
    fields: Pick<
      CrawlPage,
      'statusCode' | 'contentType' | 'title' | 'durationMs' | 'redirectChain'
    >,
  ): Promise<void>;
  markFailed(
    scanId: string,
    normalizedUrl: string,
    failureCode: string,
    failureMessage: string,
  ): Promise<void>;
  markSkipped(
    scanId: string,
    normalizedUrl: string,
    reason: string,
  ): Promise<void>;
  findByScan(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: {
      status?: CrawlStatus;
      depth?: number;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ pages: CrawlPage[]; nextCursor?: string }>;
  summary(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<{
    pagesDiscovered: number;
    pagesFetched: number;
    pagesFailed: number;
    maxDepthReached: number;
    durationMs: number;
  }>;
  existsByNormalizedUrl(
    scanId: string,
    normalizedUrl: string,
  ): Promise<boolean>;
  findByScanForWorker(scanId: string): Promise<CrawlPage[]>;
}
export interface ResourceRepository {
  createMany(
    resources: Omit<ResourceReference, 'id' | 'discoveredAt'>[],
  ): Promise<void>;
  findByScan(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: {
      type?: ResourceType;
      status?: string;
      internal?: boolean;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ resources: ResourceReference[]; nextCursor?: string }>;
  findByTarget(
    scanId: string,
    normalizedTargetUrl: string,
  ): Promise<ResourceReference[]>;
  updateResult(
    scanId: string,
    normalizedTargetUrl: string,
    result: Pick<
      ResourceReference,
      | 'status'
      | 'finalUrl'
      | 'statusCode'
      | 'redirectChain'
      | 'durationMs'
      | 'errorCode'
      | 'errorMessage'
      | 'contentType'
    >,
  ): Promise<void>;
}
export interface IssueRepository {
  upsertFinding(
    input: Omit<
      Issue,
      | 'id'
      | 'firstSeenAt'
      | 'lastSeenAt'
      | 'occurrenceCount'
      | 'createdAt'
      | 'updatedAt'
      | 'status'
    > & { scanId: string; evidence: Record<string, unknown>; pageId?: string },
  ): Promise<Issue>;
  findByProject(
    ownerId: string,
    projectId: string,
    options?: {
      severity?: string;
      status?: IssueStatus;
      module?: string;
      detectorId?: string;
      ruleId?: string;
      scanId?: string;
      pageUrl?: string;
      viewport?: string;
      browser?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ issues: Issue[]; nextCursor?: string }>;
  findAllByScan(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<Issue[]>;
  reconcileCoverage(
    projectId: string,
    scanId: string,
    coverage: import('@visionqa/contracts').FullScanCoverageRecord[],
  ): Promise<void>;
  findById(
    ownerId: string,
    projectId: string,
    issueId: string,
  ): Promise<Issue | null>;
  addOccurrence(
    input: Omit<IssueOccurrence, 'id' | 'detectedAt'>,
  ): Promise<boolean>;
  attachOccurrenceEvidence(
    projectId: string,
    issueId: string,
    scanId: string,
    evidence: Record<string, unknown>,
  ): Promise<void>;
  updateStatus(
    ownerId: string,
    projectId: string,
    issueId: string,
    status: IssueStatus,
  ): Promise<Issue | null>;
}
export type StorageObject = { contentType: string; data: Buffer };
export interface EvidenceRepository {
  create(input: Omit<Evidence, 'id' | 'createdAt'>): Promise<Evidence>;
  findById(
    ownerId: string,
    projectId: string,
    evidenceId: string,
  ): Promise<Evidence | null>;
  findByScan(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: { type?: EvidenceType; limit?: number; cursor?: string },
  ): Promise<{ evidence: Evidence[]; nextCursor?: string }>;
}
export interface EvidenceStorage {
  putObject(key: string, object: StorageObject): Promise<void>;
  getSignedReadUrl(key: string): Promise<string>;
  deleteObject(key: string): Promise<void>;
}
export interface ReportRepository {
  create(
    ownerId: string,
    projectId: string,
    input: Omit<ReportRepositoryInput, 'projectId'>,
  ): Promise<Report | null>;
  findById(
    ownerId: string,
    projectId: string,
    reportId: string,
  ): Promise<Report | null>;
  list(
    ownerId: string,
    projectId: string,
    options?: ReportListOptions,
  ): Promise<{ reports: Report[]; nextCursor?: string } | null>;
  delete(ownerId: string, projectId: string, reportId: string): Promise<boolean>;
}
export interface BrowserFactQuery {
  type?: string;
  resourceType?: string;
  result?: 'SUCCESS' | 'FAILED' | 'HTTP_ERROR' | 'BLOCKED_BY_POLICY';
  statusCode?: number;
  limit?: number;
  cursor?: string;
}
export interface BrowserExecutionRepository {
  create(
    input: Omit<BrowserPageExecution, 'id' | 'startedAt'>,
  ): Promise<BrowserPageExecution>;
  markStarted(scanId: string, executionId: string): Promise<void>;
  cancelPending(scanId: string): Promise<void>;
  markCompleted(
    scanId: string,
    executionId: string,
    fields: Partial<
      Pick<
        BrowserPageExecution,
        | 'status'
        | 'finalUrl'
        | 'httpStatus'
        | 'completedAt'
        | 'durationMs'
        | 'consoleErrorCount'
        | 'pageErrorCount'
        | 'failedRequestCount'
        | 'screenshotEvidenceId'
        | 'performance'
        | 'visualSignals'
      >
    >,
  ): Promise<void>;
  addFacts(facts: Omit<BrowserFact, 'id' | 'timestamp'>[]): Promise<void>;
  findByScan(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<{ executions: BrowserPageExecution[]; facts: BrowserFact[] }>;
  findPages(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ executions: BrowserPageExecution[]; nextCursor?: string }>;
  findFacts(
    ownerId: string,
    projectId: string,
    scanId: string,
    kind: BrowserFact['kind'],
    options?: BrowserFactQuery,
  ): Promise<{ facts: BrowserFact[]; nextCursor?: string }>;
  summary(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<{
    pagesExecuted: number;
    uniquePages: number;
    consoleErrors: number;
    javascriptErrors: number;
    failedRequests: number;
    httpErrors: number;
    networkPolicyBlocked: number;
    screenshots: number;
  }>;
}
