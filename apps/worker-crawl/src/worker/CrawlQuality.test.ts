import { describe, expect, it } from 'vitest';
import { compareUrls, parseRobots, parseSitemap, RobotsPolicy } from './CrawlQuality.js';

describe('crawl quality', () => {
  it('matches VisionQA robots rules before wildcard rules', () => { const policy = new RobotsPolicy(parseRobots('User-agent: *\nDisallow: /private\nUser-agent: VisionQA-Crawler\nAllow: /private/public')); expect(policy.isAllowed('https://example.com/private')).toBe(false); expect(policy.isAllowed('https://example.com/private/public')).toBe(true); });
  it('parses sitemap urlsets and indexes without entities', () => { expect(parseSitemap('<urlset><url><loc>https://example.com/a#x</loc><lastmod>2026-01-01</lastmod></url></urlset>', 'https://example.com/sitemap.xml').entries[0]?.normalizedUrl).toBe('https://example.com/a'); expect(parseSitemap('<sitemapindex><sitemap><loc>https://example.com/child.xml</loc></sitemap></sitemapindex>', 'x').children).toEqual(['https://example.com/child.xml']); });
  it('classifies crawl and sitemap differences', () => { expect(compareUrls(['https://a.test/', 'https://a.test/c'], ['https://a.test/', 'https://a.test/s']) ).toEqual({ MATCHED: ['https://a.test/'], CRAWL_ONLY: ['https://a.test/c'], SITEMAP_ONLY: ['https://a.test/s'], ORPHAN_CANDIDATE: ['https://a.test/s'] }); });
});
