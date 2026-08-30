export type StorageObject = { contentType: string; data: Buffer };
export interface EvidenceStorage {
  putObject(key: string, object: StorageObject): Promise<void>;
  getSignedReadUrl(key: string): Promise<string>;
  deleteObject(key: string): Promise<void>;
}
