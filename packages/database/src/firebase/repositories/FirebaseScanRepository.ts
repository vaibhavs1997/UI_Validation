import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { createHash, randomUUID } from 'node:crypto';
import {
  resolveScanTarget,
  type CreateScanRequest,
  deriveFullScanStatus,
  type FullScanExecutionPlan,
  type Project,
  type Scan,
  type ScanStatus,
} from '@visionqa/contracts';
import type { FullScanCoverageRecord } from '@visionqa/contracts';
import type { ScanRepository } from '../../contracts/index.js';
import { getFirestoreDb } from '../firebase-admin.js';
import { FirebaseIssueRepository } from './FirebaseIssueRepository.js';

function iso(value: unknown): string | undefined {
  return value && typeof (value as Timestamp).toDate === 'function'
    ? (value as Timestamp).toDate().toISOString()
    : typeof value === 'string'
      ? value
      : undefined;
}
function mapScan(id: string, data: Record<string, unknown>): Scan {
  return {
    id,
    projectId: String(data.projectId),
    ...(typeof data.environmentId === 'string'
      ? { environmentId: data.environmentId }
      : {}),
    createdBy: String(data.createdBy),
    ...(data.target && typeof data.target === 'object'
      ? { target: data.target as NonNullable<Scan['target']> }
      : {}),
    scope: (data.scope ?? 'site') as NonNullable<Scan['scope']>,
    type: data.type === 'full' ? 'full' : 'module',
    module: data.module as Scan['module'],
    checks: Array.isArray(data.checks) ? data.checks.map(String) : [],
    ...(Array.isArray(data.customCheckIds)
      ? { customCheckIds: data.customCheckIds.map(String) }
      : {}),
    ...(Array.isArray(data.customCheckSnapshots)
      ? {
          customCheckSnapshots:
            data.customCheckSnapshots as Scan['customCheckSnapshots'],
        }
      : {}),
    ...(data.triggerSource === 'SCHEDULE' || data.triggerSource === 'MANUAL'
      ? { triggerSource: data.triggerSource }
      : {}),
    ...(typeof data.scheduleId === 'string'
      ? { scheduleId: data.scheduleId }
      : {}),
    ...(typeof data.scheduleRunId === 'string'
      ? { scheduleRunId: data.scheduleRunId }
      : {}),
    ...(typeof data.idempotencyKey === 'string'
      ? { idempotencyKey: data.idempotencyKey }
      : {}),
    ...(Array.isArray(data.modules)
      ? { modules: data.modules as NonNullable<Scan['modules']> }
      : {}),
    ...(data.executionPlan && typeof data.executionPlan === 'object'
      ? {
          executionPlan: data.executionPlan as NonNullable<
            Scan['executionPlan']
          >,
        }
      : {}),
    ...(data.moduleStates && typeof data.moduleStates === 'object'
      ? { moduleStates: data.moduleStates as NonNullable<Scan['moduleStates']> }
      : {}),
    ...(data.capabilityStates && typeof data.capabilityStates === 'object'
      ? {
          capabilityStates: data.capabilityStates as NonNullable<
            Scan['capabilityStates']
          >,
        }
      : {}),
    ...(data.checkStates && typeof data.checkStates === 'object'
      ? { checkStates: data.checkStates as NonNullable<Scan['checkStates']> }
      : {}),
    ...(data.fullScanProgress && typeof data.fullScanProgress === 'object'
      ? {
          fullScanProgress: data.fullScanProgress as NonNullable<
            Scan['fullScanProgress']
          >,
        }
      : {}),
    ...(Array.isArray(data.browserPageTargets)
      ? {
          browserPageTargets: data.browserPageTargets as NonNullable<
            Scan['browserPageTargets']
          >,
        }
      : {}),
    requestedUrls: Array.isArray(data.requestedUrls)
      ? data.requestedUrls.map(String)
      : [],
    viewports: Array.isArray(data.viewports)
      ? (data.viewports as Scan['viewports'])
      : [],
    browsers: Array.isArray(data.browsers)
      ? (data.browsers as Scan['browsers'])
      : [],
    options: (data.options ?? {}) as Scan['options'],
    status: data.status as Scan['status'],
    progress: (data.progress ?? {
      completed: 0,
      total: 1,
      percent: 0,
    }) as Scan['progress'],
    createdAt: iso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(data.updatedAt) ?? new Date(0).toISOString(),
    ...(iso(data.startedAt) ? { startedAt: iso(data.startedAt) } : {}),
    ...(iso(data.completedAt) ? { completedAt: iso(data.completedAt) } : {}),
    ...(iso(data.cancelledAt) ? { cancelledAt: iso(data.cancelledAt) } : {}),
    ...(iso(data.cancellationRequestedAt)
      ? { cancellationRequestedAt: iso(data.cancellationRequestedAt) }
      : {}),
    ...(typeof data.failureCode === 'string'
      ? { failureCode: data.failureCode }
      : {}),
    ...(typeof data.failureMessage === 'string'
      ? { failureMessage: data.failureMessage }
      : {}),
  };
}
function pageTargetsCount(data: Record<string, unknown>): number {
  return Array.isArray(data.browserPageTargets)
    ? data.browserPageTargets.length
    : 0;
}

