import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  createScanTarget,
  fullScanModules,
  type CreateScanRequest,
  type FullScanExecutionPlan,
  type Project,
  type ReportBuilderSources,
  type Scan,
  type ScanProgressResponse,
} from '@visionqa/contracts';
import {
  BrowserCompatibilityComparisonService,
  detectorCatalog,
} from '@visionqa/detectors';
import type { ScanJobDispatcher } from '@visionqa/queue';
import { BullMqScanJobDispatcher } from '@visionqa/queue';
import {
  FirebaseBrowserExecutionRepository,
  FirebaseCrawlPageRepository,
  FirebaseCustomCheckRepository,
  FirebaseCustomCheckResultRepository,
  FirebaseEvidenceRepository,
  FirebaseEvidenceStorage,
  FirebaseIssueRepository,
  FirebaseResourceRepository,
  FirebaseScanRepository,
} from '@visionqa/database/firebase';
import { ProjectsService } from '../projects/projects.service.js';
import { ScanOrchestrator } from './scans.orchestrator.js';
import type { BrowserFactQuery } from '@visionqa/database/contracts';

const defaults = {
  browsers: ['chromium'] as const,
  viewports: [{ width: 1440, height: 900 }],
};
const responsiveChecks = new Set([
  'text-overlap',
  'element-overlap',
  'clipped-content',
  'horizontal-overflow',
  'viewport-overflow',
  'fixed-element-obstruction',
  'responsive-layout',
]);

@Injectable()
export class ScansService {
  private readonly scans = new FirebaseScanRepository();
  private readonly customChecks = new FirebaseCustomCheckRepository();
  private readonly customResults = new FirebaseCustomCheckResultRepository();
  private readonly crawlPages = new FirebaseCrawlPageRepository();
  private readonly resources = new FirebaseResourceRepository();
  private readonly issues = new FirebaseIssueRepository();
  private readonly browserExecutions = new FirebaseBrowserExecutionRepository();
  private readonly evidence = new FirebaseEvidenceRepository();
  private readonly evidenceStorage = new FirebaseEvidenceStorage();
  private readonly dispatcher: ScanJobDispatcher;
  private readonly orchestrator = new ScanOrchestrator();
  private readonly compatibility = new BrowserCompatibilityComparisonService();
  constructor(private readonly projects: ProjectsService) {
    this.dispatcher = new BullMqScanJobDispatcher(
      process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    );
  }

