import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import type {
  Schedule,
  ScheduleRecurrence,
  ScheduleRepositoryInput,
  ScheduleRun,
  ScheduleRunStatus,
  ScheduledScanTemplate,
} from '@visionqa/contracts';
import { manualScheduleRunId, scheduleRunId } from '@visionqa/contracts';
import type { ScheduleRepository } from '../../contracts/index.js';
import { getFirestoreDb } from '../firebase-admin.js';

function iso(value: unknown): string | undefined {
  return value && typeof (value as Timestamp).toDate === 'function'
    ? (value as Timestamp).toDate().toISOString()
    : typeof value === 'string'
      ? value
      : undefined;
}

function mapRun(
  id: string,
  projectId: string,
  scheduleId: string,
  data: Record<string, unknown>,
): ScheduleRun {
  const triggeredAt = iso(data.triggeredAt);
  const errorCode =
    typeof data.errorCode === 'string'
      ? (data.errorCode as ScheduleRun['errorCode'])
      : undefined;
  const skipReason =
    typeof data.skipReason === 'string'
      ? (data.skipReason as ScheduleRun['skipReason'])
      : undefined;
  return {
    id,
    projectId,
    scheduleId,
    source: data.source === 'MANUAL_RUN_NOW' ? 'MANUAL_RUN_NOW' : 'SCHEDULED',
    scheduledFor: String(data.scheduledFor ?? ''),
    ...(triggeredAt ? { triggeredAt } : {}),
    ...(typeof data.scanId === 'string' ? { scanId: data.scanId } : {}),
    status: data.status as ScheduleRunStatus,
    ...(errorCode ? { errorCode } : {}),
    ...(typeof data.errorMessage === 'string'
      ? { errorMessage: data.errorMessage }
      : {}),
    ...(skipReason ? { skipReason } : {}),
    createdAt: iso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(data.updatedAt) ?? new Date(0).toISOString(),
  };
}

function mapSchedule(
  id: string,
  projectId: string,
  data: Record<string, unknown>,
): Schedule {
  const nextRunAt =
    typeof data.nextRunAt === 'string' || data.nextRunAt === null
      ? data.nextRunAt
      : undefined;
  const lastRunStatus =
    typeof data.lastRunStatus === 'string'
      ? (data.lastRunStatus as Schedule['lastRunStatus'])
      : undefined;
  return {
    id,
    projectId,
    name: String(data.name ?? ''),
    ...(typeof data.description === 'string'
      ? { description: data.description }
      : {}),
    enabled: data.enabled === true,
    recurrence: data.recurrence as ScheduleRecurrence,
    timezone: String(data.timezone ?? 'UTC'),
    overlapPolicy: 'SKIP_WHILE_RUNNING',
    template: data.template as ScheduledScanTemplate,
    ...(nextRunAt !== undefined ? { nextRunAt } : {}),
    ...(typeof data.lastRunAt === 'string'
      ? { lastRunAt: data.lastRunAt }
      : {}),
    ...(typeof data.lastScanId === 'string'
      ? { lastScanId: data.lastScanId }
      : {}),
    ...(lastRunStatus ? { lastRunStatus } : {}),
    createdAt: iso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(data.updatedAt) ?? new Date(0).toISOString(),
    createdBy: String(data.createdBy ?? ''),
    ...(typeof data.updatedBy === 'string'
      ? { updatedBy: data.updatedBy }
      : {}),
  };
}

export class FirebaseScheduleRepository implements ScheduleRepository {
  private project(projectId: string) {
    return getFirestoreDb().collection('projects').doc(projectId);
  }

  private schedules(projectId: string) {
    return this.project(projectId).collection('schedules');
  }

  private runs(projectId: string, scheduleId: string) {
    return this.schedules(projectId).doc(scheduleId).collection('runs');
  }

  private async owns(ownerId: string, projectId: string): Promise<boolean> {
    const snapshot = await this.project(projectId).get();
    return snapshot.exists && snapshot.data()?.createdBy === ownerId;
  }

  private async schedulerRef(scheduleId: string) {
    const snapshot = await getFirestoreDb()
      .collectionGroup('schedules')
      .where('id', '==', scheduleId)
      .limit(1)
      .get();
    return snapshot.empty ? null : snapshot.docs[0]!.ref;
  }

  private writeable(input: ScheduleRepositoryInput) {
    return {
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      enabled: input.enabled,
      archived: false,
      recurrence: input.recurrence,
      timezone: input.timezone,
      overlapPolicy: input.overlapPolicy,
      template: input.template,
      ...(input.nextRunAt
        ? { nextRunAt: input.nextRunAt }
        : { nextRunAt: null }),
      createdBy: input.createdBy,
    };
  }

