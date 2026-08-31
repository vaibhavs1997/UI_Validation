import { describe, expect, it } from 'vitest';
import { CrawlFrontier } from './CrawlFrontier.js';
import { normalizeUrl } from './CrawlJobProcessor.js';

describe('crawl frontier', () => {
  it('deduplicates fragments and preserves query strings', () => {
    const frontier = new CrawlFrontier(3, 2);
    expect(frontier.add({ url: 'https://example.com/about#team', normalizedUrl: normalizeUrl('https://example.com/about#team'), depth: 0 })).toBe(true);
    expect(frontier.add({ url: 'https://example.com/about#history', normalizedUrl: normalizeUrl('https://example.com/about#history'), depth: 0 })).toBe(false);
    expect(normalizeUrl('https://EXAMPLE.com:443/search?q=one#result')).toBe('https://example.com/search?q=one');
  });
  it('enforces page and depth limits', () => {
    const frontier = new CrawlFrontier(1, 0);
    expect(frontier.add({ url: 'https://example.com', normalizedUrl: 'https://example.com/', depth: 0 })).toBe(true);
    expect(frontier.add({ url: 'https://example.com/a', normalizedUrl: 'https://example.com/a', depth: 1 })).toBe(false);
    expect(frontier.add({ url: 'https://example.com/b', normalizedUrl: 'https://example.com/b', depth: 0 })).toBe(false);
  });
});
