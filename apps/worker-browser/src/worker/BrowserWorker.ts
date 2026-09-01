import { chromium, firefox, webkit, type Browser, type Page } from 'playwright';
import { createHash } from 'node:crypto';
import type {
  BrowserFact,
  BrowserType,
  CustomCheckSnapshot,
  PerformanceSnapshot,
  Viewport,
} from '@visionqa/contracts';
import type { BrowserScanJob } from '@visionqa/queue';
import { queueNames } from '@visionqa/queue';
import { Worker, type Job } from 'bullmq';
import {
  FirebaseBrowserExecutionRepository,
  FirebaseCrawlPageRepository,
  FirebaseCustomCheckResultRepository,
  FirebaseEvidenceRepository,
  FirebaseEvidenceStorage,
  FirebaseIssueRepository,
  FirebaseScanRepository,
} from '@visionqa/database/firebase';
import {
  NetworkPolicyError,
  OutboundNetworkPolicy,
} from '@visionqa/network-policy';
import {
  analyzeAccessibilitySeo,
  analyzePerformance,
  BrowserCompatibilityComparisonService,
  classifyInteraction,
  compareVisualViewports,
  detectVisual,
  evaluateCustomCheck,
  type AccessibilityElement,
  type CustomEvaluationContext,
  type InteractionCandidate,
  type InteractionKind,
  type PageMetadataSnapshot,
} from '@visionqa/detectors';
import { renderVisualAnnotation } from '@visionqa/evidence';
import type { VisualFinding, VisualPageSnapshot } from '@visionqa/contracts';
import {
  selectBrowserPageTargets,
  targetPageTarget,
} from './site-page-selection.js';

const maxMessages = 200;
const maxMessageLength = 2000;
const profiles: Record<string, Viewport> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1366, height: 768 },
  wide: { width: 1920, height: 1080 },
};
const truncate = (value: string) => value.slice(0, maxMessageLength);
const browserFor = (type: BrowserType) =>
  type === 'firefox' ? firefox : type === 'webkit' ? webkit : chromium;
export function validateBrowserJob(job: BrowserScanJob): void {
  if (
    job.capability !== 'browser' ||
    !job.scanId ||
    !job.projectId ||
    !job.viewports.length
  )
    throw new Error('Invalid browser job.');
}

