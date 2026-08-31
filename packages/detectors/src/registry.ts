import type { QaModule } from '@visionqa/contracts';
export interface DetectorMetadata { id: string; name: string; module: QaModule; requirements: { browser?: boolean; dom?: boolean; http?: boolean; crawl?: boolean }; status: 'planned' | 'available' }
export const detectorCatalog: DetectorMetadata[] = [
  { id: 'crawl', name: 'Crawl website', module: 'crawl-site-structure', requirements: { crawl: true }, status: 'available' },
  { id: 'robots', name: 'Robots.txt', module: 'crawl-site-structure', requirements: { crawl: true }, status: 'available' },
  { id: 'sitemap', name: 'Sitemap', module: 'crawl-site-structure', requirements: { crawl: true }, status: 'available' },
  { id: 'redirect-analysis', name: 'Redirect analysis', module: 'crawl-site-structure', requirements: { crawl: true }, status: 'available' },
  { id: 'crawl-sitemap-comparison', name: 'Crawl vs sitemap comparison', module: 'crawl-site-structure', requirements: { crawl: true }, status: 'available' },
  { id: 'broken-internal-links', name: 'Broken internal links', module: 'links-resources', requirements: { http: true }, status: 'available' },
  { id: 'broken-external-links', name: 'Broken external links', module: 'links-resources', requirements: { http: true }, status: 'available' },
  { id: 'redirect-quality', name: 'Redirect quality', module: 'links-resources', requirements: { http: true }, status: 'available' },
  { id: 'broken-images', name: 'Broken images', module: 'links-resources', requirements: { http: true }, status: 'available' },
  { id: 'failed-scripts', name: 'Failed scripts', module: 'links-resources', requirements: { http: true }, status: 'available' },
  { id: 'failed-stylesheets', name: 'Failed stylesheets', module: 'links-resources', requirements: { http: true }, status: 'available' },
  { id: 'failed-fonts', name: 'Failed fonts', module: 'links-resources', requirements: { http: true }, status: 'available' },
  { id: 'failed-media', name: 'Failed media', module: 'links-resources', requirements: { http: true }, status: 'available' },
  { id: 'console-errors', name: 'Console errors', module: 'browser-network', requirements: { browser: true }, status: 'available' },
  { id: 'javascript-errors', name: 'JavaScript errors', module: 'browser-network', requirements: { browser: true }, status: 'available' },
  { id: 'failed-browser-requests', name: 'Failed browser requests', module: 'browser-network', requirements: { browser: true }, status: 'available' },
  { id: 'http-browser-errors', name: 'HTTP browser errors', module: 'browser-network', requirements: { browser: true }, status: 'available' },
  { id: 'text-overlap', name: 'Text overlap', module: 'visual-responsive', requirements: { browser: true, dom: true }, status: 'available' },
  { id: 'element-overlap', name: 'Element overlap', module: 'visual-responsive', requirements: { browser: true, dom: true }, status: 'available' },
  { id: 'clipped-content', name: 'Clipped content', module: 'visual-responsive', requirements: { browser: true, dom: true }, status: 'planned' },
  { id: 'horizontal-overflow', name: 'Horizontal overflow', module: 'visual-responsive', requirements: { browser: true, dom: true }, status: 'available' },
  { id: 'viewport-overflow', name: 'Viewport overflow', module: 'visual-responsive', requirements: { browser: true, dom: true }, status: 'available' },
  { id: 'fixed-element-obstruction', name: 'Fixed/sticky obstruction', module: 'visual-responsive', requirements: { browser: true, dom: true }, status: 'planned' },
  { id: 'responsive-layout', name: 'Responsive layout', module: 'visual-responsive', requirements: { browser: true, dom: true }, status: 'planned' },
];
export class InMemoryDetectorRegistry {
  list(module?: QaModule): DetectorMetadata[] { return detectorCatalog.filter((detector) => !module || detector.module === module); }
  get(id: string): DetectorMetadata | undefined { return detectorCatalog.find((detector) => detector.id === id); }
}
