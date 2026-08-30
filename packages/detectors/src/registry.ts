import type { QaModule } from '@visionqa/contracts';
export interface DetectorMetadata { id: string; name: string; module: QaModule; requirements: { browser?: boolean; dom?: boolean; http?: boolean; crawl?: boolean }; status: 'planned' | 'available' }
export const detectorCatalog: DetectorMetadata[] = [
  { id: 'crawl', name: 'Crawl website', module: 'crawl-site-structure', requirements: { crawl: true }, status: 'available' },
  { id: 'robots', name: 'Robots.txt', module: 'crawl-site-structure', requirements: { http: true }, status: 'planned' },
  { id: 'sitemap', name: 'Sitemap', module: 'crawl-site-structure', requirements: { http: true }, status: 'planned' },
  { id: 'broken-links', name: 'Broken links', module: 'links-resources', requirements: { http: true }, status: 'planned' },
  { id: 'broken-images', name: 'Broken images', module: 'links-resources', requirements: { http: true }, status: 'planned' },
  { id: 'text-overlap', name: 'Text overlap', module: 'visual-responsive', requirements: { browser: true, dom: true }, status: 'planned' },
  { id: 'horizontal-overflow', name: 'Horizontal overflow', module: 'visual-responsive', requirements: { browser: true, dom: true }, status: 'planned' },
];
export class InMemoryDetectorRegistry {
  list(module?: QaModule): DetectorMetadata[] { return detectorCatalog.filter((detector) => !module || detector.module === module); }
  get(id: string): DetectorMetadata | undefined { return detectorCatalog.find((detector) => detector.id === id); }
}
