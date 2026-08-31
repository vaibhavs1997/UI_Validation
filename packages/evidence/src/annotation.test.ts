import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { renderVisualAnnotation } from './index.js';

describe('renderVisualAnnotation', () => {
  it('clips and numbers valid rectangles', async () => {
    const source = await sharp({ create: { width: 100, height: 80, channels: 4, background: 'white' } }).png().toBuffer();
    const result = await renderVisualAnnotation(source, [{ ref: 'a', x: -10, y: 5, width: 50, height: 20 }, { ref: 'b', x: 80, y: 60, width: 40, height: 40 }, { ref: 'bad', x: 0, y: 0, width: 0, height: 0 }]);
    expect(result.contentType).toBe('image/png');
    expect(result.rectangles).toHaveLength(2);
    expect((await sharp(result.image).metadata()).width).toBe(100);
  });
  it('fails safely for an invalid image', async () => { await expect(renderVisualAnnotation(Buffer.alloc(0), [])).rejects.toThrow('ANNOTATION_INVALID_IMAGE'); });
  it('returns the original image when geometry is unusable', async () => {
    const source = await sharp({ create: { width: 20, height: 20, channels: 4, background: 'white' } }).png().toBuffer();
    const result = await renderVisualAnnotation(source, [
      { ref: 'outside', x: 40, y: 40, width: 10, height: 10 },
      { ref: 'zero', x: 0, y: 0, width: 0, height: 4 },
    ]);
    expect(result.rectangles).toEqual([]);
    expect(result.image).toEqual(source);
  });
  it('rejects an image without usable dimensions', async () => {
    const source = Buffer.from('not-an-image');
    await expect(renderVisualAnnotation(source, [])).rejects.toBeTruthy();
  });
});
