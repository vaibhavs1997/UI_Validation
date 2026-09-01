import { describe, expect, it } from 'vitest';
import type { CrawlPage, ScanTarget } from '@visionqa/contracts';
import {
  browserContextCount,
  selectBrowserPageTargets,
  unionBrowserViewports,
} from './site-page-selection.js';

const target: ScanTarget = {
  requestedUrl: 'https://example.com/',
  normalizedUrl: 'https://example.com/',
  origin: 'https://example.com',
  protocol: 'https',
  hostname: 'example.com',
};

const page = (overrides: Partial<CrawlPage>): CrawlPage => ({
  id: overrides.id ?? 'page',
  scanId: 'scan',
  projectId: 'project',
  url: overrides.url ?? 'https://example.com/',
  normalizedUrl: overrides.normalizedUrl ?? 'https://example.com/',
  depth: overrides.depth ?? 0,
  contentType: overrides.contentType ?? 'text/html; charset=utf-8',
  redirectChain: [],
  discoveredAt: overrides.discoveredAt ?? '2026-01-01T00:00:00.000Z',
  crawlStatus: overrides.crawlStatus ?? 'FETCHED',
});

describe('site browser page selection', () => {
  it('deduplicates, filters non-HTML pages, prioritizes root, and applies a stable cap', () => {
    const selected = selectBrowserPageTargets(
      [
        page({
          id: 'contact',
          url: 'https://example.com/contact',
          normalizedUrl: 'https://example.com/contact',
          depth: 1,
          discoveredAt: '2026-01-01T00:00:03.000Z',
        }),
        page({ id: 'root', discoveredAt: '2026-01-01T00:00:02.000Z' }),
        page({
          id: 'fragment',
          url: 'https://example.com/about#team',
          normalizedUrl: 'https://example.com/about#team',
          depth: 1,
          discoveredAt: '2026-01-01T00:00:04.000Z',
        }),
        page({
          id: 'about',
          url: 'https://example.com/about',
          normalizedUrl: 'https://example.com/about',
          depth: 1,
          discoveredAt: '2026-01-01T00:00:01.000Z',
        }),
        page({
          id: 'asset',
          url: 'https://example.com/app.js',
          normalizedUrl: 'https://example.com/app.js',
          contentType: 'application/javascript',
          depth: 1,
        }),
      ],
      target,
      'site',
      { maxBrowserPages: 3 },
    );
    expect(selected.map((item) => item.normalizedUrl)).toEqual([
      'https://example.com/',
      'https://example.com/about',
      'https://example.com/contact',
    ]);
  });

  it('keeps single-page scans on the persisted target without requiring crawl records', () => {
    expect(selectBrowserPageTargets([], target, 'single-page')).toEqual([
      expect.objectContaining({
        normalizedUrl: target.normalizedUrl,
        source: 'target',
      }),
    ]);
  });

  it('unions responsive viewports without duplicating the shared desktop context', () => {
    const mobile = { width: 390, height: 844 };
    const desktop = { width: 1440, height: 900 };
    expect(
      unionBrowserViewports(
        ['horizontal-overflow', 'accessible-name'],
        [mobile, desktop, desktop],
      ),
    ).toEqual([mobile, desktop]);
    expect(
      unionBrowserViewports(
        ['accessible-name', 'core-web-vitals'],
        [mobile, desktop],
      ),
    ).toEqual([desktop]);
    expect(
      browserContextCount(3, ['chromium', 'firefox', 'chromium'], [desktop]),
    ).toBe(6);
  });
});
