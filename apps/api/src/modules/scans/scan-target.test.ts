import { describe, expect, it } from 'vitest';
import { createScanTarget } from '@visionqa/contracts';

describe('scan target normalization', () => {
  it.each([
    ['https://example.com', 'https://example.com/'],
    ['https://EXAMPLE.com/', 'https://example.com/'],
    ['https://example.com/path?x=1#section', 'https://example.com/path?x=1'],
    ['https://example.com:8443/path', 'https://example.com:8443/path'],
    ['http://example.com', 'http://example.com/'],
  ])('normalizes %s deterministically', (input, normalized) => {
    expect(createScanTarget(input).normalizedUrl).toBe(normalized);
    expect(createScanTarget(input).normalizedUrl).toBe(createScanTarget(input).normalizedUrl);
  });

  it('rejects malformed and unsupported URLs', () => {
    expect(() => createScanTarget('not a URL')).toThrow();
    expect(() => createScanTarget('ftp://example.com')).toThrow();
  });
});