  private async context(ownerId: string, projectId: string): Promise<Project> {
    const project = await this.projects.find(ownerId, projectId);
    if (!project) throw new BadRequestException('Project not found.');
    return project;
  }
  private async normalize(
    ownerId: string,
    projectId: string,
    input: CreateScanRequest,
  ): Promise<
    CreateScanRequest & {
      target: NonNullable<Scan['target']>;
      checks: string[];
      requestedUrls: string[];
      browsers: Scan['browsers'];
      viewports: Scan['viewports'];
      options: Scan['options'];
      customCheckSnapshots?: Scan['customCheckSnapshots'];
    }
  > {
    let target;
    try {
      target = createScanTarget(input.url);
    } catch {
      throw new BadRequestException('Enter a valid HTTP or HTTPS URL.');
    }
    const modules =
      input.module === 'full-scan'
        ? (input.modules ?? []).map((item) => ({
            module: item.module,
            checks: [...new Set(item.checks)],
          }))
        : undefined;
    if (input.module === 'full-scan' && !modules?.length)
      throw new BadRequestException(
        'Select at least one module for a full scan.',
      );
    const customCheckIds = [...new Set(input.customCheckIds ?? [])];
    if (input.module === 'custom-checks' && !customCheckIds.length)
      throw new BadRequestException('Select at least one custom check.');
    if (customCheckIds.length > 25)
      throw new BadRequestException('Select no more than 25 custom checks.');
    const snapshots = [];
    for (const id of customCheckIds) {
      const check = await this.customChecks.find(ownerId, projectId, id);
      if (!check)
        throw new BadRequestException(
          'One or more selected custom checks were not found.',
        );
      snapshots.push({
        id: check.id,
        name: check.name,
        definition: check.definition,
        severity: check.severity,
        version: check.version,
      });
    }
    const checks =
      input.module === 'custom-checks'
        ? customCheckIds
        : modules
          ? [...new Set(modules.flatMap((item) => item.checks))]
          : [...new Set(input.checks ?? [])];
    if (!checks.length)
      throw new BadRequestException('Select at least one check.');
    for (const check of checks) {
      const metadata = detectorCatalog.find((item) => item.id === check);
      const module =
        modules?.find((item) => item.checks.includes(check))?.module ??
        input.module;
      if (!metadata && !customCheckIds.includes(check))
        throw new BadRequestException(
          `Check "${check}" is not supported by the selected module.`,
        );
      if (metadata && metadata.module !== module)
        throw new BadRequestException(
          `Check "${check}" is not supported by the selected module.`,
        );
    }
    const browsers = input.browsers?.length
      ? [...new Set(input.browsers)]
      : [...defaults.browsers];
    if (
      checks.some((check) => check.startsWith('browser-')) &&
      browsers.length < 2
    )
      throw new BadRequestException(
        'Select at least two browsers for compatibility comparison.',
      );
    return {
      ...input,
      target,
      scope:
        input.scope ??
        (input.module === 'crawl-site-structure' ? 'site' : 'single-page'),
      ...(modules ? { modules } : {}),
      ...(customCheckIds.length
        ? { customCheckIds, customCheckSnapshots: snapshots }
        : {}),
      checks,
      requestedUrls: [target.normalizedUrl],
      browsers,
      viewports: input.viewports?.length ? input.viewports : defaults.viewports,
      options: input.options ?? {},
    };
  }
  async validateCreateInput(
    ownerId: string,
    projectId: string,
    input: CreateScanRequest,
  ) {
    await this.context(ownerId, projectId);
    const normalized = await this.normalize(ownerId, projectId, input);
    if (normalized.module === 'full-scan') {
      const modules = normalized.modules ?? [];
      if (new Set(modules.map((item) => item.module)).size !== modules.length)
        throw new BadRequestException(
          'Each Full Scan module may be selected only once.',
        );
      if (modules.some((item) => !item.checks.length))
        throw new BadRequestException(
          'Each selected Full Scan module needs at least one check.',
        );
      if (
        (normalized.customCheckIds?.length ?? 0) > 0 &&
        !modules.some((item) => item.module === 'custom-checks')
      )
        throw new BadRequestException(
          'Custom checks must be selected through the Custom Checks module.',
        );
    }
    if (
      normalized.checks.some((check) => check.startsWith('browser-')) &&
      normalized.browsers.length < 2
    )
      throw new BadRequestException(
        'Select at least two browsers for compatibility comparison.',
      );
    if (
      normalized.checks.includes('responsive-layout') &&
      normalized.viewports.length < 2
    )
      throw new BadRequestException(
        'Select at least two viewports for responsive comparison.',
      );
    const browserChecks = normalized.checks.filter(
      (check) =>
        normalized.customCheckIds?.includes(check) ||
        detectorCatalog.find((item) => item.id === check)?.requirements.browser,
    );
    if (browserChecks.length) {
      const browserPages =
        normalized.options.maxBrowserPages ??
        normalized.options.maxPages ??
        100;
      const viewportCount = browserChecks.some((check) =>
        responsiveChecks.has(check),
      )
        ? new Set(
            normalized.viewports.map(
              (viewport) =>
                `${viewport.width}x${viewport.height}x${viewport.deviceScaleFactor ?? 1}`,
            ),
          ).size
        : 1;
      const contextCount =
        browserPages * new Set(normalized.browsers).size * viewportCount;
      const budget = normalized.options.maxTotalBrowserExecutions ?? 1000;
      if (contextCount > budget)
        throw new BadRequestException(
          `The selected browser matrix may create ${contextCount} contexts, above the configured limit of ${budget}. Reduce the page, browser, or viewport selection.`,
        );
    }
    return normalized;
  }
  async create(
    ownerId: string,
    projectId: string,
    input: CreateScanRequest,
  ): Promise<Scan> {
    const project = await this.context(ownerId, projectId);
    const normalized = await this.validateCreateInput(
      ownerId,
      projectId,
      input,
    );
    const scan = await this.scans.create(ownerId, project, normalized);
    if (!scan) throw new BadRequestException('Project not found.');
    try {
      let authoritative = scan;
      if (scan.module === 'full-scan') {
        const queuePlan = this.orchestrator.buildPlan(scan);
        const plan: FullScanExecutionPlan = {
          planVersion: 'full-scan-1',
          detectorCatalogVersion: 'catalog-1',
          target: scan.target!,
          scope: scan.scope,
          modules: scan.modules ?? [],
          browsers: scan.browsers,
          viewports: scan.viewports,
          customCheckSnapshots: scan.customCheckSnapshots ?? [],
          options: scan.options,
          capabilities: [
            ...new Set(queuePlan.tasks.map((task) => task.capability)),
          ],
          tasks: queuePlan.tasks.map((task) => ({
            ...task,
            modules: task.modules ?? [],
            status: 'PENDING',
            completedUnits: 0,
            ...(task.capability === 'browser'
              ? {
                  totalUnits: task.viewports?.length ?? scan.viewports.length,
                }
              : {}),
          })),
          createdAt: new Date().toISOString(),
        };
        await this.scans.initializeExecutionPlan(scan.id, plan);
        authoritative =
          (await this.scans.findById(ownerId, projectId, scan.id)) ?? scan;
      }
      await this.orchestrator.dispatch(authoritative, project, this.dispatcher);
      console.info(
        JSON.stringify({
          event: 'scan_created',
          scanId: scan.id,
          projectId,
          hostname: scan.target?.hostname,
          module: scan.module,
          scope: scan.scope,
        }),
      );
      return authoritative;
    } catch {
      await this.scans.updateStatus(ownerId, projectId, scan.id, 'failed', {
        failureCode: 'QUEUE_DISPATCH_FAILED',
        failureMessage: 'The scan could not be queued.',
      });
      console.error(
        JSON.stringify({
          event: 'queue_dispatch_failed',
          scanId: scan.id,
          projectId,
          module: scan.module,
        }),
      );
      throw new ServiceUnavailableException(
        'The scan could not be queued. Please ensure the scan queue is available and try again.',
      );
    }
  }
  list(ownerId: string, projectId: string): Promise<Scan[] | null> {
    return this.scans.findByProject(ownerId, projectId);
  }
  get(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<Scan | null> {
    return this.scans.findById(ownerId, projectId, scanId);
  }
  async progress(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<ScanProgressResponse | null> {
    const scan = await this.get(ownerId, projectId, scanId);
    return scan
      ? { scanId, status: scan.status, progress: scan.progress }
      : null;
  }
  async cancel(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<Scan | null> {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan) return null;
    if (
      scan.status === 'completed' ||
      scan.status === 'partial' ||
      scan.status === 'failed'
    )
      throw new BadRequestException(
        `A ${scan.status} scan cannot be cancelled.`,
      );
    if (scan.status === 'cancelled') return scan;
    const cancelled = await this.scans.updateStatus(
      ownerId,
      projectId,
      scanId,
      'cancelled',
    );
    if (cancelled)
      console.info(
        JSON.stringify({
          event: 'scan_cancelled',
          scanId,
          projectId,
          module: scan.module,
        }),
      );
    return cancelled;
  }
  pages(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: {
      status?: import('@visionqa/contracts').CrawlStatus;
      depth?: number;
      limit?: number;
      cursor?: string;
    },
  ) {
    return this.get(ownerId, projectId, scanId).then((scan) =>
      scan
        ? this.crawlPages.findByScan(ownerId, projectId, scanId, options)
        : null,
    );
  }
  summary(ownerId: string, projectId: string, scanId: string) {
    return this.get(ownerId, projectId, scanId).then((scan) =>
      scan ? this.crawlPages.summary(ownerId, projectId, scanId) : null,
    );
  }
  quality(
    ownerId: string,
    projectId: string,
    scanId: string,
    type: 'robots' | 'sitemap',
  ) {
    return this.get(ownerId, projectId, scanId).then((scan) =>
      scan
        ? this.crawlPages.getQuality(ownerId, projectId, scanId, type)
        : null,
    );
  }
  sitemapUrls(ownerId: string, projectId: string, scanId: string, limit = 100) {
    return this.get(ownerId, projectId, scanId).then((scan) =>
      scan
        ? this.crawlPages.sitemapUrls(ownerId, projectId, scanId, limit)
        : null,
    );
  }
  async comparison(ownerId: string, projectId: string, scanId: string) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan) return null;
    const [crawled, sitemap] = await Promise.all([
      this.crawlPages.allNormalizedUrls(ownerId, projectId, scanId),
      this.crawlPages.sitemapUrls(ownerId, projectId, scanId, 50000),
    ]);
    const crawlSet = new Set(crawled);
    const sitemapSet = new Set(sitemap);
    return {
      matched: sitemap.filter((url) => crawlSet.has(url)),
      crawlOnly: crawled.filter((url) => !sitemapSet.has(url)),
      sitemapOnly: sitemap.filter((url) => !crawlSet.has(url)),
    };
  }
  resourcesForScan(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: Parameters<FirebaseResourceRepository['findByScan']>[3],
  ) {
    return this.get(ownerId, projectId, scanId).then((scan) =>
      scan
        ? this.resources.findByScan(ownerId, projectId, scanId, options)
        : null,
    );
  }
  issuesForProject(
    ownerId: string,
    projectId: string,
    options?: Parameters<FirebaseIssueRepository['findByProject']>[2],
  ) {
    return this.issues.findByProject(ownerId, projectId, options);
  }
  issue(ownerId: string, projectId: string, issueId: string) {
    return this.issues.findById(ownerId, projectId, issueId);
  }
  updateIssueStatus(
    ownerId: string,
    projectId: string,
    issueId: string,
    status: import('@visionqa/contracts').IssueStatus,
  ) {
    return this.issues.updateStatus(ownerId, projectId, issueId, status);
  }
  browserPages(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: { limit?: number; cursor?: string },
  ) {
    return this.get(ownerId, projectId, scanId).then((scan) =>
      scan
        ? this.browserExecutions.findPages(ownerId, projectId, scanId, options)
        : null,
    );
  }
  browserFacts(
    ownerId: string,
    projectId: string,
    scanId: string,
    kind: import('@visionqa/contracts').BrowserFact['kind'],
    options?: BrowserFactQuery,
  ) {
    return this.get(ownerId, projectId, scanId).then((scan) =>
      scan
        ? this.browserExecutions.findFacts(
            ownerId,
            projectId,
            scanId,
            kind,
            options,
          )
        : null,
    );
  }
  async browserNetwork(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: BrowserFactQuery,
  ) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan) return null;
    const [responses, failures, blocked] = await Promise.all([
      this.browserExecutions.findFacts(
        ownerId,
        projectId,
        scanId,
        'RESPONSE',
        options,
      ),
      this.browserExecutions.findFacts(
        ownerId,
        projectId,
        scanId,
        'FAILED_REQUEST',
        options,
      ),
      this.browserExecutions.findFacts(
        ownerId,
        projectId,
        scanId,
        'NETWORK_POLICY_BLOCKED',
        options,
      ),
    ]);
    return {
      facts: [...responses.facts, ...failures.facts, ...blocked.facts].slice(
        0,
        Math.min(options?.limit ?? 100, 100),
      ),
    };
  }
  browserSummary(ownerId: string, projectId: string, scanId: string) {
    return this.get(ownerId, projectId, scanId).then((scan) =>
      scan ? this.browserExecutions.summary(ownerId, projectId, scanId) : null,
    );
  }
  browserResults(ownerId: string, projectId: string, scanId: string) {
    return Promise.all([
      this.browserPages(ownerId, projectId, scanId),
      this.browserSummary(ownerId, projectId, scanId),
    ]).then(([pages, summary]) =>
      pages && summary ? { ...pages, summary } : null,
    );
  }
  async evidenceForScan(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: { limit?: number; cursor?: string },
  ) {
    const scan = await this.get(ownerId, projectId, scanId);
    return scan
      ? this.evidence.findByScan(ownerId, projectId, scanId, options)
      : null;
  }
  async evidenceById(ownerId: string, projectId: string, evidenceId: string) {
    const record = await this.evidence.findById(ownerId, projectId, evidenceId);
    if (!record) return null;
    try {
      return {
        ...record,
        url: await this.evidenceStorage.getSignedReadUrl(record.storagePath),
      };
    } catch {
      throw new ServiceUnavailableException(
        'Evidence is temporarily unavailable.',
      );
    }
  }
  async visualFindings(
    ownerId: string,
    projectId: string,
    scanId: string,
    options: {
      detectorId?: string;
      severity?: string;
      pageUrl?: string;
      status?: import('@visionqa/contracts').IssueStatus;
      viewport?: string;
      browser?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'visual-responsive') return null;
    const result = await this.issues.findByProject(ownerId, projectId, {
      ...options,
      scanId,
      module: 'visual-responsive',
    });
    return {
      findings: result.issues,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  }
  async visualPages(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: { limit?: number; cursor?: string },
  ) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'visual-responsive') return null;
    const pages = await this.browserExecutions.findPages(
      ownerId,
      projectId,
      scanId,
      options,
    );
    const issues = await this.issues.findByProject(ownerId, projectId, {
      scanId,
      module: 'visual-responsive',
      limit: 100,
    });
    return {
      executions: pages.executions.map((execution) => ({
        executionId: execution.id,
        pageUrl: execution.pageUrl,
        browser: execution.browser,
        viewport: execution.viewport,
        status: execution.status,
        ...(execution.durationMs !== undefined
          ? { durationMs: execution.durationMs }
          : {}),
        findingsCount: issues.issues.filter(
          (issue) => issue.primaryUrl === execution.pageUrl,
        ).length,
        originalScreenshotEvidenceId: execution.screenshotEvidenceId,
      })),
      ...(pages.nextCursor ? { nextCursor: pages.nextCursor } : {}),
    };
  }
  async visualEvidence(
    ownerId: string,
    projectId: string,
    scanId: string,
    options: {
      type?: import('@visionqa/contracts').EvidenceType;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const scan = await this.get(ownerId, projectId, scanId);
    return scan?.module === 'visual-responsive'
      ? this.evidence.findByScan(ownerId, projectId, scanId, options)
      : null;
  }
  async visualSummary(ownerId: string, projectId: string, scanId: string) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'visual-responsive') return null;
    const result = await this.issues.findByProject(ownerId, projectId, {
      scanId,
      module: 'visual-responsive',
      limit: 100,
    });
    const visualChecks = [
      'text-overlap',
      'element-overlap',
      'clipped-content',
      'horizontal-overflow',
      'viewport-overflow',
      'fixed-element-obstruction',
      'responsive-layout',
    ];
    const detectors = Object.fromEntries(
      visualChecks.map((check) => [
        check,
        {
          ...(scan.checks.includes(check)
            ? {
                executed: true,
                findings: result.issues.filter(
                  (issue) => issue.detectorId === check,
                ).length,
              }
            : { executed: false }),
        },
      ]),
    );
    const byDetector = Object.fromEntries(
      visualChecks.map((check) => [
        check,
        result.issues.filter((issue) => issue.detectorId === check).length,
      ]),
    );
    const bySeverity = Object.fromEntries(
      ['critical', 'high', 'medium', 'low', 'info'].map((severity) => [
        severity,
        result.issues.filter((issue) => issue.severity === severity).length,
      ]),
    );
    return {
      scanId,
      target: scan.target,
      pagesChecked: scan.progress.completed,
      viewportsExecuted: scan.viewports.length,
      findings: result.issues.length,
      issues: result.issues.length,
      overflowPages: result.issues.filter(
        (issue) => issue.detectorId === 'horizontal-overflow',
      ).length,
      obstructions: result.issues.filter(
        (issue) => issue.detectorId === 'fixed-element-obstruction',
      ).length,
      detectors,
      byDetector,
      bySeverity,
    };
  }
  async accessibilityFindings(
    ownerId: string,
    projectId: string,
    scanId: string,
    options: {
      detectorId?: string;
      severity?: string;
      pageUrl?: string;
      ruleId?: string;
      viewport?: string;
      browser?: string;
      status?: import('@visionqa/contracts').IssueStatus;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'accessibility-seo') return null;
    const result = await this.issues.findByProject(ownerId, projectId, {
      ...options,
      scanId,
      module: 'accessibility-seo',
    });
    return {
      findings: result.issues,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  }
  async accessibilitySummary(
    ownerId: string,
    projectId: string,
    scanId: string,
  ) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'accessibility-seo') return null;
    const result = await this.issues.findByProject(ownerId, projectId, {
      scanId,
      module: 'accessibility-seo',
      limit: 100,
    });
    const checks = [
      'accessible-name',
      'form-labels',
      'image-alt',
      'heading-structure',
      'document-language',
      'duplicate-id',
      'landmark-structure',
      'keyboard-focus',
      'color-contrast',
    ];
    const byDetector = Object.fromEntries(
      checks.map((check) => [
        check,
        result.issues.filter((issue) => issue.detectorId === check).length,
      ]),
    );
    const counts = Object.fromEntries(
      ['critical', 'high', 'medium', 'low'].map((severity) => [
        severity,
        result.issues.filter((issue) => issue.severity === severity).length,
      ]),
    );
    return {
      scanId,
      pagesChecked: scan.progress.completed,
      findings: result.issues.length,
      ...counts,
      byDetector,
      detectors: Object.fromEntries(
        checks.map((check) => [
          check,
          {
            executed: scan.checks.includes(check),
            findings: byDetector[check] ?? 0,
          },
        ]),
      ),
    };
  }
  async seoFindings(
    ownerId: string,
    projectId: string,
    scanId: string,
    options: {
      detectorId?: string;
      severity?: string;
      pageUrl?: string;
      status?: import('@visionqa/contracts').IssueStatus;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'accessibility-seo') return null;
    const seo = [
      'seo-title',
      'meta-description',
      'canonical',
      'robots-meta',
      'indexability',
      'open-graph',
      'hreflang',
      'seo-heading-structure',
      'seo-image-alt',
    ];
    const result = await this.issues.findByProject(ownerId, projectId, {
      ...options,
      scanId,
      module: 'accessibility-seo',
      limit: Math.min(options.limit ?? 100, 100),
    });
    return {
      findings: result.issues.filter((issue) => seo.includes(issue.detectorId)),
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  }
  async seoSummary(ownerId: string, projectId: string, scanId: string) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'accessibility-seo') return null;
    const result = await this.seoFindings(ownerId, projectId, scanId, {
      limit: 100,
    });
    if (!result) return null;
    const byDetector = Object.fromEntries(
      [
        'seo-title',
        'meta-description',
        'canonical',
        'robots-meta',
        'indexability',
        'open-graph',
        'hreflang',
        'seo-heading-structure',
        'seo-image-alt',
      ].map((check) => [
        check,
        result.findings.filter((issue) => issue.detectorId === check).length,
      ]),
    );
    const nonIndexable = byDetector.indexability ?? 0;
    return {
      scanId,
      pagesChecked: scan.progress.completed,
      indexable: Math.max(scan.progress.completed - nonIndexable, 0),
      nonIndexable,
      missingTitles: byDetector['seo-title'] ?? 0,
      missingDescriptions: byDetector['meta-description'] ?? 0,
      canonicalIssues: byDetector.canonical ?? 0,
      metadataFindings: result.findings.length,
      byDetector,
      detectors: Object.fromEntries(
        Object.keys(byDetector).map((check) => [
          check,
          {
            executed: scan.checks.includes(check),
            findings: byDetector[check] ?? 0,
          },
        ]),
      ),
    };
  }
  async performancePages(
    ownerId: string,
    projectId: string,
    scanId: string,
    options: { limit?: number; cursor?: string } = {},
  ) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'performance-compatibility') return null;
    const pages = await this.browserExecutions.findPages(
      ownerId,
      projectId,
      scanId,
      options,
    );
    return {
      executions: pages.executions
        .filter((execution) => execution.performance)
        .map((execution) => ({
          executionId: execution.id,
          pageUrl: execution.pageUrl,
          browser: execution.browser,
          viewport: execution.viewport,
          status: execution.status,
          performance: execution.performance,
        })),
      ...(pages.nextCursor ? { nextCursor: pages.nextCursor } : {}),
    };
  }
  async performanceSummary(ownerId: string, projectId: string, scanId: string) {
    const pages = await this.performancePages(ownerId, projectId, scanId, {
      limit: 100,
    });
    if (!pages) return null;
    const snapshots = pages.executions
      .map((item) => item.performance!)
      .filter(Boolean);
    const average = (values: Array<number | null>) => {
      const available = values.filter(
        (value): value is number => value !== null,
      );
      return available.length
        ? available.reduce((sum, value) => sum + value, 0) / available.length
        : null;
    };
    return {
      pagesChecked: snapshots.length,
      averageLoadMs: average(snapshots.map((item) => item.navigation.loadMs)),
      averageLcpMs: average(snapshots.map((item) => item.webVitals.lcpMs)),
      worstLcpMs: snapshots.reduce<number | null>(
        (worst, item) =>
          item.webVitals.lcpMs === null
            ? worst
            : worst === null
              ? item.webVitals.lcpMs
              : Math.max(worst, item.webVitals.lcpMs),
        null,
      ),
      averageCls: average(snapshots.map((item) => item.webVitals.cls)),
      totalRequests: snapshots.reduce(
        (sum, item) => sum + item.network.requestCount,
        0,
      ),
      totalTransferBytes: snapshots.reduce(
        (sum, item) => sum + (item.network.transferredBytes ?? 0),
        0,
      ),
      findings: 0,
    };
  }
  async performanceResources(
    ownerId: string,
    projectId: string,
    scanId: string,
    options: {
      resourceType?: string;
      pageUrl?: string;
      browser?: string;
      slowOnly?: boolean;
      largeOnly?: boolean;
      status?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'performance-compatibility') return null;
    const pages = await this.browserExecutions.findPages(
      ownerId,
      projectId,
      scanId,
      {
        limit: Math.min(options.limit ?? 100, 100),
        ...(options.cursor ? { cursor: options.cursor } : {}),
      },
    );
    const thresholdSlow = 2000;
    const thresholdLarge = 1024 * 1024;
    const resources = pages.executions
      .flatMap((execution) =>
        (execution.performance?.resources ?? []).map((resource) => ({
          ...resource,
          pageUrl: execution.pageUrl,
          browser: execution.browser,
        })),
      )
      .filter(
        (resource) =>
          (!options.resourceType || resource.type === options.resourceType) &&
          (!options.pageUrl || resource.pageUrl.includes(options.pageUrl)) &&
          (!options.browser || resource.browser === options.browser) &&
          (!options.status ||
            String(resource.status ?? '') === options.status) &&
          (!options.slowOnly || (resource.durationMs ?? 0) > thresholdSlow) &&
          (!options.largeOnly || (resource.transferSize ?? 0) > thresholdLarge),
      )
      .slice(0, 200);
    return {
      resources: resources.map((resource) => ({
        ...resource,
        displayUrl: this.safeDisplayUrl(resource.url),
      })),
      ...(pages.nextCursor ? { nextCursor: pages.nextCursor } : {}),
    };
  }
  async performanceFindings(
    ownerId: string,
    projectId: string,
    scanId: string,
    options: {
      detectorId?: string;
      severity?: string;
      pageUrl?: string;
      browser?: string;
      status?: import('@visionqa/contracts').IssueStatus;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'performance-compatibility') return null;
    const result = await this.issues.findByProject(ownerId, projectId, {
      ...options,
      scanId,
      module: 'performance-compatibility',
    });
    return {
      findings: result.issues,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  }
  customResultsForScan(
    ownerId: string,
    projectId: string,
    scanId: string,
    options?: Parameters<FirebaseCustomCheckResultRepository['findByScan']>[3],
  ) {
    return this.get(ownerId, projectId, scanId).then((scan) =>
      scan?.module === 'custom-checks'
        ? this.customResults.findByScan(ownerId, projectId, scanId, options)
        : null,
    );
  }
  customSummary(ownerId: string, projectId: string, scanId: string) {
    return this.get(ownerId, projectId, scanId).then((scan) =>
      scan?.module === 'custom-checks'
        ? this.customResults.summary(ownerId, projectId, scanId)
        : null,
    );
  }
  customFindings(
    ownerId: string,
    projectId: string,
    scanId: string,
    options: {
      detectorId?: string;
      severity?: string;
      pageUrl?: string;
      status?: import('@visionqa/contracts').IssueStatus;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    return this.get(ownerId, projectId, scanId).then((scan) =>
      scan?.module === 'custom-checks'
        ? this.issues.findByProject(ownerId, projectId, {
            ...options,
            scanId,
            module: 'custom-checks',
          })
        : null,
    );
  }
  async compatibilityData(ownerId: string, projectId: string, scanId: string) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'performance-compatibility') return null;
    const data = await this.browserExecutions.findByScan(
      ownerId,
      projectId,
      scanId,
    );
    const requested = scan.browsers;
    const executed = [
      ...new Set(
        data.executions
          .filter((item) => item.status === 'COMPLETED')
          .map((item) => item.browser),
      ),
    ];
    const unavailable = [
      ...new Set(
        data.executions
          .filter((item) => item.status === 'UNAVAILABLE')
          .map((item) => item.browser),
      ),
    ];
    const failed = [
      ...new Set(
        data.executions
          .filter((item) => item.status === 'FAILED')
          .map((item) => item.browser),
      ),
    ];
    const completed = data.executions.filter(
      (item) => item.status === 'COMPLETED',
    );
    const findings = this.compatibility.compare(
      completed,
      data.facts,
      [],
      scan.checks,
    );
    const byDetector = Object.fromEntries(
      [
        'browser-console-differences',
        'browser-request-differences',
        'browser-render-differences',
        'browser-feature-failures',
      ].map((id) => [
        id,
        findings.filter((item) => item.detectorId === id).length,
      ]),
    );
    const byBrowser = Object.fromEntries(
      requested.map((browser) => [
        browser,
        findings.filter((item) => item.affectedBrowser === browser).length,
      ]),
    );
    const comparedKeys = new Set(
      completed.map(
        (item) =>
          `${item.pageUrl}|${item.viewport.width}x${item.viewport.height}`,
      ),
    );
    const state =
      requested.length < 2 ||
      !scan.checks.some((check) => check.startsWith('browser-'))
        ? 'NOT_COMPARED'
        : failed.length || unavailable.length
          ? 'PARTIAL'
          : executed.length < requested.length
            ? 'PARTIAL'
            : findings.length
              ? 'DIFFERENCES_FOUND'
              : 'CONSISTENT';
    return {
      summary: {
        state,
        requestedBrowsers: requested,
        executedBrowsers: executed,
        unavailableBrowsers: [...new Set([...unavailable, ...failed])],
        pagesCompared: comparedKeys.size,
        differences: findings.length,
        byDetector,
        byBrowser,
      },
      findings,
      executions: data.executions,
      facts: data.facts,
    };
  }
  async compatibilitySummary(
    ownerId: string,
    projectId: string,
    scanId: string,
  ) {
    const data = await this.compatibilityData(ownerId, projectId, scanId);
    return data?.summary ?? null;
  }
  async compatibilityBrowsers(
    ownerId: string,
    projectId: string,
    scanId: string,
  ) {
    const data = await this.compatibilityData(ownerId, projectId, scanId);
    if (!data) return null;
    return {
      browsers: data.summary.requestedBrowsers.map((browser) => {
        const executions = data.executions.filter(
          (item) => item.browser === browser,
        );
        const facts = data.facts.filter((fact) =>
          executions.some((item) => item.id === fact.executionId),
        );
        return {
          browser,
          version: executions.find((item) => item.performance?.browserVersion)
            ?.performance?.browserVersion,
          availability: data.summary.unavailableBrowsers.includes(browser)
            ? 'UNAVAILABLE'
            : executions.some((item) => item.status === 'FAILED')
              ? 'FAILED'
              : executions.some((item) => item.status === 'COMPLETED')
                ? 'EXECUTED'
                : 'REQUESTED',
          pagesExecuted: executions.filter(
            (item) => item.status === 'COMPLETED',
          ).length,
          consoleErrors: facts.filter(
            (fact) => fact.kind === 'CONSOLE' || fact.kind === 'PAGE_ERROR',
          ).length,
          failedRequests: facts.filter((fact) => fact.kind === 'FAILED_REQUEST')
            .length,
          visualSignals: executions
            .map((item) => item.visualSignals)
            .filter(Boolean),
          status: executions.some((item) => item.status === 'FAILED')
            ? 'FAILED'
            : data.summary.unavailableBrowsers.includes(browser)
              ? 'UNAVAILABLE'
              : executions.length
                ? 'EXECUTED'
                : 'NOT_SELECTED',
        };
      }),
    };
  }
  async compatibilityFindings(
    ownerId: string,
    projectId: string,
    scanId: string,
    options: {
      detectorId?: string;
      affectedBrowser?: string;
      pageUrl?: string;
      viewport?: string;
      severity?: string;
      status?: import('@visionqa/contracts').IssueStatus;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const data = await this.compatibilityData(ownerId, projectId, scanId);
    if (!data) return null;
    const result = await this.issues.findByProject(ownerId, projectId, {
      scanId,
      module: 'performance-compatibility',
      ...(options.detectorId ? { detectorId: options.detectorId } : {}),
      ...(options.affectedBrowser ? { browser: options.affectedBrowser } : {}),
      ...(options.pageUrl ? { pageUrl: options.pageUrl } : {}),
      ...(options.viewport ? { viewport: options.viewport } : {}),
      ...(options.severity ? { severity: options.severity } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
    });
    const calculated = data.findings.filter(
      (finding) =>
        (!options.detectorId || finding.detectorId === options.detectorId) &&
        (!options.affectedBrowser ||
          finding.affectedBrowser === options.affectedBrowser) &&
        (!options.pageUrl || finding.pageUrl.includes(options.pageUrl)) &&
        (!options.viewport ||
          `${finding.viewport.width}x${finding.viewport.height}` ===
            options.viewport) &&
        (!options.severity || finding.severity === options.severity),
    );
    return {
      findings: result.issues.length ? result.issues : calculated,
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
    };
  }

  async fullSummary(ownerId: string, projectId: string, scanId: string) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan || scan.module !== 'full-scan') return null;
    const [issueResult, crawl, browser] = await Promise.all([
      this.issues.findAllByScan(ownerId, projectId, scanId),
      this.crawlPages.summary(ownerId, projectId, scanId),
      this.browserExecutions.summary(ownerId, projectId, scanId),
    ]);
    const bySeverity = Object.fromEntries(
      ['critical', 'high', 'medium', 'low', 'info'].map((severity) => [
        severity,
        issueResult.filter((issue) => issue.severity === severity).length,
      ]),
    ) as Record<import('@visionqa/contracts').Severity, number>;
    const states = Object.values(scan.moduleStates ?? {});
    return {
      scan: {
        id: scan.id,
        status: scan.status,
        target: scan.target,
        scope: scan.scope,
        createdAt: scan.createdAt,
        ...(scan.startedAt ? { startedAt: scan.startedAt } : {}),
        ...(scan.completedAt ? { completedAt: scan.completedAt } : {}),
      },
      pages: {
        discovered: crawl.pagesDiscovered,
        analyzed: browser.uniquePages || crawl.pagesFetched,
        eligibleForBrowser:
          scan.fullScanProgress?.pagesEligibleForBrowser ??
          scan.browserPageTargets?.length ??
          0,
      },
      issues: { total: issueResult.length, bySeverity },
      browserExecutions: {
        planned:
          scan.fullScanProgress?.browserExecutionsPlanned ??
          browser.pagesExecuted,
        completed:
          scan.fullScanProgress?.browserExecutionsCompleted ??
          browser.pagesExecuted,
        failed: scan.fullScanProgress?.browserExecutionsFailed ?? 0,
      },
      modules: {
        selected: states.length,
        completed: states.filter((state) => state.status === 'COMPLETED')
          .length,
        partial: states.filter((state) => state.status === 'PARTIAL').length,
        failed: states.filter((state) => state.status === 'FAILED').length,
        summaries: Object.fromEntries(
          states.map((state) => [
            state.module,
            {
              status: state.status,
              checks: state.checks,
              findings: issueResult.filter(
                (issue) => issue.module === state.module,
              ).length,
            },
          ]),
        ),
      },
    };
  }

  async reportSources(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<ReportBuilderSources | null> {
    const scan = await this.get(ownerId, projectId, scanId);
    if (!scan) return null;
    const factKinds: Array<import('@visionqa/contracts').BrowserFact['kind']> = [
      'CONSOLE',
      'PAGE_ERROR',
      'RESPONSE',
      'FAILED_REQUEST',
      'NETWORK_POLICY_BLOCKED',
    ];
    const [project, issueResult, crawlResult, crawlSummary, resources, browserPages, evidence, customResults, robots, sitemapUrls, comparison, ...facts] = await Promise.all([
      this.projects.find(ownerId, projectId),
      this.issues.findAllByScan(ownerId, projectId, scanId),
      this.crawlPages.findByScan(ownerId, projectId, scanId, { limit: 200 }),
      this.crawlPages.summary(ownerId, projectId, scanId),
      this.resources.findByScan(ownerId, projectId, scanId, { limit: 200 }),
      this.browserExecutions.findPages(ownerId, projectId, scanId, { limit: 200 }),
      this.evidence.findByScan(ownerId, projectId, scanId, { limit: 100 }),
      this.customResults.findByScan(ownerId, projectId, scanId, { limit: 200 }),
      this.crawlPages.getQuality(ownerId, projectId, scanId, 'robots'),
      this.crawlPages.sitemapUrls(ownerId, projectId, scanId, 500),
      this.comparison(ownerId, projectId, scanId),
      ...factKinds.map((kind) => this.browserExecutions.findFacts(ownerId, projectId, scanId, kind, { limit: 200 })),
    ]);
    if (!project) return null;
    return {
      projectName: project.name,
      scan,
      issues: issueResult,
      crawlPages: crawlResult.pages,
      crawlSummary,
      resources: resources.resources,
      browserExecutions: browserPages.executions,
      browserFacts: facts.flatMap((result) => result.facts),
      evidence: evidence.evidence,
      customResults: customResults.results,
      customCheckSnapshots: scan.customCheckSnapshots ?? [],
      robots,
      sitemapUrls,
      ...(comparison ? { comparison } : {}),
    };
  }

  async fullModules(ownerId: string, projectId: string, scanId: string) {
    const scan = await this.get(ownerId, projectId, scanId);
    if (scan?.module !== 'full-scan') return null;
    const states = scan.moduleStates ?? {};
    return {
      modules: fullScanModules.map(
        (module) =>
          states[module] ?? {
            module,
            status: 'NOT_SELECTED' as const,
            checks: {},
            completedUnits: 0,
            percent: 0,
          },
      ),
    };
  }
  async fullProgress(ownerId: string, projectId: string, scanId: string) {
    const scan = await this.get(ownerId, projectId, scanId);
    return scan?.module === 'full-scan'
      ? {
          scanId,
          status: scan.status,
          progress: scan.fullScanProgress ?? {
            overallPercent: scan.progress.percent,
            modules: {},
            completedUnits: scan.progress.completed,
            totalUnits: scan.progress.total,
            pages: {
              discovered: scan.progress.discovered ?? 0,
              analyzed: scan.progress.processed ?? 0,
            },
          },
        }
      : null;
  }
  private safeDisplayUrl(value: string): string {
    try {
      const url = new URL(value);
      url.search = '';
      url.hash = '';
      return `${url.hostname}${url.pathname}`.slice(0, 180);
    } catch {
      return value.slice(0, 180);
    }
  }
}
