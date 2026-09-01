import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import type {
  Report,
  ReportListOptions,
  ReportRepositoryInput,
} from '@visionqa/contracts';
import type { ReportRepository } from '../../contracts/storage.js';
import { getFirestoreDb } from '../firebase-admin.js';

function iso(value: unknown): string | undefined {
  return value && typeof (value as Timestamp).toDate === 'function'
    ? (value as Timestamp).toDate().toISOString()
    : typeof value === 'string'
      ? value
      : undefined;
}

function mapReport(id: string, data: Record<string, unknown>): Report {
  return {
    ...(data as Omit<Report, 'id' | 'createdAt' | 'updatedAt'>),
    id,
    projectId: String(data.projectId),
    scanId: String(data.scanId),
    createdAt: iso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(data.updatedAt) ?? new Date(0).toISOString(),
    generatedAt: iso(data.generatedAt) ?? new Date(0).toISOString(),
  };
}

export class FirebaseReportRepository implements ReportRepository {
  private projects(projectId: string) {
    return getFirestoreDb().collection('projects').doc(projectId);
  }

  private reports(projectId: string) {
    return this.projects(projectId).collection('reports');
  }

  private async owns(ownerId: string, projectId: string): Promise<boolean> {
    const project = await this.projects(projectId).get();
    return project.exists && project.data()?.createdBy === ownerId;
  }

  async create(
    ownerId: string,
    projectId: string,
    input: Omit<ReportRepositoryInput, 'projectId'>,
  ): Promise<Report | null> {
    if (!(await this.owns(ownerId, projectId))) return null;
    const ref = input.id ? this.reports(projectId).doc(input.id) : this.reports(projectId).doc();
    const existing = await ref.get();
    if (existing.exists) return mapReport(ref.id, existing.data()!);
    await ref.set({
      ...input,
      id: ref.id,
      projectId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return mapReport(ref.id, (await ref.get()).data()!);
  }

  async findById(
    ownerId: string,
    projectId: string,
    reportId: string,
  ): Promise<Report | null> {
    if (!(await this.owns(ownerId, projectId))) return null;
    const report = await this.reports(projectId).doc(reportId).get();
    return report.exists ? mapReport(report.id, report.data()!) : null;
  }

  async list(ownerId: string, projectId: string, options: ReportListOptions = {}) {
    if (!(await this.owns(ownerId, projectId))) return null;
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    let query = this.reports(projectId).orderBy('createdAt', 'desc').limit(100) as FirebaseFirestore.Query;
    if (options.cursor) {
      const cursor = await this.reports(projectId).doc(options.cursor).get();
      if (cursor.exists) query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    const reports = snapshot.docs
      .map((doc) => mapReport(doc.id, doc.data()))
      .filter((report) =>
        (!options.scanId || report.scanId === options.scanId) &&
        (!options.status || report.status === options.status),
      )
      .slice(0, limit);
    return {
      reports,
      ...(snapshot.size === 100 && snapshot.docs.at(-1)
        ? { nextCursor: snapshot.docs.at(-1)!.id }
        : {}),
    };
  }

  async delete(ownerId: string, projectId: string, reportId: string): Promise<boolean> {
    if (!(await this.owns(ownerId, projectId))) return false;
    const ref = this.reports(projectId).doc(reportId);
    const report = await ref.get();
    if (!report.exists) return false;
    await ref.delete();
    return true;
  }
}
