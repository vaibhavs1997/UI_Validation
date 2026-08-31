import { describe, expect, it } from 'vitest';
import { analyzeAccessibilitySeo, type PageMetadataSnapshot } from './accessibility.js';

const base = (overrides: Partial<PageMetadataSnapshot> = {}): PageMetadataSnapshot => ({
  title: 'Example', description: 'Example description', lang: 'en', canonical: ['https://example.com'], robots: 'index,follow',
  openGraph: { 'og:title': 'Example', 'og:description': 'Example', 'og:image': '/image.png', 'og:url': 'https://example.com' },
  hreflang: [{ lang: 'en', href: 'https://example.com' }], headings: [{ ref: 'h1', level: 1, text: 'Example' }],
  duplicateIds: [], landmarks: { main: 1 }, elements: {} as PageMetadataSnapshot['elements'], images: [], controls: [], ...overrides,
});

const control = (overrides: Partial<PageMetadataSnapshot['controls'][number]> = {}) => ({ ref: 'a1', tagName: 'button', text: '', name: '', required: false, disabled: false, tabIndex: 0, visible: true, rect: { x: 0, y: 0, width: 10, height: 10 }, ...overrides });

describe('accessibility and SEO detectors', () => {
  it('reports unnamed interactive controls and accepts an aria name', () => {
    expect(analyzeAccessibilitySeo(base({ controls: [control()] }), ['accessible-name']).map((item) => item.detectorId)).toEqual(['accessible-name']);
    expect(analyzeAccessibilitySeo(base({ controls: [control({ name: 'Open menu' })] }), ['accessible-name'])).toEqual([]);
  });

  it('reports missing image alt text but accepts decorative alt', () => {
    const image = { ...control({ ref: 'i1', tagName: 'img' }) };
    expect(analyzeAccessibilitySeo(base({ images: [image] }), ['image-alt'])).toHaveLength(1);
    expect(analyzeAccessibilitySeo(base({ images: [{ ...image, alt: '' }] }), ['image-alt'])).toEqual([]);
  });

  it('reports duplicate ids and invalid document language', () => {
    const findings = analyzeAccessibilitySeo(base({ duplicateIds: [{ id: 'content', refs: ['a1', 'a2'] }], lang: '' }), ['duplicate-id', 'document-language']);
    expect(findings.map((item) => item.detectorId)).toEqual(['duplicate-id', 'document-language']);
  });

  it('only executes selected checks', () => {
    const findings = analyzeAccessibilitySeo(base({ title: '' }), ['meta-description']);
    expect(findings).toEqual([]);
  });
});
