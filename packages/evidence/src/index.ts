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

export interface AnnotationRectangle { ref: string; x: number; y: number; width: number; height: number; label?: string }
export interface VisualAnnotationResult { image: Buffer; contentType: 'image/png'; rectangles: AnnotationRectangle[] }

export async function renderVisualAnnotation(input: Buffer, rectangles: AnnotationRectangle[]): Promise<VisualAnnotationResult> {
  if (!input.length) throw new Error('ANNOTATION_INVALID_IMAGE');
  const sharp = (await import('sharp')).default;
  const source = sharp(input);
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) throw new Error('ANNOTATION_INVALID_DIMENSIONS');
  const safe = rectangles.slice(0, 50).flatMap((rect) => {
    const x = Number.isFinite(rect.x) ? Math.max(0, Math.min(width, rect.x)) : 0;
    const y = Number.isFinite(rect.y) ? Math.max(0, Math.min(height, rect.y)) : 0;
    const right = Number.isFinite(rect.x + rect.width) ? Math.max(x, Math.min(width, rect.x + Math.max(0, rect.width))) : x;
    const bottom = Number.isFinite(rect.y + rect.height) ? Math.max(y, Math.min(height, rect.y + Math.max(0, rect.height))) : y;
    if (right <= x || bottom <= y) return [];
    return [{ ...rect, x, y, width: right - x, height: bottom - y }];
  });
  if (!safe.length) return { image: input, contentType: 'image/png', rectangles: [] };
  const shapes = safe.map((rect, index) => `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="none" stroke="#ad08d1" stroke-width="3"/><circle cx="${Math.min(width - 12, rect.x + 12)}" cy="${Math.min(height - 12, rect.y + 12)}" r="11" fill="#ad08d1"/><text x="${Math.min(width - 12, rect.x + 12)}" y="${Math.min(height - 8, rect.y + 16)}" fill="#fff" font-size="12" font-family="Arial" text-anchor="middle">${index + 1}</text>`).join('');
  const image = await source.composite([{ input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`), top: 0, left: 0 }]).png().toBuffer();
  return { image, contentType: 'image/png', rectangles: safe };
}