  async create(
    ownerId: string,
    projectId: string,
    input: ScheduleRepositoryInput,
  ): Promise<Schedule | null> {
    if (!(await this.owns(ownerId, projectId))) return null;
    const ref = this.schedules(projectId).doc(randomUUID());
    const now = FieldValue.serverTimestamp();
    await ref.set({
      id: ref.id,
      projectId,
      ...this.writeable({ ...input, createdBy: ownerId }),
      createdAt: now,
      updatedAt: now,
    });
    const created = await ref.get();
    return mapSchedule(ref.id, projectId, created.data()!);
  }

  async findByProject(
    ownerId: string,
    projectId: string,
  ): Promise<Schedule[] | null> {
    if (!(await this.owns(ownerId, projectId))) return null;
    const snapshot = await this.schedules(projectId)
      .orderBy('updatedAt', 'desc')
      .get();
    return snapshot.docs
      .filter((doc) => doc.data().archived !== true)
      .map((doc) => mapSchedule(doc.id, projectId, doc.data()));
  }

  async findById(
    ownerId: string,
    projectId: string,
    scheduleId: string,
  ): Promise<Schedule | null> {
    if (!(await this.owns(ownerId, projectId))) return null;
    const snapshot = await this.schedules(projectId).doc(scheduleId).get();
    if (!snapshot.exists || snapshot.data()?.archived === true) return null;
    return mapSchedule(scheduleId, projectId, snapshot.data()!);
  }

