import {
  resolveScanTarget,
  type BrowserType,
  type FullScanModuleId,
  type Project,
  type QaModule,
  type Scan,
  type Viewport,
} from '@visionqa/contracts';
import { detectorCatalog } from '@visionqa/detectors';
import type {
  BrowserScanJob,
  CrawlJob,
  HttpScanJob,
  QueueCapability,
  ScanExecutionPlan,
  ScanJobDispatcher,
} from '@visionqa/queue';

const browserDefaults: BrowserType[] = ['chromium'];
const responsiveChecks = new Set([
  'text-overlap',
  'element-overlap',
  'clipped-content',
  'horizontal-overflow',
  'viewport-overflow',
  'fixed-element-obstruction',
  'responsive-layout',
]);

function viewportsForChecks(scan: Scan, checks: string[]): Viewport[] {
  const configured = scan.viewports.length
    ? scan.viewports
    : [{ width: 1440, height: 900 }];
  const required = checks.some((check) => responsiveChecks.has(check))
    ? configured
    : configured.slice(0, 1);
  const seen = new Set<string>();
  return required.filter((viewport) => {
    const key = `${viewport.width}x${viewport.height}x${viewport.deviceScaleFactor ?? 1}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectedModules(
  scan: Scan,
): Array<{ module: FullScanModuleId; checks: string[] }> {
  if (scan.module === 'full-scan') return scan.modules ?? [];
  return [{ module: scan.module as FullScanModuleId, checks: scan.checks }];
}

function capabilityFor(check: string, scan: Scan): QueueCapability {
  if (scan.customCheckIds?.includes(check)) return 'browser';
  const metadata = detectorCatalog.find((item) => item.id === check);
  if (metadata?.requirements.crawl) return 'crawl';
  if (metadata?.requirements.browser) return 'browser';
  return 'http';
}

/** Backend-owned capability planning. The client can select checks, never workers. */
export class FullScanCapabilityPlanner {
  plan(scan: Scan): ScanExecutionPlan {
    const modules = selectedModules(scan);
    const checksByCapability = new Map<QueueCapability, string[]>();
    for (const item of modules) {
      for (const check of item.checks) {
        const capability = capabilityFor(check, scan);
        const checks = checksByCapability.get(capability) ?? [];
        if (!checks.includes(check)) checks.push(check);
        checksByCapability.set(capability, checks);
      }
    }
    const needsPageInventory =
      scan.scope !== 'single-page' &&
      (checksByCapability.has('http') || checksByCapability.has('browser'));
    if (needsPageInventory && !checksByCapability.has('crawl'))
      checksByCapability.set('crawl', ['crawl']);

    const crawlTask = checksByCapability.has('crawl')
      ? {
          key: 'crawl',
          capability: 'crawl' as const,
          checks: checksByCapability.get('crawl') ?? [],
          modules: modules
            .filter((item) =>
              item.checks.some(
                (check) => capabilityFor(check, scan) === 'crawl',
              ),
            )
            .map((item) => item.module),
          dependsOn: [] as string[],
        }
      : undefined;
    const tasks = [] as ScanExecutionPlan['tasks'];
    if (crawlTask) tasks.push(crawlTask);
    if (checksByCapability.has('http'))
      tasks.push({
        key: 'http',
        capability: 'http',
        checks: checksByCapability.get('http') ?? [],
        modules: modules
          .filter((item) =>
            item.checks.some((check) => capabilityFor(check, scan) === 'http'),
          )
          .map((item) => item.module),
        ...(crawlTask ? { dependsOn: ['crawl'] } : {}),
      });
    if (checksByCapability.has('browser')) {
      const browsers = scan.browsers.length
        ? [...new Set(scan.browsers)]
        : browserDefaults;
      const browserModules = modules
        .filter((item) =>
          item.checks.some((check) => capabilityFor(check, scan) === 'browser'),
        )
        .map((item) => item.module);
      for (const browser of browsers)
        tasks.push({
          key: `browser:${browser}`,
          capability: 'browser',
          checks: checksByCapability.get('browser') ?? [],
          modules: browserModules,
          viewports: viewportsForChecks(
            scan,
            checksByCapability.get('browser') ?? [],
          ),
          browsers: [browser],
          ...(crawlTask ? { dependsOn: ['crawl'] } : {}),
        });
    }
    return { scanId: scan.id, tasks };
  }
}

export class ScanOrchestrator {
  private readonly planner = new FullScanCapabilityPlanner();
  buildPlan(scan: Scan): ScanExecutionPlan {
    return this.planner.plan(scan);
  }

  async dispatch(
    scan: Scan,
    project: Project,
    dispatcher: ScanJobDispatcher,
  ): Promise<void> {
    const legacyUrl = scan.environmentId
      ? project.environments.find(
          (environment) => environment.id === scan.environmentId,
        )?.baseUrl
      : project.baseUrl;
    const targetUrl = resolveScanTarget(scan, legacyUrl).normalizedUrl;
    const plan = scan.executionPlan
      ? { ...this.buildPlan(scan), tasks: scan.executionPlan.tasks }
      : this.buildPlan(scan);
    for (const task of plan.tasks) {
      if (task.capability === 'crawl')
        await dispatcher.dispatchCrawl({
          scanId: scan.id,
          projectId: scan.projectId,
          ...(scan.environmentId ? { environmentId: scan.environmentId } : {}),
          targetUrl,
          checks: task.checks,
          options: scan.options,
          capability: 'crawl',
          taskKey: task.key,
        } satisfies CrawlJob);
      if (task.capability === 'http')
        await dispatcher.dispatchHttp({
          scanId: scan.id,
          projectId: scan.projectId,
          ...(scan.environmentId ? { environmentId: scan.environmentId } : {}),
          targetUrl,
          checks: task.checks,
          options: scan.options,
          capability: 'http',
          taskKey: task.key,
        } satisfies HttpScanJob);
      if (task.capability === 'browser')
        await dispatcher.dispatchBrowser({
          scanId: scan.id,
          projectId: scan.projectId,
          ...(scan.environmentId ? { environmentId: scan.environmentId } : {}),
          targetUrl,
          checks: task.checks,
          options: scan.options,
          capability: 'browser',
          module:
            scan.module === 'full-scan'
              ? 'full-scan'
              : (scan.module as QaModule),
          ...(task.modules ? { modules: task.modules } : {}),
          browsers: task.browsers ?? [scan.browsers[0] ?? 'chromium'],
          viewports: task.viewports ?? scan.viewports,
          taskKey: task.key,
        } satisfies BrowserScanJob);
    }
  }
}

export function moduleForCheck(
  scan: Scan,
  check: string,
): FullScanModuleId | undefined {
  return selectedModules(scan).find((item) => item.checks.includes(check))
    ?.module;
}
