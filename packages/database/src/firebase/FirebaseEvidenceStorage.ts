import type { EvidenceStorage, StorageObject } from '../contracts/storage.js';
import { getFirebaseStorage } from './firebase-admin.js';

export class FirebaseEvidenceStorage implements EvidenceStorage {
  private bucket() { return getFirebaseStorage().bucket(); }
  async putObject(key: string, object: StorageObject): Promise<void> { await this.bucket().file(key).save(object.data, { contentType: object.contentType, resumable: false }); }
  async getSignedReadUrl(key: string): Promise<string> { const [url] = await this.bucket().file(key).getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 }); return url; }
  async deleteObject(key: string): Promise<void> { await this.bucket().file(key).delete({ ignoreNotFound: true }); }
}
