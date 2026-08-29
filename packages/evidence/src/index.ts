export interface EvidenceRecord {
  id: string;
  kind: 'screenshot' | 'dom' | 'network' | 'console';
  storageKey?: string;
  metadata?: Record<string, unknown>;
}
export type ScreenshotEvidence = EvidenceRecord & { kind: 'screenshot' };
export type DomEvidence = EvidenceRecord & { kind: 'dom' };
export interface EvidenceUploader {
  upload(record: EvidenceRecord): Promise<EvidenceRecord>;
}
export interface EvidenceRedactor {
  redact(record: EvidenceRecord): Promise<EvidenceRecord>;
}