  async findByIdForScheduler(scheduleId: string): Promise<Schedule | null> {
    const ref = await this.schedulerRef(scheduleId);
    if (!ref) return null;
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.archived === true) return null;
    return mapSchedule(
      scheduleId,
      ref.parent.parent?.id ?? '',
      snapshot.data()!,
    );
  }

  async update(
    ownerId: string,
    projectId: string,
    scheduleId: string,
    input: Partial<ScheduleRepositoryInput> & {
      enabled?: boolean;
      nextRunAt?: string | null;
      lastRunAt?: string;
      lastScanId?: string;
      lastRunStatus?: ScheduleRunStatus;
    },
  ): Promise<Schedule | null> {
    if (!(await this.owns(ownerId, projectId))) return null;
    const ref = this.schedules(projectId).doc(scheduleId);
    const current = await ref.get();
    if (!current.exists || current.data()?.archived === true) return null;
    const patch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: ownerId,
    };
    for (const key of [
      'name',
      'description',
      'enabled',
      'recurrence',
      'timezone',
      'template',
      'nextRunAt',
      'lastRunAt',
      'lastScanId',
      'lastRunStatus',
    ]) {
      if (key in input) patch[key] = input[key as keyof typeof input];
    }
    await ref.set(patch, { merge: true });
    const updated = await ref.get();
    return mapSchedule(scheduleId, projectId, updated.data()!);
  }

  async archive(
    ownerId: string,
    projectId: string,
    scheduleId: string,
  ): Promise<boolean> {
    if (!(await this.owns(ownerId, projectId))) return false;
    const ref = this.schedules(projectId).doc(scheduleId);
    const current = await ref.get();
    if (!current.exists || current.data()?.archived === true) return false;
    await ref.set(
      {
        archived: true,
        enabled: false,
        nextRunAt: null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: ownerId,
      },
      { merge: true },
    );
    return true;
  }

  async findDue(now: string, limit: number): Promise<Schedule[]> {
    const snapshot = await getFirestoreDb()
      .collectionGroup('schedules')
      .where('enabled', '==', true)
      .where('nextRunAt', '<=', now)
      .orderBy('nextRunAt', 'asc')
      .limit(Math.max(1, Math.min(limit, 100)))
      .get();
    return snapshot.docs
      .filter((doc) => doc.data().archived !== true)
      .map((doc) =>
        mapSchedule(doc.id, doc.ref.parent.parent?.id ?? '', doc.data()),
      );
  }

  async claimScheduledRun(
    scheduleId: string,
    expectedScheduledFor: string,
    nextRunAt: string | null,
    now: string,
  ): Promise<ScheduleRun | null> {
    const scheduleRef = await this.schedulerRef(scheduleId);
    if (!scheduleRef) return null;
    const projectId = scheduleRef.parent.parent?.id ?? '';
    const runRef = this.runs(projectId, scheduleId).doc(
      scheduleRunId(scheduleId, expectedScheduledFor),
    );
    const projectRef = this.project(projectId);
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const scheduleSnapshot = await transaction.get(scheduleRef);
      const runSnapshot = await transaction.get(runRef);
      if (runSnapshot.exists)
        return mapRun(runRef.id, projectId, scheduleId, runSnapshot.data()!);
      const scheduleData = scheduleSnapshot.data() ?? {};
      if (
        !scheduleSnapshot.exists ||
        scheduleData.archived === true ||
        scheduleData.enabled !== true ||
        scheduleData.nextRunAt !== expectedScheduledFor
      )
        return null;
      let active = false;
      const lastScanId = scheduleData.lastScanId;
      if (typeof lastScanId === 'string') {
        const scanSnapshot = await transaction.get(
          projectRef.collection('scans').doc(lastScanId),
        );
        active = ['queued', 'running'].includes(
          String(scanSnapshot.data()?.status),
        );
      }
      const common = {
        id: runRef.id,
        projectId,
        scheduleId,
        source: 'SCHEDULED',
        scheduledFor: expectedScheduledFor,
        createdAt: now,
        updatedAt: now,
      };
      if (active) {
        const skipped = {
          ...common,
          status: 'SKIPPED',
          skipReason: 'PREVIOUS_RUN_ACTIVE',
        };
        transaction.create(runRef, skipped);
        transaction.set(
          scheduleRef,
          {
            nextRunAt,
            lastRunAt: expectedScheduledFor,
            lastRunStatus: 'SKIPPED',
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return mapRun(runRef.id, projectId, scheduleId, skipped);
      }
      const pending = { ...common, status: 'PENDING' };
      transaction.create(runRef, pending);
      transaction.set(
        scheduleRef,
        {
          nextRunAt,
          lastRunAt: expectedScheduledFor,
          lastRunStatus: 'PENDING',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return mapRun(runRef.id, projectId, scheduleId, pending);
    });
  }

  async createManualRun(
    ownerId: string,
    projectId: string,
    scheduleId: string,
    runId: string,
    now: string,
  ): Promise<ScheduleRun | null> {
    if (!(await this.owns(ownerId, projectId))) return null;
    const scheduleRef = this.schedules(projectId).doc(scheduleId);
    const runRef = this.runs(projectId, scheduleId).doc(
      manualScheduleRunId(scheduleId, runId),
    );
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const scheduleSnapshot = await transaction.get(scheduleRef);
      const runSnapshot = await transaction.get(runRef);
      if (runSnapshot.exists)
        return mapRun(runRef.id, projectId, scheduleId, runSnapshot.data()!);
      if (
        !scheduleSnapshot.exists ||
        scheduleSnapshot.data()?.archived === true
      )
        return null;
      const pending = {
        id: runRef.id,
        projectId,
        scheduleId,
        source: 'MANUAL_RUN_NOW',
        scheduledFor: now,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      };
      transaction.create(runRef, pending);
      transaction.set(
        scheduleRef,
        {
          lastRunAt: now,
          lastRunStatus: 'PENDING',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return mapRun(runRef.id, projectId, scheduleId, pending);
    });
  }

  async findRun(
    projectId: string,
    scheduleId: string,
    runId: string,
  ): Promise<ScheduleRun | null> {
    const snapshot = await this.runs(projectId, scheduleId).doc(runId).get();
    return snapshot.exists
      ? mapRun(runId, projectId, scheduleId, snapshot.data()!)
      : null;
  }

  async updateRun(
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
  ): Promise<ScheduleRun | null> {
    const scheduleRef = this.schedules(projectId).doc(scheduleId);
    const runRef = this.runs(projectId, scheduleId).doc(runId);
    const db = getFirestoreDb();
    return db.runTransaction(async (transaction) => {
      const runSnapshot = await transaction.get(runRef);
      if (!runSnapshot.exists) return null;
      transaction.set(
        runRef,
        { ...input, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      transaction.set(
        scheduleRef,
        {
          lastRunStatus: input.status,
          ...(input.scanId ? { lastScanId: input.scanId } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return mapRun(runId, projectId, scheduleId, {
        ...runSnapshot.data(),
        ...input,
      });
    });
  }

  async listRuns(
    ownerId: string,
    projectId: string,
    scheduleId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ runs: ScheduleRun[]; nextCursor?: string } | null> {
    if (!(await this.owns(ownerId, projectId))) return null;
    const collection = this.runs(projectId, scheduleId);
    let query = collection
      .orderBy('createdAt', 'desc')
      .limit(Math.max(1, Math.min(limit, 100)) + 1);
    if (cursor) {
      const cursorSnapshot = await collection.doc(cursor).get();
      if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
    }
    const snapshot = await query.get();
    const docs = snapshot.docs.slice(0, Math.max(1, Math.min(limit, 100)));
    const nextCursor =
      snapshot.docs.length > docs.length ? docs.at(-1)?.id : undefined;
    return {
      runs: docs.map((doc) =>
        mapRun(doc.id, projectId, scheduleId, doc.data()),
      ),
      ...(nextCursor ? { nextCursor } : {}),
    };
  }
}
