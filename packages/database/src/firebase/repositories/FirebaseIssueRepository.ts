import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { coverageCanReconcile } from '@visionqa/contracts';
import type {
  FullScanCoverageRecord,
  Issue,
  IssueStatus,
  QaModule,
  Severity,
} from '@visionqa/contracts';
import type { IssueRepository } from '../../contracts/storage.js';
import { getFirestoreDb } from '../firebase-admin.js';
const iso = (value: unknown): string | undefined =>
  value && typeof (value as Timestamp).toDate === 'function'
    ? (value as Timestamp).toDate().toISOString()
    : typeof value === 'string'
      ? value
      : undefined;
function map(id: string, data: Record<string, unknown>): Issue {
  const firstSeenAt = iso(data.firstSeenAt) ?? new Date(0).toISOString();
  const lastSeenAt = iso(data.lastSeenAt) ?? firstSeenAt;
  const createdAt = iso(data.createdAt) ?? firstSeenAt;
  return {
    id,
    projectId: String(data.projectId),
    detectorId: String(data.detectorId),
    module: String(data.module) as QaModule,
    severity: String(data.severity) as Severity,
    status: String(data.status ?? 'OPEN') as IssueStatus,
    title: String(data.title),
    message: String(data.message),
    fingerprint: String(data.fingerprint),
    primaryUrl: String(data.primaryUrl),
    firstSeenAt,
    lastSeenAt,
    occurrenceCount: Number(data.occurrenceCount ?? 0),
    createdAt,
    updatedAt: iso(data.updatedAt) ?? lastSeenAt,
    ...(Array.isArray(data.scanIds)
      ? {
          scanIds: data.scanIds.filter(
            (value): value is string => typeof value === 'string',
          ),
        }
      : {}),
  };
}
export class FirebaseIssueRepository implements IssueRepository {
  private collection(projectId: string) {
    return getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .collection('issues');
  }
  async upsertFinding(
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
  ): Promise<Issue> {
    const id = createHash('sha256')
      .update(`${input.projectId}|${input.fingerprint}`)
      .digest('hex')
      .slice(0, 40);
    const ref = this.collection(input.projectId).doc(id);
    const existing = await ref.get();
    const now = FieldValue.serverTimestamp();
    const status =
      existing.exists && existing.data()?.status === 'FIXED'
        ? 'REOPENED'
        : existing.exists
          ? (existing.data()?.status ?? 'OPEN')
          : 'OPEN';
    const viewport = input.evidence.viewport;
    const browser = input.evidence.browser;
    const ruleId = input.evidence.ruleId;
    const customCheckId = input.evidence.customCheckId;
    const customCheckVersion = input.evidence.customCheckVersion;
    await ref.set(
      {
        projectId: input.projectId,
        detectorId: input.detectorId,
        module: input.module,
        severity: input.severity,
        title: input.title,
        message: input.message,
        fingerprint: input.fingerprint,
        primaryUrl: input.primaryUrl,
        ...(viewport && typeof viewport === 'object' ? { viewport } : {}),
        ...(typeof browser === 'string' ? { browser } : {}),
        ...(typeof ruleId === 'string' ? { ruleId } : {}),
        ...(typeof customCheckId === 'string' ? { customCheckId } : {}),
        ...(typeof customCheckVersion === 'number'
          ? { customCheckVersion }
          : {}),
        scanIds: FieldValue.arrayUnion(input.scanId),
        status,
        ...(existing.exists
          ? {}
          : { firstSeenAt: now, createdAt: now, occurrenceCount: 0 }),
        lastSeenAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    const createdOccurrence = await this.addOccurrence({
      issueId: ref.id,
      projectId: input.projectId,
      scanId: input.scanId,
      ...(input.pageId ? { pageId: input.pageId } : {}),
      sourceUrl: input.primaryUrl,
      targetUrl: input.primaryUrl,
      evidence: input.evidence,
    });
    if (createdOccurrence)
      await ref.update({
        occurrenceCount: FieldValue.increment(1),
        updatedAt: now,
      });
    const saved = await ref.get();
    return map(ref.id, saved.data()!);
  }
  async reconcileCoverage(
    projectId: string,
    scanId: string,
    coverage: FullScanCoverageRecord[],
  ): Promise<void> {
    if (!coverage.length) return;
    const issues = await this.collection(projectId).get();
    for (const issue of issues.docs) {
      const data = issue.data();
      const scanIds = Array.isArray(data.scanIds) ? data.scanIds : [];
      if (scanIds.includes(scanId)) continue;
      const candidate = coverage.find((item) =>
        coverageCanReconcile(
          {
            detectorId: String(data.detectorId),
            pageUrl: String(data.primaryUrl),
            ...(typeof data.browser === 'string'
              ? {
                  browser:
                    data.browser as import('@visionqa/contracts').BrowserType,
                }
              : {}),
            ...(data.viewport && typeof data.viewport === 'object'
              ? {
                  viewport:
                    data.viewport as import('@visionqa/contracts').Viewport,
                }
              : {}),
            ...(typeof data.customCheckId === 'string'
              ? { customCheckId: data.customCheckId }
              : {}),
            ...(typeof data.customCheckVersion === 'number'
              ? { customCheckVersion: data.customCheckVersion }
              : {}),
          },
          item,
        ),
      );
      if (candidate && data.status !== 'FIXED')
        await issue.ref.set(
          { status: 'FIXED', updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
    }
  }
  async findByProject(
    ownerId: string,
    projectId: string,
    options: {
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
    } = {},
  ) {
    const project = await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .get();
    if (!project.exists || project.data()?.createdBy !== ownerId)
      return { issues: [] };
    const limit = Math.min(options.limit ?? 50, 100);
    let query = (
      options.scanId
        ? this.collection(projectId).where(
            'scanIds',
            'array-contains',
            options.scanId,
          )
        : this.collection(projectId).orderBy('updatedAt', 'desc')
    ).limit(limit) as FirebaseFirestore.Query;
    if (options.cursor && !options.scanId) {
      const cursor = await this.collection(projectId).doc(options.cursor).get();
      if (cursor.exists) query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    const issues = snapshot.docs
      .map((doc) => ({ doc, item: map(doc.id, doc.data()) }))
      .filter(({ doc, item }) => {
        const data = doc.data();
        const viewport = data.viewport as
          { width?: number; height?: number } | undefined;
        return (
          (!options.severity || item.severity === options.severity) &&
          (!options.status || item.status === options.status) &&
          (!options.module || item.module === options.module) &&
          (!options.detectorId || item.detectorId === options.detectorId) &&
          (!options.ruleId || data.ruleId === options.ruleId) &&
          (!options.pageUrl || item.primaryUrl.includes(options.pageUrl)) &&
          (!options.browser || data.browser === options.browser) &&
          (!options.viewport ||
            `${viewport?.width}x${viewport?.height}` === options.viewport)
        );
      })
      .map(({ item }) => item);
    return {
      issues,
      ...(snapshot.size === limit && snapshot.docs.at(-1) && !options.scanId
        ? { nextCursor: snapshot.docs.at(-1)!.id }
        : {}),
    };
  }
  async findAllByScan(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<Issue[]> {
    const project = await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .get();
    if (!project.exists || project.data()?.createdBy !== ownerId) return [];
    const snapshot = await this.collection(projectId)
      .where('scanIds', 'array-contains', scanId)
      .get();
    return snapshot.docs.map((doc) => map(doc.id, doc.data()));
  }
  async findById(ownerId: string, projectId: string, issueId: string) {
    const project = await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .get();
    if (!project.exists || project.data()?.createdBy !== ownerId) return null;
    const doc = await this.collection(projectId).doc(issueId).get();
    return doc.exists ? map(doc.id, doc.data()!) : null;
  }
  async addOccurrence(
    input: Omit<
      import('@visionqa/contracts').IssueOccurrence,
      'id' | 'detectedAt'
    >,
  ): Promise<boolean> {
    const evidence = input.evidence;
    const occurrenceId = createHash('sha256')
      .update(
        JSON.stringify({
          issueId: input.issueId,
          scanId: input.scanId,
          pageId: input.pageId,
          sourceUrl: input.sourceUrl,
          targetUrl: input.targetUrl,
          executionId: evidence.executionId,
          elementRef: evidence.elementRef,
          resourceUrl: evidence.resourceUrl,
          browser: evidence.browser,
          viewport: evidence.viewport,
        }),
      )
      .digest('hex')
      .slice(0, 40);
    const ref = this.collection(input.projectId)
      .doc(input.issueId)
      .collection('occurrences')
      .doc(occurrenceId);
    if ((await ref.get()).exists) return false;
    await ref.set(
      { ...input, id: occurrenceId, detectedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return true;
  }
  async attachOccurrenceEvidence(
    projectId: string,
    issueId: string,
    scanId: string,
    evidence: Record<string, unknown>,
  ): Promise<void> {
    const snapshot = await this.collection(projectId)
      .doc(issueId)
      .collection('occurrences')
      .where('scanId', '==', scanId)
      .orderBy('detectedAt', 'desc')
      .limit(1)
      .get();
    if (!snapshot.empty)
      await snapshot.docs[0]!.ref.set({ evidence }, { merge: true });
  }
  async updateStatus(
    ownerId: string,
    projectId: string,
    issueId: string,
    status: IssueStatus,
  ) {
    const project = await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .get();
    if (!project.exists || project.data()?.createdBy !== ownerId) return null;
    const ref = this.collection(projectId).doc(issueId);
    if (!(await ref.get()).exists) return null;
    await ref.set(
      { status, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    const doc = await ref.get();
    return map(doc.id, doc.data()!);
  }
}
