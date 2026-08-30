import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { getFirestoreDb } from '../firebase-admin.js';
import type { CreateProjectInput, Environment, Project, ProjectRepository } from '../../contracts/index.js';

function environment(id: string, data: Record<string, unknown>): Environment { return { id, name: String(data.name ?? ''), type: String(data.type ?? 'production'), baseUrl: String(data.baseUrl ?? ''), isDefault: Boolean(data.isDefault) }; }
function project(id: string, data: Record<string, unknown>, environments: Environment[] = []): Project { return { id, name: String(data.name ?? ''), baseUrl: String(data.baseUrl ?? ''), createdBy: String(data.createdBy ?? ''), organizationId: typeof data.organizationId === 'string' ? data.organizationId : null, environments }; }

export class FirebaseProjectRepository implements ProjectRepository {
  private collection() { return getFirestoreDb().collection('projects'); }
  private async withEnvironments(id: string, data: Record<string, unknown>): Promise<Project> { const snapshot = await this.collection().doc(id).collection('environments').get(); return project(id, data, snapshot.docs.map((doc) => environment(doc.id, doc.data()))); }
  async createProject(ownerId: string, input: CreateProjectInput): Promise<Project> {
    const db = getFirestoreDb(); const id = randomUUID(); const environmentId = randomUUID(); const projectRef = this.collection().doc(id); const environmentRef = projectRef.collection('environments').doc(environmentId); const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(projectRef, { id, name: input.name, baseUrl: input.baseUrl, createdBy: ownerId, organizationId: null, createdAt: now, updatedAt: now });
    batch.set(environmentRef, { id: environmentId, name: input.environmentName, type: input.environmentType, baseUrl: input.baseUrl, isDefault: true, createdAt: now, updatedAt: now });
    await batch.commit(); return this.withEnvironments(id, { id, name: input.name, baseUrl: input.baseUrl, createdBy: ownerId, organizationId: null });
  }
  async findProjectsForUser(ownerId: string): Promise<Project[]> { const snapshot = await this.collection().where('createdBy', '==', ownerId).get(); return Promise.all(snapshot.docs.map((doc) => this.withEnvironments(doc.id, doc.data()))); }
  async findProjectByIdForUser(ownerId: string, projectId: string): Promise<Project | null> { const doc = await this.collection().doc(projectId).get(); if (!doc.exists || doc.data()?.createdBy !== ownerId) return null; return this.withEnvironments(projectId, doc.data()!); }
  async updateProject(ownerId: string, projectId: string, input: Partial<Pick<Project, 'name' | 'baseUrl'>>): Promise<Project | null> { const current = await this.findProjectByIdForUser(ownerId, projectId); if (!current) return null; await this.collection().doc(projectId).set({ ...input, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return this.findProjectByIdForUser(ownerId, projectId); }
}