export class BrowserWorker {
  private readonly scans = new FirebaseScanRepository();
  private readonly executions = new FirebaseBrowserExecutionRepository();
  private readonly crawlPages = new FirebaseCrawlPageRepository();
  private readonly evidence = new FirebaseEvidenceStorage();
  private readonly evidenceRecords = new FirebaseEvidenceRepository();
  private readonly issues = new FirebaseIssueRepository();
  private readonly customResults = new FirebaseCustomCheckResultRepository();
  private readonly visualResults = new Map<
    string,
    Array<{
      snapshot: VisualPageSnapshot;
      findings: ReturnType<typeof detectVisual>;
    }>
  >();
  private readonly visualIssueIds = new Map<string, string>();
  private readonly compatibility = new BrowserCompatibilityComparisonService();
  private async waitForDependencies(
    scanId: string,
    taskKey: string | undefined,
  ) {
    let scan = await this.scans.findByIdForWorker(scanId);
    const dependencies =
      scan?.executionPlan?.tasks.find((task) => task.key === taskKey)
        ?.dependsOn ?? [];
    for (const dependency of dependencies) {
      for (let attempt = 0; attempt < 120; attempt++) {
        const state = scan?.capabilityStates?.[dependency];
        if (
          [
            'COMPLETED',
            'PARTIAL',
            'FAILED',
            'CANCELLED',
            'UNAVAILABLE',
          ].includes(state ?? '')
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 250));
        scan = await this.scans.findByIdForWorker(scanId);
      }
    }
    return scan;
  }
  private hasModule(job: BrowserScanJob, module: string): boolean {
    return (
      job.modules ??
      (job.module === 'full-scan'
        ? []
        : [job.module as Exclude<BrowserScanJob['module'], 'full-scan'>])
    ).includes(module as Exclude<BrowserScanJob['module'], 'full-scan'>);
  }
  async start(): Promise<void> {
    const connection = {
      url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    };
    new Worker<BrowserScanJob>(queueNames.browser, (job) => this.process(job), {
      connection,
      concurrency: Number(process.env.BROWSER_CONCURRENCY ?? 1),
    });
    console.log('VisionQA browser worker ready');
  }
  validate(job: BrowserScanJob): void {
    validateBrowserJob(job);
  }
  private viewport(input: Viewport): Viewport {
    return input.width && input.height ? input : profiles.desktop!;
  }
  async process(job: Job<BrowserScanJob>): Promise<void> {
    this.validate(job.data);
    if (await this.scans.isCancellationRequested(job.data.scanId)) return;
    const scan = await this.waitForDependencies(
      job.data.scanId,
      job.data.taskKey,
    );
    if (scan?.executionPlan)
      await this.scans.startCapability(
        job.data.scanId,
        job.data.taskKey ?? `browser:${job.data.browsers[0] ?? 'chromium'}`,
      );
    const targetUrl = scan?.target?.normalizedUrl;
    if (!targetUrl) throw new Error('Scan has no persisted target URL.');
    const pageTargets =
      scan.scope === 'single-page'
        ? [targetPageTarget(scan.target!)]
        : selectBrowserPageTargets(
            await this.crawlPages.findByScanForWorker(job.data.scanId),
            scan.target!,
            scan.scope,
            scan.options,
          );
    const taskKey =
      job.data.taskKey ?? `browser:${job.data.browsers[0] ?? 'chromium'}`;
    const dependencies =
      scan?.executionPlan?.tasks.find((item) => item.key === taskKey)
        ?.dependsOn ?? [];
    if (
      scan?.executionPlan &&
      dependencies.some(
        (dependency) =>
          ![
            'COMPLETED',
            'PARTIAL',
            'FAILED',
            'CANCELLED',
            'UNAVAILABLE',
          ].includes(scan.capabilityStates?.[dependency] ?? ''),
      )
    ) {
      await this.scans.completeCapability(
        job.data.scanId,
        taskKey,
        'FAILED',
        'A required Full Scan capability did not become ready in time.',
      );
      return;
    }
    const pageViewports = job.data.viewports;
    const totalContexts = pageTargets.length * pageViewports.length;
    if (scan.executionPlan) {
      const plannedContexts = scan.executionPlan.tasks
        .filter((item) => item.capability === 'browser')
        .reduce(
          (total, item) =>
            total +
            pageTargets.length *
              (item.viewports?.length ?? pageViewports.length),
          0,
        );
      await this.scans.initializeBrowserInventory(
        job.data.scanId,
        pageTargets,
        plannedContexts,
      );
    }
    if (!pageTargets.length) {
      if (scan.executionPlan)
        await this.scans.completeCapability(
          job.data.scanId,
          taskKey,
          'PARTIAL',
          'Crawl produced no eligible HTML pages for browser analysis.',
        );
      return;
    }
    const policy = new OutboundNetworkPolicy();
    await policy.validateAndResolve(targetUrl);
    const browserType: BrowserType = job.data.browsers[0] ?? 'chromium';
    let browser: Browser | undefined;
    try {
      for (const pageTarget of pageTargets)
        for (const requestedViewport of pageViewports)
          await this.executions.create({
            scanId: job.data.scanId,
            projectId: job.data.projectId,
            pageUrl: pageTarget.normalizedUrl,
            ...(pageTarget.crawlPageId
              ? { pageTargetId: pageTarget.crawlPageId }
              : {}),
            taskKey,
            browser: browserType,
            viewport: this.viewport(requestedViewport),
            status: 'QUEUED',
            consoleErrorCount: 0,
            pageErrorCount: 0,
            failedRequestCount: 0,
          });
      try {
        browser = await browserFor(browserType).launch({ headless: true });
      } catch (error) {
        for (const pageTarget of pageTargets)
          for (const requestedViewport of pageViewports) {
            const viewport = this.viewport(requestedViewport);
            const execution = await this.executions.create({
              scanId: job.data.scanId,
              projectId: job.data.projectId,
              pageUrl: pageTarget.normalizedUrl,
              ...(pageTarget.crawlPageId
                ? { pageTargetId: pageTarget.crawlPageId }
                : {}),
              taskKey,
              browser: browserType,
              viewport,
              status: 'UNAVAILABLE',
              consoleErrorCount: 0,
              pageErrorCount: 0,
              failedRequestCount: 0,
            });
            await this.executions.markCompleted(job.data.scanId, execution.id, {
              status: 'UNAVAILABLE',
              ...(error instanceof Error
                ? { finalUrl: truncate(error.message) }
                : {}),
            });
          }
        const current = await this.executions.findByScan(
          scan?.createdBy ?? '',
          job.data.projectId,
          job.data.scanId,
        );
        const requestedBrowsers = scan?.browsers.length
          ? scan.browsers
          : [browserType];
        if (
          requestedBrowsers.every(
            (requested) =>
              current.executions.filter(
                (item) =>
                  item.browser === requested &&
                  item.taskKey === taskKey &&
                  ['COMPLETED', 'FAILED', 'UNAVAILABLE'].includes(item.status),
              ).length >=
              pageTargets.length * pageViewports.length,
          )
        ) {
          if (scan?.executionPlan)
            await this.scans.completeCapability(
              job.data.scanId,
              job.data.taskKey ?? `browser:${browserType}`,
              'UNAVAILABLE',
            );
          else
            await this.scans.complete(job.data.scanId, {
              browsers: requestedBrowsers,
              executedBrowsers: [
                ...new Set(
                  current.executions
                    .filter((item) => item.status === 'COMPLETED')
                    .map((item) => item.browser),
                ),
              ],
              unavailableBrowsers: [
                ...new Set(
                  current.executions
                    .filter((item) => item.status === 'UNAVAILABLE')
                    .map((item) => item.browser),
                ),
              ],
            });
        }
        return;
      }
      let completed = 0;
      let failed = 0;
      for (const pageTarget of pageTargets) {
        if (await this.scans.isCancellationRequested(job.data.scanId)) {
          await this.executions.cancelPending(job.data.scanId);
          return;
        }
        try {
          await policy.validateAndResolve(pageTarget.normalizedUrl);
        } catch {
          for (const requestedViewport of pageViewports) {
            const execution = await this.executions.create({
              scanId: job.data.scanId,
              projectId: job.data.projectId,
              pageUrl: pageTarget.normalizedUrl,
              ...(pageTarget.crawlPageId
                ? { pageTargetId: pageTarget.crawlPageId }
                : {}),
              taskKey,
              browser: browserType,
              viewport: this.viewport(requestedViewport),
              status: 'RUNNING',
              consoleErrorCount: 0,
              pageErrorCount: 0,
              failedRequestCount: 0,
            });
            await this.executions.markCompleted(job.data.scanId, execution.id, {
              status: 'FAILED',
            });
            completed++;
            failed++;
          }
          if (scan?.executionPlan)
            await this.scans.updateBrowserProgress(
              job.data.scanId,
              completed,
              failed,
              totalContexts,
            );
          continue;
        }
        const pageJob = { ...job.data, targetUrl: pageTarget.normalizedUrl };
        for (const requestedViewport of pageViewports) {
          if (await this.scans.isCancellationRequested(job.data.scanId)) {
            await this.executions.cancelPending(job.data.scanId);
            return;
          }
          const viewport = this.viewport(requestedViewport);
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            ...(viewport.deviceScaleFactor
              ? { deviceScaleFactor: viewport.deviceScaleFactor }
              : {}),
          });
          const execution = await this.executions.create({
            scanId: job.data.scanId,
            projectId: job.data.projectId,
            pageUrl: pageTarget.normalizedUrl,
            ...(pageTarget.crawlPageId
              ? { pageTargetId: pageTarget.crawlPageId }
              : {}),
            taskKey,
            browser: browserType,
            viewport,
            status: 'RUNNING',
            consoleErrorCount: 0,
            pageErrorCount: 0,
            failedRequestCount: 0,
          });
          if (
            execution.status === 'COMPLETED' ||
            execution.status === 'UNAVAILABLE'
          ) {
            completed++;
            await context.close();
            continue;
          }
          await this.executions.markStarted(job.data.scanId, execution.id);
          let page: Page | undefined;
          let collecting = true;
          let consoleErrors = 0;
          let pageErrors = 0;
          let failedRequests = 0;
          const started = Date.now();
          const facts: Array<Omit<BrowserFact, 'id' | 'timestamp'>> = [];
          let performanceSnapshot: PerformanceSnapshot | undefined;
          let executionFailed = false;
          const effectiveJob = pageJob;
          try {
            await context.route('**/*', async (route) => {
              const url = route.request().url();
              if (url === 'about:blank') return route.continue();
              try {
                const parsed = new URL(url);
                if (!['http:', 'https:'].includes(parsed.protocol))
                  throw new NetworkPolicyError(
                    'Unsupported browser request protocol',
                  );
                await policy.validateAndResolve(url);
                await route.continue();
              } catch (error) {
                if (collecting)
                  facts.push({
                    scanId: job.data.scanId,
                    executionId: execution.id,
                    kind: 'NETWORK_POLICY_BLOCKED',
                    url,
                    resourceType: route.request().resourceType(),
                    message:
                      error instanceof Error
                        ? truncate(error.message)
                        : 'Request blocked by network policy',
                  });
                await route.abort('blockedbyclient');
              }
            });
            page = await context.newPage();
            page.on('console', (message) => {
              if (
                collecting &&
                message.type() === 'error' &&
                consoleErrors < maxMessages
              ) {
                consoleErrors++;
                facts.push({
                  scanId: job.data.scanId,
                  executionId: execution.id,
                  kind: 'CONSOLE',
                  type: message.type(),
                  message: truncate(message.text()),
                  source: message.location().url,
                });
              }
            });
            page.on('pageerror', (error) => {
              if (collecting && pageErrors < maxMessages) {
                pageErrors++;
                facts.push({
                  scanId: job.data.scanId,
                  executionId: execution.id,
                  kind: 'PAGE_ERROR',
                  message: truncate(error.message),
                  source: truncate(error.stack ?? ''),
                });
              }
            });
            page.on('request', (request) => {
              if (collecting && facts.length < maxMessages * 4)
                facts.push({
                  scanId: job.data.scanId,
                  executionId: execution.id,
                  kind: 'REQUEST',
                  url: request.url(),
                  type: request.method(),
                  resourceType: request.resourceType(),
                });
            });
            page.on('response', (response) => {
              if (collecting && facts.length < maxMessages * 4)
                facts.push({
                  scanId: job.data.scanId,
                  executionId: execution.id,
                  kind: 'RESPONSE',
                  url: response.url(),
                  status: response.status(),
                  resourceType: response.request().resourceType(),
                });
            });
            page.on('requestfailed', (request) => {
              if (collecting && failedRequests < maxMessages) {
                failedRequests++;
                facts.push({
                  scanId: job.data.scanId,
                  executionId: execution.id,
                  kind: 'FAILED_REQUEST',
                  url: request.url(),
                  resourceType: request.resourceType(),
                  message: truncate(
                    request.failure()?.errorText ?? 'Request failed',
                  ),
                });
              }
            });
            const response = await page.goto(pageTarget.normalizedUrl, {
              waitUntil: 'domcontentloaded',
              timeout: Number(
                process.env.BROWSER_NAVIGATION_TIMEOUT_MS ?? 30000,
              ),
            });
            if (await this.scans.isCancellationRequested(job.data.scanId)) {
              await this.executions.markCompleted(
                job.data.scanId,
                execution.id,
                {
                  status: 'CANCELLED',
                },
              );
              await this.executions.cancelPending(job.data.scanId);
              return;
            }
            if (this.hasModule(job.data, 'visual-responsive'))
              await this.persistVisualFindings(
                effectiveJob,
                await this.snapshot(
                  page,
                  job.data.scanId,
                  execution.id,
                  viewport,
                ),
              );
            if (this.hasModule(job.data, 'interactions-forms'))
              await this.runInteractions(
                effectiveJob,
                page,
                execution.id,
                viewport,
              );
            if (this.hasModule(job.data, 'accessibility-seo'))
              await this.runAccessibility(
                effectiveJob,
                page,
                execution.id,
                viewport,
              );
            if (
              this.hasModule(job.data, 'performance-compatibility') ||
              this.hasModule(job.data, 'custom-checks')
            )
              performanceSnapshot = await this.runPerformance(
                effectiveJob,
                page,
                execution.id,
                viewport,
                failedRequests,
              );
            if (this.hasModule(job.data, 'custom-checks'))
              await this.runCustomChecks(
                effectiveJob,
                page,
                execution.id,
                viewport,
                performanceSnapshot,
              );
            await page.goto(pageTarget.normalizedUrl, {
              waitUntil: 'domcontentloaded',
              timeout: Number(
                process.env.BROWSER_NAVIGATION_TIMEOUT_MS ?? 30000,
              ),
            });
            const screenshot = await page.screenshot({ fullPage: true });
            if (await this.scans.isCancellationRequested(job.data.scanId)) {
              await this.executions.markCompleted(
                job.data.scanId,
                execution.id,
                {
                  status: 'CANCELLED',
                },
              );
              await this.executions.cancelPending(job.data.scanId);
              return;
            }
            const storageKey = `projects/${job.data.projectId}/scans/${job.data.scanId}/browser/${execution.id}/${viewport.width}x${viewport.height}/screenshot.png`;
            await this.evidence.putObject(storageKey, {
              contentType: 'image/png',
              data: screenshot,
            });
            const evidence = await this.evidenceRecords.create({
              projectId: job.data.projectId,
              scanId: job.data.scanId,
              executionId: execution.id,
              type: 'SCREENSHOT',
              storagePath: storageKey,
              contentType: 'image/png',
              sizeBytes: screenshot.byteLength,
              browser: browserType,
              viewport,
              pageUrl: page.url(),
            });
            if (await this.scans.isCancellationRequested(job.data.scanId)) {
              await this.executions.markCompleted(
                job.data.scanId,
                execution.id,
                {
                  status: 'CANCELLED',
                },
              );
              await this.executions.cancelPending(job.data.scanId);
              return;
            }
            if (this.hasModule(job.data, 'visual-responsive')) {
              const visualResult = this.visualResults
                .get(`${job.data.scanId}|${effectiveJob.targetUrl}`)
                ?.find(
                  (result) => result.snapshot.executionId === execution.id,
                );
              if (visualResult)
                await this.createVisualAnnotations(
                  effectiveJob,
                  visualResult.snapshot,
                  visualResult.findings,
                  screenshot,
                  evidence.id,
                );
            }
            await this.executions.markCompleted(job.data.scanId, execution.id, {
              status: 'COMPLETED',
              finalUrl: page.url(),
              ...(response?.status() !== undefined
                ? { httpStatus: response.status() }
                : {}),
              durationMs: Date.now() - started,
              consoleErrorCount: consoleErrors,
              pageErrorCount: pageErrors,
              failedRequestCount: failedRequests,
              screenshotEvidenceId: evidence.id,
              ...(performanceSnapshot
                ? { performance: performanceSnapshot }
                : {}),
            });
          } catch {
            if (await this.scans.isCancellationRequested(job.data.scanId)) {
              await this.executions.markCompleted(
                job.data.scanId,
                execution.id,
                {
                  status: 'CANCELLED',
                },
              );
              await this.executions.cancelPending(job.data.scanId);
              return;
            }
            executionFailed = true;
            await this.executions.markCompleted(job.data.scanId, execution.id, {
              status: 'FAILED',
              durationMs: Date.now() - started,
              consoleErrorCount: consoleErrors,
              pageErrorCount: pageErrors,
              failedRequestCount: failedRequests,
            });
          } finally {
            collecting = false;
            await page?.close().catch(() => undefined);
            await context.close().catch(() => undefined);
          }
          completed++;
          if (executionFailed) failed++;
          if (await this.scans.isCancellationRequested(job.data.scanId)) {
            await this.executions.cancelPending(job.data.scanId);
            return;
          }
          await this.executions.addFacts(facts);
          await this.persistFindings(effectiveJob, facts, viewport);
          await this.scans.updateProgress(job.data.scanId, {
            completed,
            total: totalContexts,
            percent: Math.round((completed / totalContexts) * 100),
            processed: completed,
            pending: totalContexts - completed,
          });
          if (scan?.executionPlan)
            await this.scans.updateBrowserProgress(
              job.data.scanId,
              completed,
              failed,
              totalContexts,
            );
        }
      }
      if (await this.scans.isCancellationRequested(job.data.scanId)) {
        await this.executions.cancelPending(job.data.scanId);
        return;
      }
      const allExecutions = await this.executions.findByScan(
        scan?.createdBy ?? '',
        job.data.projectId,
        job.data.scanId,
      );
      const requestedBrowsers = scan?.browsers.length
        ? scan.browsers
        : [browserType];
      const browserDone = requestedBrowsers.every(
        (requested) =>
          allExecutions.executions.filter(
            (item) =>
              item.browser === requested &&
              item.taskKey === taskKey &&
              ['COMPLETED', 'FAILED', 'UNAVAILABLE'].includes(item.status),
          ).length >=
          pageTargets.length * pageViewports.length,
      );
      if (
        browserDone &&
        this.hasModule(job.data, 'performance-compatibility')
      ) {
        const compatibilityFindings = this.compatibility.compare(
          allExecutions.executions,
          allExecutions.facts,
          [],
          job.data.checks,
        );
        for (const finding of compatibilityFindings)
          await this.issues.upsertFinding({
            projectId: job.data.projectId,
            detectorId: finding.detectorId,
            module: 'performance-compatibility',
            severity: finding.severity,
            title: finding.title,
            message: finding.message,
            fingerprint: finding.fingerprint,
            primaryUrl: finding.pageUrl,
            scanId: job.data.scanId,
            evidence: {
              browser: finding.affectedBrowser,
              viewport: finding.viewport,
              comparisonBrowsers: finding.comparisonBrowsers,
              differenceType: finding.differenceType,
              normalizedSignature: finding.normalizedSignature,
            },
          });
      }
      if (browserDone) {
        if (scan?.executionPlan)
          await this.scans.completeCapability(
            job.data.scanId,
            job.data.taskKey ?? `browser:${browserType}`,
            allExecutions.executions.some(
              (item) =>
                item.browser === browserType && item.status === 'FAILED',
            )
              ? 'PARTIAL'
              : allExecutions.executions.some(
                    (item) =>
                      item.browser === browserType &&
                      item.status === 'UNAVAILABLE',
                  )
                ? 'UNAVAILABLE'
                : 'COMPLETED',
          );
        else
          await this.scans.complete(job.data.scanId, {
            pagesChecked: allExecutions.executions.filter(
              (item) => item.status === 'COMPLETED',
            ).length,
            browsers: requestedBrowsers,
            executedBrowsers: [
              ...new Set(
                allExecutions.executions
                  .filter((item) => item.status === 'COMPLETED')
                  .map((item) => item.browser),
              ),
            ],
            unavailableBrowsers: [
              ...new Set(
                allExecutions.executions
                  .filter((item) => item.status === 'UNAVAILABLE')
                  .map((item) => item.browser),
              ),
            ],
          });
      }
      for (const key of this.visualResults.keys())
        if (key.startsWith(`${job.data.scanId}|`))
          this.visualResults.delete(key);
      this.visualIssueIds.clear();
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }
  private async persistFindings(
    job: BrowserScanJob,
    facts: Array<Omit<BrowserFact, 'id' | 'timestamp'>>,
    viewport: Viewport,
  ): Promise<void> {
    const enabled = new Set(job.checks);
    const candidates = facts.filter(
      (fact) =>
        (enabled.has('console-errors') &&
          fact.kind === 'CONSOLE' &&
          fact.type === 'error') ||
        (enabled.has('javascript-errors') && fact.kind === 'PAGE_ERROR') ||
        (enabled.has('failed-browser-requests') &&
          fact.kind === 'FAILED_REQUEST') ||
        (enabled.has('http-browser-errors') &&
          fact.kind === 'RESPONSE' &&
          (fact.status ?? 0) >= 400),
    );
    for (const fact of candidates.slice(0, maxMessages * 4)) {
      if (await this.scans.isCancellationRequested(job.scanId)) return;
      const detectorId =
        fact.kind === 'CONSOLE'
          ? 'console-errors'
          : fact.kind === 'PAGE_ERROR'
            ? 'javascript-errors'
            : fact.kind === 'FAILED_REQUEST'
              ? 'failed-browser-requests'
              : 'http-browser-errors';
      const pageUrl = fact.url ?? job.targetUrl;
      await this.issues.upsertFinding({
        projectId: job.projectId,
        detectorId,
        module: 'browser-network',
        severity: detectorId === 'javascript-errors' ? 'medium' : 'low',
        title:
          detectorId === 'http-browser-errors'
            ? 'Browser HTTP error'
            : detectorId === 'failed-browser-requests'
              ? 'Browser request failed'
              : detectorId === 'javascript-errors'
                ? 'JavaScript error on page'
                : 'Console error on page',
        message: truncate(
          fact.message ??
            `Browser response returned HTTP ${fact.status ?? 'error'}.`,
        ),
        fingerprint: `${detectorId}|${pageUrl}|${fact.message ?? fact.status ?? ''}`,
        primaryUrl: pageUrl,
        scanId: job.scanId,
        evidence: {
          browser: job.browsers[0] ?? 'chromium',
          viewport,
          factKind: fact.kind,
          resourceUrl: fact.url,
          status: fact.status,
        },
      });
    }
  }
  private async createVisualAnnotations(
    job: BrowserScanJob,
    snapshot: VisualPageSnapshot,
    findings: VisualFinding[],
    screenshot: Buffer,
    sourceScreenshotEvidenceId: string,
  ): Promise<void> {
    for (const finding of findings.slice(0, 50)) {
      if (
        finding.detectorId === 'responsive-layout' ||
        (await this.scans.isCancellationRequested(job.scanId))
      )
        return;
      try {
        const rendered = await renderVisualAnnotation(
          screenshot,
          finding.elements.map((element) => ({
            ref: element.ref,
            ...element.rect,
          })),
        );
        if (!rendered.rectangles.length) continue;
        if (await this.scans.isCancellationRequested(job.scanId)) return;
        const hash = createHash('sha256')
          .update(`${snapshot.executionId}|${finding.fingerprint}`)
          .digest('hex')
          .slice(0, 40);
        const storagePath = `projects/${job.projectId}/scans/${job.scanId}/visual/${snapshot.executionId}/${hash}/annotation.png`;
        await this.evidence.putObject(storagePath, {
          contentType: rendered.contentType,
          data: rendered.image,
        });
        const annotation = await this.evidenceRecords.create({
          projectId: job.projectId,
          scanId: job.scanId,
          executionId: snapshot.executionId,
          type: 'VISUAL_ANNOTATION',
          storagePath,
          contentType: rendered.contentType,
          sizeBytes: rendered.image.byteLength,
          browser: snapshot.browser,
          viewport: snapshot.viewport,
          pageUrl: snapshot.pageUrl,
          metadata: {
            detectorId: finding.detectorId,
            findingFingerprint: finding.fingerprint,
            sourceScreenshotEvidenceId,
            elementRefs: finding.elements
              .map((element) => element.ref)
              .join(','),
            rectangles: JSON.stringify(rendered.rectangles),
            annotationStatus: 'AVAILABLE',
          },
        });
        const issueId = this.visualIssueIds.get(
          `${job.scanId}|${finding.fingerprint}`,
        );
        if (issueId)
          await this.issues.attachOccurrenceEvidence(
            job.projectId,
            issueId,
            job.scanId,
            {
              originalScreenshotEvidenceId: sourceScreenshotEvidenceId,
              annotationEvidenceId: annotation.id,
            },
          );
      } catch (error) {
        console.error(
          JSON.stringify({
            event: 'ANNOTATION_FAILED',
            scanId: job.scanId,
            executionId: snapshot.executionId,
            detectorId: finding.detectorId,
            error: error instanceof Error ? error.message : 'annotation failed',
          }),
        );
      }
    }
  }
  private async snapshot(
    page: Page,
    scanId: string,
    executionId: string,
    viewport: Viewport,
  ): Promise<VisualPageSnapshot> {
    return page.evaluate(
      ({
        scanId: currentScanId,
        executionId: currentExecutionId,
        viewport: currentViewport,
      }) => {
        const excluded = new Set([
          'SCRIPT',
          'STYLE',
          'META',
          'LINK',
          'HEAD',
          'NOSCRIPT',
        ]);
        const nodes = Array.from(document.querySelectorAll('*'))
          .filter((node) => !excluded.has(node.tagName))
          .slice(0, 1000);
        const refs = new Map<Element, string>(
          nodes.map((node, index) => [node, `e${index}`]),
        );
        const elements = nodes
          .map((node) => {
            const element = node as HTMLElement;
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const selector = element.id
              ? `#${CSS.escape(element.id)}`
              : element.tagName.toLowerCase();
            const text = (element.innerText ?? '')
              .trim()
              .replace(/\s+/g, ' ')
              .slice(0, 160);
            const points = [
              {
                x: rect.left + Math.min(rect.width / 2, 8),
                y: rect.top + Math.min(rect.height / 2, 8),
              },
              {
                x: rect.right - Math.min(rect.width / 2, 8),
                y: rect.bottom - Math.min(rect.height / 2, 8),
              },
            ];
            const paintedAboveRefs =
              style.position === 'fixed' || style.position === 'sticky'
                ? points
                    .flatMap((point) =>
                      document.elementsFromPoint(point.x, point.y),
                    )
                    .map((item) => refs.get(item))
                    .filter(
                      (ref): ref is string =>
                        Boolean(ref) && ref !== refs.get(element),
                    )
                    .slice(0, 20)
                : [];
            return {
              ref: refs.get(element)!,
              tagName: element.tagName.toLowerCase(),
              textPreview: text,
              ...(element.getAttribute('role')
                ? { role: element.getAttribute('role')! }
                : {}),
              selector,
              rect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
              display: style.display,
              visibility: style.visibility,
              position: style.position,
              overflow: style.overflow,
              overflowX: style.overflowX,
              overflowY: style.overflowY,
              zIndex: style.zIndex,
              fontSize: style.fontSize,
              lineHeight: style.lineHeight,
              whiteSpace: style.whiteSpace,
              interactive:
                /^(A|BUTTON|INPUT|SELECT|TEXTAREA|IMG|VIDEO|IFRAME)$/.test(
                  element.tagName,
                ) || Boolean(element.getAttribute('role')),
              clientWidth: element.clientWidth,
              clientHeight: element.clientHeight,
              scrollWidth: element.scrollWidth,
              scrollHeight: element.scrollHeight,
              lineClamp: style.webkitLineClamp,
              textOverflow: style.textOverflow,
              ...(paintedAboveRefs.length ? { paintedAboveRefs } : {}),
            };
          })
          .filter(
            (element) =>
              element.visibility !== 'hidden' &&
              element.display !== 'none' &&
              element.rect.width > 0 &&
              element.rect.height > 0,
          );
        return {
          scanId: currentScanId,
          executionId: currentExecutionId,
          pageUrl: location.href,
          browser: 'chromium',
          viewport: currentViewport,
          documentWidth: Math.max(
            document.documentElement.scrollWidth,
            document.body?.scrollWidth ?? 0,
          ),
          documentHeight: Math.max(
            document.documentElement.scrollHeight,
            document.body?.scrollHeight ?? 0,
          ),
          elements,
          capturedAt: new Date().toISOString(),
        };
      },
      { scanId, executionId, viewport },
    ) as Promise<VisualPageSnapshot>;
  }
  private async persistVisualFindings(
    job: BrowserScanJob,
    snapshot: VisualPageSnapshot,
  ): Promise<void> {
    const selectedSignals = job.checks.filter(
      (check) => check !== 'responsive-layout',
    );
    const findings = detectVisual(
      snapshot,
      selectedSignals.length
        ? selectedSignals
        : [
            'text-overlap',
            'element-overlap',
            'clipped-content',
            'horizontal-overflow',
            'viewport-overflow',
            'fixed-element-obstruction',
          ],
    );
    const visualKey = `${job.scanId}|${job.targetUrl}`;
    const results = this.visualResults.get(visualKey) ?? [];
    results.push({ snapshot, findings });
    this.visualResults.set(visualKey, results);
    const output = [
      ...(selectedSignals.length ? findings : []),
      ...(job.checks.includes('responsive-layout') &&
      results.length === job.viewports.length
        ? compareVisualViewports(results)
        : []),
    ];
    for (const finding of output) {
      if (await this.scans.isCancellationRequested(job.scanId)) return;
      const issue = await this.issues.upsertFinding({
        projectId: job.projectId,
        detectorId: finding.detectorId,
        module: 'visual-responsive',
        severity: finding.severity,
        title: finding.title,
        message: finding.message,
        fingerprint: finding.fingerprint,
        primaryUrl: finding.pageUrl,
        scanId: job.scanId,
        evidence: {
          executionId: snapshot.executionId,
          browser: snapshot.browser,
          viewport: snapshot.viewport,
          elements: finding.elements,
          ...(finding.detectorId === 'responsive-layout'
            ? {
                comparedViewports: results.map(
                  (result) => result.snapshot.viewport,
                ),
              }
            : {}),
        },
      });
      this.visualIssueIds.set(`${job.scanId}|${finding.fingerprint}`, issue.id);
    }
  }

  private async runInteractions(
    job: BrowserScanJob,
    page: Page,
    executionId: string,
    viewport: Viewport,
  ): Promise<void> {
    const candidates = (await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          'button, a[href], input[type="button"], input[type="submit"], input[type="reset"], [role="button"], [role="tab"], [aria-haspopup], summary',
        ),
      )
        .slice(0, 50)
        .map((node, index) => {
          const element = node as HTMLElement;
          const ref = 'interaction-' + index;
          element.setAttribute('data-visionqa-interaction-ref', ref);
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const role = element.getAttribute('role') ?? undefined;
          const type = element.getAttribute('type') ?? undefined;
          const textPreview = (
            element.innerText ||
            element.getAttribute('value') ||
            ''
          )
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 160);
          const accessibleName = (
            element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            ''
          )
            .trim()
            .slice(0, 160);
          const href = element.getAttribute('href') ?? undefined;
          const kind =
            role === 'tab'
              ? 'tabs'
              : element.tagName === 'SUMMARY'
                ? 'accordions'
                : element.tagName === 'A' &&
                    (href === '' || href === '#' || role === 'button')
                  ? 'links-as-controls'
                  : element.getAttribute('aria-haspopup')
                    ? 'menus'
                    : 'buttons';
          const point = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return {
            ref,
            selector: '[data-visionqa-interaction-ref="' + ref + '"]',
            tagName: element.tagName.toLowerCase(),
            ...(role ? { role } : {}),
            ...(type ? { type } : {}),
            textPreview,
            accessibleName,
            ...(href ? { href } : {}),
            disabled:
              'disabled' in element &&
              Boolean((element as HTMLInputElement).disabled),
            ariaDisabled: element.getAttribute('aria-disabled') === 'true',
            ...(element.getAttribute('aria-expanded')
              ? { ariaExpanded: element.getAttribute('aria-expanded')! }
              : {}),
            ...(element.getAttribute('aria-selected')
              ? { ariaSelected: element.getAttribute('aria-selected')! }
              : {}),
            ...(element.getAttribute('aria-controls')
              ? { ariaControls: element.getAttribute('aria-controls')! }
              : {}),
            visible:
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              rect.width > 0 &&
              rect.height > 0,
            covered: point !== element && !element.contains(point),
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
            kind,
          };
        }),
    )) as Array<InteractionCandidate & { kind: InteractionKind }>;
    if (job.checks.includes('basic-form-validation'))
      await this.runFormValidation(job, page, executionId, viewport);
    for (const candidate of candidates.slice(0, 20)) {
      if (await this.scans.isCancellationRequested(job.scanId)) return;
      const safety = classifyInteraction(candidate);
      const safeCandidate = { ...candidate, safety };
      if (!job.checks.includes(candidate.kind)) continue;
      if (
        !candidate.visible ||
        candidate.disabled ||
        candidate.ariaDisabled ||
        safety === 'UNKNOWN' ||
        safety === 'POTENTIALLY_DESTRUCTIVE' ||
        safety === 'DESTRUCTIVE'
      )
        continue;
      if (candidate.covered && job.checks.includes('covered-controls')) {
        await this.recordInteractionFinding(
          job,
          executionId,
          safeCandidate,
          viewport,
          'CONTROL_OBSTRUCTED',
          'The control is covered by another element and cannot be safely activated.',
        );
        continue;
      }
      const beforeUrl = page.url();
      const before = await page
        .screenshot({ fullPage: false })
        .catch(() => undefined);
      const started = Date.now();
      let failure: string | undefined;
      try {
        await page.locator(candidate.selector).click({ timeout: 3000 });
      } catch (error) {
        failure =
          error instanceof Error
            ? error.message.slice(0, 240)
            : 'Interaction failed';
      }
      const after = await page
        .screenshot({ fullPage: false })
        .catch(() => undefined);
      const afterState = await page
        .evaluate((selector) => {
          const element = document.querySelector(
            selector,
          ) as HTMLElement | null;
          return {
            url: location.href,
            expanded: element?.getAttribute('aria-expanded') ?? null,
            selected: element?.getAttribute('aria-selected') ?? null,
            dialogs: document.querySelectorAll('[role="dialog"], dialog')
              .length,
          };
        }, candidate.selector)
        .catch(() => ({
          url: page.url(),
          expanded: null,
          selected: null,
          dialogs: 0,
        }));
      const changed =
        beforeUrl !== afterState.url ||
        afterState.expanded !== (candidate.ariaExpanded ?? null) ||
        afterState.selected !== (candidate.ariaSelected ?? null) ||
        afterState.dialogs > 0;
      if (failure || !changed)
        await this.recordInteractionFinding(
          job,
          executionId,
          safeCandidate,
          viewport,
          failure ? 'INTERACTION_FAILED' : 'CONTROL_NO_OP',
          failure ??
            'The control was activated but no observable outcome was detected.',
          before,
          after,
          Date.now() - started,
          afterState,
        );
      await page
        .goto(job.targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: Number(process.env.BROWSER_NAVIGATION_TIMEOUT_MS ?? 30000),
        })
        .catch(() => undefined);
    }
  }
  private async runFormValidation(
    job: BrowserScanJob,
    page: Page,
    executionId: string,
    viewport: Viewport,
  ): Promise<void> {
    const invalidForms = await page.evaluate(() =>
      Array.from(document.querySelectorAll('form'))
        .slice(0, 20)
        .flatMap((form, index) => {
          const requiredInvalid = Array.from(
            form.querySelectorAll('[required]'),
          ).some((field) => !(field as HTMLInputElement).checkValidity());
          const emailInvalid = Array.from(
            form.querySelectorAll('input[type="email"]'),
          ).some((field) => {
            const input = field as HTMLInputElement;
            const original = input.value;
            input.value = 'not-an-email';
            const invalid = !input.checkValidity();
            input.value = original;
            return invalid;
          });
          return requiredInvalid || emailInvalid
            ? [{ index, requiredInvalid, emailInvalid }]
            : [];
        }),
    );
    for (const form of invalidForms) {
      const candidate: InteractionCandidate = {
        ref: `form-${form.index}`,
        selector: `form:nth-of-type(${form.index + 1})`,
        tagName: 'form',
        textPreview: 'Form validation',
        accessibleName: '',
        disabled: false,
        ariaDisabled: false,
        visible: true,
        covered: false,
        rect: { x: 0, y: 0, width: 0, height: 0 },
        safety: 'SAFE',
        kind: 'basic-form-validation',
      };
      await this.recordInteractionFinding(
        job,
        executionId,
        candidate,
        viewport,
        'FORM_VALIDATION',
        form.requiredInvalid
          ? 'A required field does not expose usable browser validation.'
          : 'An email field accepts an invalid value without browser validation.',
      );
    }
  }
  private async recordInteractionFinding(
    job: BrowserScanJob,
    executionId: string,
    candidate: InteractionCandidate,
    viewport: Viewport,
    detectorId: string,
    message: string,
    before?: Buffer,
    after?: Buffer,
    durationMs = 0,
    afterState?: Record<string, unknown>,
  ): Promise<void> {
    const evidence: Record<string, unknown> = {
      executionId,
      browser: job.browsers[0] ?? 'chromium',
      viewport,
      elementRef: candidate.ref,
      selector: candidate.selector,
      interactionType: candidate.kind,
      safetyClassification: candidate.safety,
      beforeState: {
        url: job.targetUrl,
        visible: candidate.visible,
        disabled: candidate.disabled,
      },
      afterState: afterState ?? {},
      durationMs,
      errorCode: detectorId,
    };
    const evidenceIds: Record<string, string> = {};
    for (const [label, data] of [
      ['before', before],
      ['after', after],
    ] as const) {
      if (!data) continue;
      const path =
        'projects/' +
        job.projectId +
        '/scans/' +
        job.scanId +
        '/interactions/' +
        executionId +
        '/' +
        candidate.ref +
        '/' +
        label +
        '.png';
      await this.evidence.putObject(path, { contentType: 'image/png', data });
      const item = await this.evidenceRecords.create({
        projectId: job.projectId,
        scanId: job.scanId,
        executionId,
        type: 'SCREENSHOT',
        storagePath: path,
        contentType: 'image/png',
        sizeBytes: data.byteLength,
        browser: job.browsers[0] ?? 'chromium',
        viewport,
        pageUrl: job.targetUrl,
        metadata: {
          interactionType: candidate.kind,
          elementRef: candidate.ref,
          evidenceRole: label,
        },
      });
      evidenceIds[label + 'EvidenceId'] = item.id;
    }
    const issue = await this.issues.upsertFinding({
      projectId: job.projectId,
      detectorId,
      module: 'interactions-forms',
      severity: detectorId === 'CONTROL_OBSTRUCTED' ? 'high' : 'medium',
      title:
        detectorId === 'CONTROL_OBSTRUCTED'
          ? 'Interactive control is obstructed'
          : detectorId === 'CONTROL_NO_OP'
            ? 'Interactive control may not work'
            : 'Interactive control failed',
      message,
      fingerprint: detectorId + '|' + job.targetUrl + '|' + candidate.ref,
      primaryUrl: job.targetUrl,
      scanId: job.scanId,
      evidence: { ...evidence, ...evidenceIds },
    });
    await this.issues.attachOccurrenceEvidence(
      job.projectId,
      issue.id,
      job.scanId,
      evidenceIds,
    );
  }
  private async runPerformance(
    job: BrowserScanJob,
    page: Page,
    executionId: string,
    viewport: Viewport,
    failedRequestCount: number,
  ): Promise<PerformanceSnapshot> {
    const snapshot = (await page.evaluate(
      ({ browser, viewport: currentViewport, failed }) => {
        const navigation = performance.getEntriesByType('navigation')[0] as
          PerformanceNavigationTiming | undefined;
        const resources = performance
          .getEntriesByType('resource')
          .slice(0, 200) as PerformanceResourceTiming[];
        const paint = performance.getEntriesByName(
          'first-contentful-paint',
        )[0] as PerformancePaintTiming | undefined;
        const lcp = performance
          .getEntriesByType('largest-contentful-paint')
          .at(-1) as PerformanceEntry | undefined;
        const shifts = performance.getEntriesByType('layout-shift') as Array<
          PerformanceEntry & { value: number; hadRecentInput?: boolean }
        >;
        return {
          pageUrl: location.href,
          browser,
          viewport: currentViewport,
          navigation: {
            ttfbMs: navigation
              ? Math.max(0, navigation.responseStart - navigation.requestStart)
              : null,
            domContentLoadedMs: navigation
              ? Math.max(
                  0,
                  navigation.domContentLoadedEventEnd - navigation.startTime,
                )
              : null,
            loadMs: navigation?.loadEventEnd
              ? Math.max(0, navigation.loadEventEnd - navigation.startTime)
              : null,
          },
          webVitals: {
            fcpMs: paint?.startTime ?? null,
            lcpMs: lcp?.startTime ?? null,
            cls: shifts.length
              ? shifts
                  .filter((entry) => !entry.hadRecentInput)
                  .reduce((total, entry) => total + entry.value, 0)
              : null,
          },
          network: {
            requestCount: resources.length,
            failedRequestCount: failed,
            transferredBytes: resources.length
              ? resources.reduce(
                  (total, entry) => total + (entry.transferSize || 0),
                  0,
                )
              : null,
            encodedBytes: resources.length
              ? resources.reduce(
                  (total, entry) => total + (entry.encodedBodySize || 0),
                  0,
                )
              : null,
          },
          resources: resources.map((entry) => ({
            url: entry.name.slice(0, 500),
            type: entry.initiatorType || 'other',
            durationMs: Number.isFinite(entry.duration) ? entry.duration : null,
            transferSize: entry.transferSize || null,
            encodedBodySize: entry.encodedBodySize || null,
            status: null,
            initiatorType: entry.initiatorType || null,
            renderBlocking:
              entry.initiatorType === 'link' ||
              entry.initiatorType === 'script',
          })),
        };
      },
      {
        browser: job.browsers[0] ?? 'chromium',
        viewport,
        failed: failedRequestCount,
      },
    )) as unknown as PerformanceSnapshot;
    for (const finding of analyzePerformance(snapshot, job.checks)) {
      if (await this.scans.isCancellationRequested(job.scanId)) return snapshot;
      await this.issues.upsertFinding({
        projectId: job.projectId,
        detectorId: finding.detectorId,
        module: 'performance-compatibility',
        severity: finding.severity,
        title: finding.title,
        message: finding.message,
        fingerprint: `${finding.detectorId}|${job.targetUrl}|${String(finding.metadata?.resourceUrl ?? '')}`,
        primaryUrl: job.targetUrl,
        scanId: job.scanId,
        evidence: {
          executionId,
          browser: snapshot.browser,
          viewport,
          ...(finding.metadata ?? {}),
        },
      });
    }
    return snapshot;
  }
  private async runCustomChecks(
    job: BrowserScanJob,
    page: Page,
    executionId: string,
    viewport: Viewport,
    performance: PerformanceSnapshot | undefined,
  ): Promise<void> {
    const scan = await this.scans.findByIdForWorker(job.scanId);
    const snapshots = (scan?.customCheckSnapshots ?? [])
      .filter((check): check is CustomCheckSnapshot =>
        job.checks.includes(check.id),
      )
      .slice(0, 25);
    if (!snapshots.length) return;
    const dom = await page.evaluate(
      (definitions) => ({
        elements: definitions.flatMap((definition, index) => {
          if (!definition.selector) return [];
          try {
            return Array.from(document.querySelectorAll(definition.selector))
              .slice(0, 100)
              .map((node, nodeIndex) => {
                const item = node as HTMLElement;
                const rect = item.getBoundingClientRect();
                const style = getComputedStyle(item);
                const attributes: Record<string, string> = {};
                for (const attribute of Array.from(item.attributes).slice(
                  0,
                  30,
                ))
                  attributes[attribute.name] = attribute.value.slice(0, 500);
                return {
                  ref: `c${index}-${nodeIndex}`,
                  selector: definition.selector!,
                  text: (item.innerText ?? item.textContent ?? '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 500),
                  visible:
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    rect.width > 0 &&
                    rect.height > 0,
                  enabled:
                    !('disabled' in item) ||
                    !(item as HTMLButtonElement).disabled,
                  attributes,
                };
              });
          } catch {
            return [];
          }
        }),
      }),
      snapshots.map((check) => check.definition),
    );
    const metadata = await page.evaluate(() => ({
      title: document.title.slice(0, 500),
      description: document
        .querySelector('meta[name="description"]')
        ?.getAttribute('content')
        ?.slice(0, 500),
      canonical: Array.from(document.querySelectorAll('link[rel="canonical"]'))
        .map((item) => item.getAttribute('href') ?? '')
        .slice(0, 5),
      lang: document.documentElement.lang.slice(0, 50),
      robots: document
        .querySelector('meta[name="robots"]')
        ?.getAttribute('content')
        ?.slice(0, 500),
      'og:title': document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute('content')
        ?.slice(0, 500),
      'og:description': document
        .querySelector('meta[property="og:description"]')
        ?.getAttribute('content')
        ?.slice(0, 500),
    }));
    const context: CustomEvaluationContext = {
      dom,
      metadata,
      ...(performance ? { performance } : {}),
      browser: {
        consoleErrorCount: 0,
        pageErrorCount: 0,
        failedRequestCount: 0,
        httpErrorCount: 0,
      },
    };
    for (const check of snapshots) {
      if (await this.scans.isCancellationRequested(job.scanId)) return;
      const evaluated = evaluateCustomCheck(
        check.definition,
        context,
        page.url(),
      );
      const actual = this.sensitive(check.definition.property)
        ? '[REDACTED]'
        : evaluated.actual;
      await this.customResults.create({
        ...evaluated,
        customCheckId: check.id,
        scanId: job.scanId,
        projectId: job.projectId,
        browser: job.browsers[0] ?? 'chromium',
        viewport,
        actual,
      });
      if (evaluated.status === 'FAIL')
        await this.issues.upsertFinding({
          projectId: job.projectId,
          detectorId: `custom-check:${check.id}`,
          module: 'custom-checks',
          severity: check.severity,
          title: check.name,
          message: truncate(evaluated.message),
          fingerprint: `custom-check:${check.id}|${page.url()}|${viewport.width}x${viewport.height}`,
          primaryUrl: page.url(),
          scanId: job.scanId,
          evidence: {
            customCheckId: check.id,
            customCheckVersion: check.version,
            actual,
            expected: evaluated.expected,
            browser: job.browsers[0] ?? 'chromium',
            viewport,
          },
        });
    }
  }
  private sensitive(value: string | undefined): boolean {
    return Boolean(
      value &&
      /(authorization|cookie|token|secret|password|api[-_]?key)/i.test(value),
    );
  }
  private async runAccessibility(
    job: BrowserScanJob,
    page: Page,
    executionId: string,
    viewport: Viewport,
  ): Promise<void> {
    if (await this.scans.isCancellationRequested(job.scanId)) return;
    const snapshot = (await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll(
          'button, a, input, select, textarea, img, [role], h1, h2, h3, h4, h5, h6, [tabindex]',
        ),
      ).slice(0, 1000);
      const refs = new Map<Element, string>(
        nodes.map((node, index) => [node, 'a' + index]),
      );
      const text = (element: Element) =>
        (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 160);
      const name = (element: Element) => {
        const labelled =
          element.getAttribute('aria-label') ||
          element.getAttribute('aria-labelledby');
        const label = labelled
          ? (document.getElementById(labelled)?.textContent ?? labelled)
          : '';
        return (
          label ||
          text(element) ||
          element.getAttribute('title') ||
          element.getAttribute('value') ||
          ''
        )
          .trim()
          .slice(0, 160);
      };
      const element = (node: Element): AccessibilityElement => {
        const item = node as HTMLElement;
        const rect = item.getBoundingClientRect();
        const style = getComputedStyle(item);
        return {
          ref: refs.get(node)!,
          tagName: item.tagName.toLowerCase(),
          ...(item.getAttribute('role')
            ? { role: item.getAttribute('role')! }
            : {}),
          ...(item.getAttribute('type')
            ? { type: item.getAttribute('type')! }
            : {}),
          text: text(item),
          name: name(item),
          ...(item.id ? { id: item.id } : {}),
          required: item.hasAttribute('required'),
          disabled:
            'disabled' in item && Boolean((item as HTMLInputElement).disabled),
          tabIndex: item.tabIndex,
          visible:
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0,
          ...(item.tagName === 'IMG' && item.hasAttribute('alt')
            ? { alt: item.getAttribute('alt') ?? '' }
            : {}),
          ...(item.getAttribute('href')
            ? { href: item.getAttribute('href')! }
            : {}),
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        };
      };
      const all = nodes.map(element);
      const controls = all.filter(
        (item) =>
          ['button', 'a', 'input', 'select', 'textarea'].includes(
            item.tagName,
          ) || item.role,
      );
      const images = all.filter((item) => item.tagName === 'img');
      const ids = new Map<string, string[]>();
      Array.from(document.querySelectorAll('[id]')).forEach((node) => {
        const id = node.id;
        ids.set(id, [...(ids.get(id) ?? []), refs.get(node) ?? 'dom']);
      });
      return {
        title: document.title,
        description:
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute('content') ?? '',
        lang: document.documentElement.getAttribute('lang') ?? '',
        canonical: Array.from(
          document.querySelectorAll('link[rel="canonical"]'),
        )
          .map((item) => item.getAttribute('href') ?? '')
          .slice(0, 5),
        robots:
          document
            .querySelector('meta[name="robots"], meta[name="googlebot"]')
            ?.getAttribute('content') ?? '',
        openGraph: Object.fromEntries(
          Array.from(document.querySelectorAll('meta[property^="og:"]'))
            .slice(0, 10)
            .map((item) => [
              item.getAttribute('property')!,
              item.getAttribute('content') ?? '',
            ]),
        ),
        hreflang: Array.from(
          document.querySelectorAll('link[rel="alternate"][hreflang]'),
        )
          .slice(0, 20)
          .map((item) => ({
            lang: item.getAttribute('hreflang') ?? '',
            href: item.getAttribute('href') ?? '',
          })),
        headings: Array.from(
          document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]'),
        )
          .slice(0, 100)
          .map((item) => ({
            ref: refs.get(item) ?? 'heading',
            level:
              Number(
                item.getAttribute('aria-level') ?? item.tagName.substring(1),
              ) || 0,
            text: text(item),
          })),
        duplicateIds: Array.from(ids.entries())
          .filter(([, values]) => values.length > 1)
          .map(([id, refsForId]) => ({ id, refs: refsForId.slice(0, 10) }))
          .slice(0, 50),
        landmarks: {
          main: document.querySelectorAll('main,[role="main"]').length,
          navigation: document.querySelectorAll('nav,[role="navigation"]')
            .length,
          banner: document.querySelectorAll('header,[role="banner"]').length,
          contentinfo: document.querySelectorAll('footer,[role="contentinfo"]')
            .length,
        },
        elements: all[0]!,
        images,
        controls,
      };
    })) as PageMetadataSnapshot;
    const findings = analyzeAccessibilitySeo(snapshot, job.checks);
    for (const finding of findings) {
      if (await this.scans.isCancellationRequested(job.scanId)) return;
      await this.issues.upsertFinding({
        projectId: job.projectId,
        detectorId: finding.detectorId,
        module: 'accessibility-seo',
        severity: finding.severity,
        title: finding.title,
        message: finding.message,
        fingerprint:
          finding.detectorId +
          '|' +
          job.targetUrl +
          '|' +
          (finding.elementRef ?? 'page'),
        primaryUrl: job.targetUrl,
        scanId: job.scanId,
        evidence: {
          executionId,
          browser: job.browsers[0] ?? 'chromium',
          viewport,
          ...(finding.elementRef ? { elementRef: finding.elementRef } : {}),
          ...(finding.ruleId ? { ruleId: finding.ruleId } : {}),
          ...(finding.metadata ?? {}),
        },
      });
    }
  }
}
