import type {
  CrawlPage,
  ScanOptions,
  ScanPageTarget,
  ScanScope,
  ScanTarget,
  Viewport,
} from '@visionqa/contracts';

const HTML_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml']);

const canonicalUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};

const isHtmlPage = (page: CrawlPage): boolean => {
  const contentType = page.contentType?.split(';', 1)[0]?.trim().toLowerCase();
  return Boolean(contentType && HTML_CONTENT_TYPES.has(contentType));
};

export function targetPageTarget(target: ScanTarget): ScanPageTarget {
  return {
    url: target.requestedUrl,
    normalizedUrl: target.normalizedUrl,
    source: 'target',
    depth: 0,
  };
}

export function selectBrowserPageTargets(
  pages: CrawlPage[],
  target: ScanTarget,
  scope: ScanScope,
  options: ScanOptions = {},
): ScanPageTarget[] {
  if (scope === 'single-page') return [targetPageTarget(target)];

  const root = canonicalUrl(target.normalizedUrl);
  if (!root) return [];
  const origin = target.origin;
  const byUrl = new Map<string, ScanPageTarget & { discoveredAt: string }>();
  for (const page of pages) {
    if (page.crawlStatus !== 'FETCHED' || !isHtmlPage(page)) continue;
    const normalizedUrl = canonicalUrl(page.normalizedUrl);
    if (!normalizedUrl) continue;
    let parsed: URL;
    try {
      parsed = new URL(normalizedUrl);
    } catch {
      continue;
    }
    if ((options.sameOriginOnly ?? true) && parsed.origin !== origin) continue;
    const candidate = {
      url: page.url,
      normalizedUrl,
      ...(page.sourceUrl ? { discoveredFrom: page.sourceUrl } : {}),
      ...(page.depth !== undefined ? { depth: page.depth } : {}),
      crawlPageId: page.id,
      source: 'crawl' as const,
      discoveredAt: page.discoveredAt,
    };
    const existing = byUrl.get(normalizedUrl);
    if (!existing || candidate.discoveredAt < existing.discoveredAt)
      byUrl.set(normalizedUrl, candidate);
  }

  const sorted = [...byUrl.values()].sort((left, right) => {
    const rootOrder =
      Number(right.normalizedUrl === root) -
      Number(left.normalizedUrl === root);
    if (rootOrder) return rootOrder;
    const depthOrder =
      (left.depth ?? Number.MAX_SAFE_INTEGER) -
      (right.depth ?? Number.MAX_SAFE_INTEGER);
    if (depthOrder) return depthOrder;
    const discoveredOrder = left.discoveredAt.localeCompare(right.discoveredAt);
    return (
      discoveredOrder || left.normalizedUrl.localeCompare(right.normalizedUrl)
    );
  });
  const cap = Math.max(
    0,
    Math.min(options.maxBrowserPages ?? options.maxPages ?? 100, 1000),
  );
  return sorted.slice(0, cap).map((page) => ({
    url: page.url,
    normalizedUrl: page.normalizedUrl,
    ...(page.discoveredFrom ? { discoveredFrom: page.discoveredFrom } : {}),
    ...(page.depth !== undefined ? { depth: page.depth } : {}),
    ...(page.crawlPageId ? { crawlPageId: page.crawlPageId } : {}),
    source: page.source,
  }));
}

export function unionBrowserViewports(
  checks: string[],
  configured: Viewport[],
): Viewport[] {
  const responsive = checks.some((check) =>
    [
      'text-overlap',
      'element-overlap',
      'clipped-content',
      'horizontal-overflow',
      'viewport-overflow',
      'fixed-element-obstruction',
      'responsive-layout',
    ].includes(check),
  );
  const selected = responsive
    ? configured
    : [configured.find((viewport) => viewport.width >= 1024) ?? configured[0]!];
  const seen = new Set<string>();
  return selected.filter((viewport) => {
    const key = `${viewport.width}x${viewport.height}x${viewport.deviceScaleFactor ?? 1}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function browserContextCount(
  pages: number,
  browsers: string[],
  viewports: Viewport[],
): number {
  return pages * new Set(browsers).size * viewports.length;
}