export class FirebaseScanRepository implements ScanRepository {
  private project(projectId: string) {
    return getFirestoreDb().collection('projects').doc(projectId);
  }
  private scans(projectId: string) {
    return this.project(projectId).collection('scans');
  }
  private async owns(ownerId: string, projectId: string): Promise<boolean> {
    const snapshot = await this.project(projectId).get();
    return snapshot.exists && snapshot.data()?.createdBy === ownerId;
  }
  private async mapWithLegacyTarget(
    id: string,
    data: Record<string, unknown>,
  ): Promise<Scan> {
    const scan = mapScan(id, data);
    if (scan.target || !scan.environmentId) return scan;
    const projectId = scan.projectId;
    const projectSnapshot = await this.project(projectId).get();
    const projectData = projectSnapshot.data() ?? {};
    const environments = Array.isArray(projectData.environments)
      ? (projectData.environments as Array<Record<string, unknown>>)
      : [];
    const environment = environments.find(
      (item) => item.id === scan.environmentId,
    );
    const legacyUrl =
      typeof environment?.baseUrl === 'string'
        ? environment.baseUrl
        : typeof projectData.baseUrl === 'string'
          ? projectData.baseUrl
          : undefined;
    if (!legacyUrl) return scan;
    try {
      return { ...scan, target: resolveScanTarget(scan, legacyUrl) };
    } catch {
      return scan;
    }
  }
  async create(
    ownerId: string,
    project: Project,
    input: CreateScanRequest & {
      target: NonNullable<Scan['target']>;
      checks: string[];
      requestedUrls: string[];
      browsers: Scan['browsers'];
      viewports: Scan['viewports'];
      options: Scan['options'];
      customCheckSnapshots?: Scan['customCheckSnapshots'];
    },
  ): Promise<Scan | null> {
    if (!(await this.owns(ownerId, project.id))) return null;
    const ref = this.scans(project.id).doc(
      input.idempotencyKey
        ? `scheduled-${createHash('sha256').update(input.idempotencyKey).digest('hex')}`
        : randomUUID(),
    );
    const existing = await ref.get();
    if (existing.exists) return mapScan(ref.id, existing.data()!);
    const now = FieldValue.serverTimestamp();
    await ref.set({
      id: ref.id,
      projectId: project.id,
      target: input.target,
      scope: input.scope ?? 'single-page',
      createdBy: ownerId,
      type: input.module === 'full-scan' ? 'full' : 'module',
      module: input.module,
      checks: input.checks,
      ...(input.customCheckIds?.length
        ? { customCheckIds: input.customCheckIds }
        : {}),
      ...(input.customCheckSnapshots?.length
        ? { customCheckSnapshots: input.customCheckSnapshots }
        : {}),
      ...(input.modules ? { modules: input.modules } : {}),
      ...(input.triggerSource ? { triggerSource: input.triggerSource } : {}),
      ...(input.scheduleId ? { scheduleId: input.scheduleId } : {}),
      ...(input.scheduleRunId ? { scheduleRunId: input.scheduleRunId } : {}),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      requestedUrls: input.requestedUrls,
      viewports: input.viewports,
      browsers: input.browsers,
      options: input.options,
      status: 'queued',
      progress: { completed: 0, total: 1, percent: 0 },
      createdAt: now,
      updatedAt: now,
    });
    const created = await ref.get();
    return mapScan(ref.id, created.data()!);
  }
  async findById(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<Scan | null> {
    if (!(await this.owns(ownerId, projectId))) return null;
    const snapshot = await this.scans(projectId).doc(scanId).get();
    return snapshot.exists
      ? this.mapWithLegacyTarget(scanId, snapshot.data()!)
      : null;
  }
  async findByProject(
    ownerId: string,
    projectId: string,
  ): Promise<Scan[] | null> {
    if (!(await this.owns(ownerId, projectId))) return null;
    const snapshot = await this.scans(projectId)
      .orderBy('createdAt', 'desc')
      .get();
    return Promise.all(
      snapshot.docs.map((doc) => this.mapWithLegacyTarget(doc.id, doc.data())),
    );
  }
  async findByIdForWorker(scanId: string): Promise<Scan | null> {
    const snapshot = await getFirestoreDb()
      .collectionGroup('scans')
      .where('id', '==', scanId)
      .limit(1)
      .get();
    return snapshot.empty
      ? null
      : this.mapWithLegacyTarget(scanId, snapshot.docs[0]!.data());
  }
  async updateStatus(
    ownerId: string,
    projectId: string,
    scanId: string,
    status: ScanStatus,
    fields: Partial<
      Pick<Scan, 'failureCode' | 'failureMessage' | 'progress'>
    > = {},
  ): Promise<Scan | null> {
    if (!(await this.owns(ownerId, projectId))) return null;
    const ref = this.scans(projectId).doc(scanId);
    const current = await ref.get();
    if (!current.exists) return null;
    if (current.data()?.status === 'cancelled' && status !== 'cancelled')
      return mapScan(scanId, current.data()!);
    await ref.set(
      {
        status,
        ...fields,
        ...(status === 'cancelled'
          ? { cancelledAt: FieldValue.serverTimestamp() }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    const updated = await ref.get();
    return mapScan(scanId, updated.data()!);
  }
  async markStarted(scanId: string): Promise<void> {
    const projects = await getFirestoreDb()
      .collectionGroup('scans')
      .where('id', '==', scanId)
      .limit(1)
      .get();
    if (projects.empty) return;
    if (
      ['cancelled', 'completed', 'partial', 'failed'].includes(
        String(projects.docs[0]!.data()?.status),
      )
    )
      return;
    await projects.docs[0]!.ref.set(
      {
        status: 'running',
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  private async byId(scanId: string) {
    const snapshots = await getFirestoreDb()
      .collectionGroup('scans')
      .where('id', '==', scanId)
      .limit(1)
      .get();
    return snapshots.empty ? null : snapshots.docs[0]!.ref;
  }
  async initializeExecutionPlan(
    scanId: string,
    plan: FullScanExecutionPlan,
  ): Promise<void> {
    const ref = await this.byId(scanId);
    if (!ref) return;
    const moduleStates = Object.fromEntries(
      plan.modules.map((item) => [
        item.module,
        {
          module: item.module,
          status: 'PENDING',
          checks: Object.fromEntries(
            item.checks.map((check) => [check, 'REQUESTED']),
          ),
          completedUnits: 0,
          percent: 0,
          totalUnits: undefined,
        },
      ]),
    );
    const capabilityStates = Object.fromEntries(
      plan.tasks.map((task) => [task.key, 'PENDING']),
    );
    const checkStates = Object.fromEntries(
      plan.modules.flatMap((item) =>
        item.checks.map((check) => [check, 'REQUESTED']),
      ),
    );
    await ref.set(
      {
        executionPlan: plan,
        moduleStates,
        capabilityStates,
        checkStates,
        fullScanProgress: {
          overallPercent: 0,
          stage: 'DISCOVERY',
          modules: Object.fromEntries(
            plan.modules.map((item) => [
              item.module,
              { status: 'PENDING', completedUnits: 0, percent: 0 },
            ]),
          ),
          completedUnits: 0,
          totalUnits: Math.max(plan.tasks.length, 1),
          pages: { discovered: 0, analyzed: 0 },
        },
      },
      { merge: true },
    );
  }

  async startCapability(scanId: string, taskKey: string): Promise<void> {
    const ref = await this.byId(scanId);
    if (!ref) return;
    const snapshot = await ref.get();
    if (
      ['cancelled', 'completed', 'partial', 'failed'].includes(
        String(snapshot.data()?.status),
      )
    )
      return;
    const states = {
      ...((snapshot.data()?.capabilityStates ?? {}) as Record<string, string>),
      [taskKey]: 'RUNNING',
    };
    await ref.set(
      {
        status: 'running',
        capabilityStates: states,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  async updateProgress(
    scanId: string,
    progress: Scan['progress'],
  ): Promise<void> {
    const ref = await this.byId(scanId);
    if (!ref) return;
    const current = mapScan(scanId, (await ref.get()).data()!);
    if (current.status === 'cancelled') return;
    const merged = {
      ...progress,
      completed: Math.max(current.progress.completed, progress.completed),
      percent: Math.max(current.progress.percent, progress.percent),
      ...(progress.overallPercent !== undefined
        ? {
            overallPercent: Math.max(
              current.progress.overallPercent ?? 0,
              progress.overallPercent,
            ),
          }
        : {}),
    };
    await ref.set(
      { progress: merged, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  async updateCapabilityProgress(
    scanId: string,
    taskKey: string,
    completedUnits: number,
    totalUnits?: number,
  ): Promise<void> {
    const ref = await this.byId(scanId);
    if (!ref) return;
    const snapshot = await ref.get();
    const data = snapshot.data() ?? {};
    if (data.status === 'cancelled') return;
    const plan = data.executionPlan as FullScanExecutionPlan | undefined;
    if (!plan) {
      await this.updateProgress(scanId, {
        completed: completedUnits,
        total: totalUnits ?? completedUnits,
        percent: totalUnits
          ? Math.round((completedUnits / totalUnits) * 100)
          : 0,
      });
      return;
    }
    const existing = (data.fullScanProgress ?? {}) as Record<string, unknown>;
    const current = Number(existing.completedUnits ?? 0);
    const next = Math.max(current, completedUnits);
    const total = Math.max(Number(existing.totalUnits ?? 1), totalUnits ?? 0);
    await ref.set(
      {
        fullScanProgress: {
          ...existing,
          overallPercent: Math.max(
            Number(existing.overallPercent ?? 0),
            total ? Math.round((next / total) * 100) : 0,
          ),
          completedUnits: next,
          totalUnits: total,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  async initializeBrowserInventory(
    scanId: string,
    pageTargets: NonNullable<Scan['browserPageTargets']>,
    totalContexts: number,
  ): Promise<void> {
    const ref = await this.byId(scanId);
    if (!ref) return;
    const snapshot = await ref.get();
    const data = snapshot.data() ?? {};
    if (data.status === 'cancelled') return;
    const existing = (data.fullScanProgress ?? {}) as Record<string, unknown>;
    const existingTargets = Array.isArray(data.browserPageTargets)
      ? data.browserPageTargets
      : undefined;
    await ref.set(
      {
        ...(existingTargets ? {} : { browserPageTargets: pageTargets }),
        fullScanProgress: {
          ...existing,
          pagesEligibleForBrowser: pageTargets.length,
          browserExecutionsPlanned: Math.max(
            Number(existing.browserExecutionsPlanned ?? 0),
            totalContexts,
          ),
          browserExecutionsCompleted: Number(
            existing.browserExecutionsCompleted ?? 0,
          ),
          browserExecutionsFailed: Number(
            existing.browserExecutionsFailed ?? 0,
          ),
          stage: 'BROWSER_ANALYSIS',
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  async updateBrowserProgress(
    scanId: string,
    completed: number,
    failed: number,
    total: number,
  ): Promise<void> {
    const ref = await this.byId(scanId);
    if (!ref) return;
    const snapshot = await ref.get();
    const data = snapshot.data() ?? {};
    if (data.status === 'cancelled') return;
    const existing = (data.fullScanProgress ?? {}) as Record<string, unknown>;
    const planned = Math.max(
      Number(existing.browserExecutionsPlanned ?? 0),
      total,
    );
    const previousCompleted = Number(existing.browserExecutionsCompleted ?? 0);
    const previousFailed = Number(existing.browserExecutionsFailed ?? 0);
    const executions = await getFirestoreDb()
      .collectionGroup('browserExecutions')
      .where('scanId', '==', scanId)
      .get();
    const moduleStates = {
      ...((data.moduleStates ?? {}) as Record<string, Record<string, unknown>>),
    };
    const plan = data.executionPlan as FullScanExecutionPlan | undefined;
    if (plan) {
      for (const module of plan.modules.map((item) => item.module)) {
        const moduleTasks = plan.tasks.filter((item) =>
          item.modules?.includes(module),
        );
        const moduleTaskKeys = new Set(moduleTasks.map((item) => item.key));
        const moduleExecutions = executions.docs.filter((doc) =>
          moduleTaskKeys.has(String(doc.data().taskKey)),
        );
        const totalUnits = moduleTasks.reduce(
          (sum, item) =>
            sum +
            pageTargetsCount(data) *
              (item.viewports?.length ?? plan.viewports.length),
          0,
        );
        const completedUnits = moduleExecutions.filter(
          (doc) => doc.data().status === 'COMPLETED',
        ).length;
        if (totalUnits > 0)
          moduleStates[module] = {
            ...(moduleStates[module] ?? { module, checks: {} }),
            completedUnits,
            totalUnits,
            percent: Math.round((completedUnits / totalUnits) * 100),
            status: moduleStates[module]?.status ?? 'RUNNING',
          };
      }
    }
    const observedCompleted = executions.docs.filter(
      (doc) => doc.data().status === 'COMPLETED',
    ).length;
    const observedFailed = executions.docs.filter((doc) =>
      ['FAILED', 'UNAVAILABLE'].includes(String(doc.data().status)),
    ).length;
    const analyzedPages = new Set(
      executions.docs
        .filter((doc) => doc.data().status === 'COMPLETED')
        .map((doc) => String(doc.data().pageUrl)),
    ).size;
    const nextCompleted = Math.max(
      previousCompleted,
      observedCompleted,
      completed,
    );
    const nextFailed = Math.max(previousFailed, observedFailed, failed);
    const progressPercent = planned
      ? Math.round(((nextCompleted + nextFailed) / planned) * 100)
      : 0;
    await ref.set(
      {
        moduleStates,
        fullScanProgress: {
          ...existing,
          overallPercent: Math.max(
            Number(existing.overallPercent ?? 0),
            progressPercent,
          ),
          stage: 'BROWSER_ANALYSIS',
          browserExecutionsPlanned: planned,
          browserExecutionsCompleted: nextCompleted,
          browserExecutionsFailed: nextFailed,
          pages: {
            ...((existing.pages ?? {}) as Record<string, unknown>),
            analyzed: analyzedPages,
          },
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  async reconcileFullScan(scanId: string): Promise<void> {
    const ref = await this.byId(scanId);
    if (!ref) return;
    const scanSnapshot = await ref.get();
    const data = scanSnapshot.data() ?? {};
    if (!['completed', 'partial'].includes(String(data.status))) return;
    const plan = data.executionPlan as FullScanExecutionPlan | undefined;
    if (!plan) return;
    const states = (data.capabilityStates ?? {}) as Record<string, string>;
    if (
      Object.values(states).some(
        (state) =>
          !['COMPLETED', 'PARTIAL', 'FAILED', 'UNAVAILABLE'].includes(state),
      )
    )
      return;
    const executions = await getFirestoreDb()
      .collectionGroup('browserExecutions')
      .where('scanId', '==', scanId)
      .get();
    const customChecks = Array.isArray(data.customCheckSnapshots)
      ? data.customCheckSnapshots
      : [];
    const canonical = (value: string): string => {
      try {
        const url = new URL(value);
        url.hash = '';
        return url.toString();
      } catch {
        return value;
      }
    };
    const coverage: FullScanCoverageRecord[] = [];
    for (const execution of executions.docs) {
      const executionData = execution.data();
      const task = plan.tasks.find(
        (candidate) => candidate.key === executionData.taskKey,
      );
      if (!task) continue;
      const status: FullScanCoverageRecord['status'] =
        executionData.status === 'COMPLETED'
          ? 'COVERED'
          : executionData.status === 'FAILED'
            ? 'FAILED'
            : executionData.status === 'CANCELLED'
              ? 'CANCELLED'
              : executionData.status === 'UNAVAILABLE'
                ? 'UNAVAILABLE'
                : 'NOT_EXECUTED';
      for (const check of task.checks) {
        const custom = customChecks.find(
          (candidate) =>
            typeof candidate === 'object' &&
            candidate !== null &&
            candidate.id === check,
        ) as { id?: string; version?: number } | undefined;
        coverage.push({
          detectorId: custom ? `custom-check:${check}` : check,
          normalizedPageUrl: canonical(String(executionData.pageUrl)),
          status,
          browser: executionData.browser,
          viewport: executionData.viewport,
          ...(custom?.id ? { customCheckId: custom.id } : {}),
          ...(typeof custom?.version === 'number'
            ? { customCheckVersion: custom.version }
            : {}),
          executionId: String(executionData.id),
        });
      }
    }
    await new FirebaseIssueRepository().reconcileCoverage(
      String(data.projectId),
      scanId,
      coverage,
    );
  }
  async completeCapability(
    scanId: string,
    taskKey: string,
    status: 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED' | 'UNAVAILABLE',
    message?: string,
  ): Promise<void> {
    const ref = await this.byId(scanId);
    if (!ref) return;
    const snapshot = await ref.get();
    const data = snapshot.data() ?? {};
    if (
      data.status === 'cancelled' ||
      (data.status === 'completed' && status !== 'COMPLETED')
    )
      return;
    const previousCapability = (
      data.capabilityStates as Record<string, string> | undefined
    )?.[taskKey];
    if (
      previousCapability &&
      ['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', 'UNAVAILABLE'].includes(
        previousCapability,
      )
    )
      return;
    const plan = data.executionPlan as FullScanExecutionPlan | undefined;
    if (!plan) {
      if (status === 'COMPLETED') await this.complete(scanId, {});
      else if (status === 'CANCELLED') return;
      else
        await this.fail(scanId, status, message ?? 'Scan capability failed.');
      return;
    }
    const states = {
      ...((data.capabilityStates ?? {}) as Record<string, string>),
      [taskKey]: status,
    };
    const terminal = new Set([
      'COMPLETED',
      'PARTIAL',
      'FAILED',
      'CANCELLED',
      'UNAVAILABLE',
    ]);
    const statusResult = deriveFullScanStatus(
      states as Record<
        string,
        import('@visionqa/contracts').CapabilityExecutionStatus
      >,
    );
    const allTerminal = statusResult.allTerminal;
    const moduleStates = {
      ...((data.moduleStates ?? {}) as Record<string, Record<string, unknown>>),
    };
    const checkStates = {
      ...((data.checkStates ?? {}) as Record<string, string>),
    };
    for (const task of plan.tasks.filter((task) => task.key === taskKey)) {
      for (const check of task.checks)
        checkStates[check] =
          status === 'COMPLETED'
            ? 'EXECUTED'
            : status === 'UNAVAILABLE'
              ? 'UNAVAILABLE'
              : status === 'CANCELLED'
                ? 'SKIPPED'
                : 'FAILED';
      for (const module of task.modules ?? []) {
        const previousModule = moduleStates[module];
        const moduleTasks = plan.tasks.filter((candidate) =>
          candidate.modules?.includes(module),
        );
        const moduleStatuses = moduleTasks.map(
          (candidate) => states[candidate.key] ?? 'PENDING',
        );
        const moduleStatus = moduleStatuses.some((item) => item === 'CANCELLED')
          ? 'CANCELLED'
          : moduleStatuses.some(
                (item) =>
                  item === 'FAILED' ||
                  item === 'UNAVAILABLE' ||
                  item === 'PARTIAL',
              )
            ? moduleStatuses.every((item) => terminal.has(item))
              ? 'PARTIAL'
              : 'RUNNING'
            : moduleStatuses.every((item) => item === 'COMPLETED')
              ? 'COMPLETED'
              : 'PENDING';
        const browserTotal = moduleTasks.some(
          (candidate) => candidate.capability === 'browser',
        )
          ? moduleTasks.reduce(
              (sum, candidate) =>
                sum +
                pageTargetsCount(data) *
                  (candidate.viewports?.length ?? plan.viewports.length),
              0,
            )
          : undefined;
        const completedModuleUnits =
          moduleStatus === 'COMPLETED' && browserTotal
            ? browserTotal
            : previousModule?.completedUnits !== undefined
              ? Number(previousModule.completedUnits)
              : moduleStatus === 'COMPLETED'
                ? 1
                : 0;
        moduleStates[module] = {
          ...(previousModule ?? {
            module,
            checks: {},
            completedUnits: 0,
          }),
          status: moduleStatus,
          checks: Object.fromEntries(
            (
              plan.modules.find((item) => item.module === module)?.checks ?? []
            ).map((check) => [check, checkStates[check] ?? 'REQUESTED']),
          ),
          completedUnits: completedModuleUnits,
          ...(browserTotal ? { totalUnits: browserTotal } : {}),
          percent: browserTotal
            ? Math.round((completedModuleUnits / browserTotal) * 100)
            : [
                  'COMPLETED',
                  'PARTIAL',
                  'FAILED',
                  'UNAVAILABLE',
                  'CANCELLED',
                ].includes(moduleStatus)
              ? 100
              : moduleStatus === 'RUNNING'
                ? 50
                : 0,
          ...(message ? { message } : {}),
        };
      }
    }
    const nextStatus: ScanStatus = statusResult.status;
    const completedUnits = Object.values(states).filter(
      (item) => terminal.has(item) && item !== 'CANCELLED',
    ).length;
    const overallPercent = Math.round(
      (completedUnits / Math.max(plan.tasks.length, 1)) * 100,
    );
    await ref.set(
      {
        capabilityStates: states,
        moduleStates,
        checkStates,
        fullScanProgress: {
          ...(data.fullScanProgress ?? {}),
          overallPercent: Math.max(
            Number(
              (data.fullScanProgress as Record<string, unknown> | undefined)
                ?.overallPercent ?? 0,
            ),
            overallPercent,
          ),
          completedUnits,
          totalUnits: plan.tasks.length,
          stage:
            nextStatus === 'completed' ||
            nextStatus === 'partial' ||
            nextStatus === 'failed'
              ? 'AGGREGATION'
              : 'BROWSER_ANALYSIS',
          modules: Object.fromEntries(
            Object.entries(moduleStates).map(([key, value]) => [
              key,
              {
                status: value.status,
                completedUnits: Number(value.completedUnits ?? 0),
                percent: Number(value.percent ?? 0),
                ...(value.totalUnits !== undefined
                  ? { totalUnits: value.totalUnits }
                  : {}),
              },
            ]),
          ),
        },
        ...(allTerminal && nextStatus !== 'cancelled'
          ? {
              status: nextStatus,
              ...(nextStatus === 'completed' || nextStatus === 'partial'
                ? { completedAt: FieldValue.serverTimestamp() }
                : {}),
            }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    if (allTerminal && nextStatus !== 'cancelled')
      await this.reconcileFullScan(scanId);
  }
  async isCancellationRequested(scanId: string): Promise<boolean> {
    const ref = await this.byId(scanId);
    if (!ref) return true;
    const snapshot = await ref.get();
    const data = snapshot.data() ?? {};
    return data.status === 'cancelled' || Boolean(data.cancellationRequestedAt);
  }
  async complete(
    scanId: string,
    summary: Record<string, unknown>,
  ): Promise<void> {
    const ref = await this.byId(scanId);
    if (!ref || (await this.isCancellationRequested(scanId))) return;
    await ref.set(
      {
        status: 'completed',
        summary,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  async fail(
    scanId: string,
    failureCode: string,
    failureMessage: string,
  ): Promise<void> {
    const ref = await this.byId(scanId);
    if (!ref || (await this.isCancellationRequested(scanId))) return;
    await ref.set(
      {
        status: 'failed',
        failureCode,
        failureMessage,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}
