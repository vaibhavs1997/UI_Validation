import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../firebase-admin.js';
import type { UpsertUserProfile, UserProfile, UserRepository } from '../../contracts/index.js';

export class FirebaseUserRepository implements UserRepository {
  async findById(id: string): Promise<UserProfile | null> {
    const snapshot = await getFirestoreDb().collection('users').doc(id).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() as Partial<UserProfile>;
    return { id, name: data.name ?? '', email: data.email ?? '' };
  }
  async upsertProfile(input: UpsertUserProfile): Promise<UserProfile> {
    const reference = getFirestoreDb().collection('users').doc(input.id);
    const existing = await reference.get();
    await reference.set({
      id: input.id, name: input.name?.trim() || '', email: input.email.trim().toLowerCase(),
      ...(existing.exists ? { updatedAt: FieldValue.serverTimestamp() } : { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    return (await this.findById(input.id))!;
  }
}
