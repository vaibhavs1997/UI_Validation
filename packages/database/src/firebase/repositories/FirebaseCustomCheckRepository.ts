import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import type { CustomCheck, CustomCheckDefinition, Severity } from '@visionqa/contracts';
import type { CustomCheckRepository } from '../../contracts/index.js';
import { getFirestoreDb } from '../firebase-admin.js';

function iso(value: unknown): string { return value && typeof (value as Timestamp).toDate === 'function' ? (value as Timestamp).toDate().toISOString() : typeof value === 'string' ? value : new Date(0).toISOString(); }
function mapCheck(id: string, projectId: string, data: Record<string, unknown>): CustomCheck { return { id, projectId, name: String(data.name ?? ''), ...(typeof data.description === 'string' ? { description: data.description } : {}), enabled: data.enabled !== false, definition: data.definition as CustomCheckDefinition, severity: (data.severity ?? 'medium') as Severity, version: Number(data.version ?? 1), createdBy: String(data.createdBy ?? ''), ...(typeof data.updatedBy === 'string' ? { updatedBy: data.updatedBy } : {}), createdAt: iso(data.createdAt), updatedAt: iso(data.updatedAt) }; }

export class FirebaseCustomCheckRepository implements CustomCheckRepository {
  private project(projectId: string) { return getFirestoreDb().collection('projects').doc(projectId); }
  private checks(projectId: string) { return this.project(projectId).collection('customChecks'); }
  private async owns(ownerId: string, projectId: string): Promise<boolean> { const snapshot = await this.project(projectId).get(); return snapshot.exists && snapshot.data()?.createdBy === ownerId; }
  async create(ownerId: string, projectId: string, input: { name: string; description?: string; enabled?: boolean; definition: CustomCheckDefinition; severity: Severity }): Promise<CustomCheck | null> { if (!(await this.owns(ownerId, projectId))) return null; const ref = this.checks(projectId).doc(randomUUID()); const now = FieldValue.serverTimestamp(); await ref.set({ id: ref.id, projectId, name: input.name, ...(input.description ? { description: input.description } : {}), enabled: input.enabled !== false, definition: input.definition, severity: input.severity, version: 1, createdBy: ownerId, createdAt: now, updatedAt: now }); const snapshot = await ref.get(); return mapCheck(ref.id, projectId, snapshot.data()!); }
  async list(ownerId: string, projectId: string): Promise<CustomCheck[] | null> { if (!(await this.owns(ownerId, projectId))) return null; const snapshot = await this.checks(projectId).orderBy('updatedAt', 'desc').get(); return snapshot.docs.map((doc) => mapCheck(doc.id, projectId, doc.data())); }
  async find(ownerId: string, projectId: string, checkId: string): Promise<CustomCheck | null> { if (!(await this.owns(ownerId, projectId))) return null; const snapshot = await this.checks(projectId).doc(checkId).get(); return snapshot.exists ? mapCheck(checkId, projectId, snapshot.data()!) : null; }
  async update(ownerId: string, projectId: string, checkId: string, input: Partial<{ name: string; description?: string; enabled: boolean; definition: CustomCheckDefinition; severity: Severity }>): Promise<CustomCheck | null> { const current = await this.find(ownerId, projectId, checkId); if (!current) return null; await this.checks(projectId).doc(checkId).set({ ...input, version: current.version + 1, updatedBy: ownerId, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return this.find(ownerId, projectId, checkId); }
  async delete(ownerId: string, projectId: string, checkId: string): Promise<boolean> { const current = await this.find(ownerId, projectId, checkId); if (!current) return false; await this.checks(projectId).doc(checkId).delete(); return true; }
}
