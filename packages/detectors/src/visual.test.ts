import { describe, expect, it } from 'vitest';
import type { VisualPageSnapshot } from '@visionqa/contracts';
import { compareVisualViewports, detectVisual } from './visual.js';

const base = (overrides: Partial<VisualPageSnapshot> = {}): VisualPageSnapshot => ({ scanId: 's1', executionId: 'e1', pageUrl: 'https://example.com', browser: 'chromium', viewport: { width: 390, height: 844 }, documentWidth: 390, documentHeight: 844, elements: [], capturedAt: new Date().toISOString(), ...overrides });
const item = (overrides: Partial<VisualPageSnapshot['elements'][number]> = {}) => ({ ref: 'e1', tagName: 'div', textPreview: 'Submit', selector: '#submit', rect: { x: 10, y: 10, width: 120, height: 40 }, display: 'block', visibility: 'visible', position: 'static', overflow: 'visible', zIndex: 'auto', fontSize: '16px', lineHeight: 'normal', whiteSpace: 'normal', interactive: false, ...overrides });

describe('visual detectors', () => {
  it('detects visible content clipped by hidden overflow', () => {
    const findings = detectVisual(base({ elements: [item({ overflow: 'hidden', clientWidth: 100, scrollWidth: 160 })] }), ['clipped-content']);
    expect(findings[0]?.detectorId).toBe('clipped-content');
  });
  it('ignores intentional ellipsis and scrollable containers', () => {
    expect(detectVisual(base({ elements: [item({ overflow: 'hidden', clientWidth: 100, scrollWidth: 160, textOverflow: 'ellipsis' })] }), ['clipped-content'])).toHaveLength(0);
    expect(detectVisual(base({ elements: [item({ overflow: 'auto', clientWidth: 100, scrollWidth: 160 })] }), ['clipped-content'])).toHaveLength(0);
  });
  it('requires paint-order evidence for fixed obstruction', () => {
    const overlay = item({ ref: 'overlay', textPreview: 'Cookie banner', selector: '#cookie', position: 'fixed', rect: { x: 0, y: 0, width: 390, height: 100 }, paintedAboveRefs: ['target'] });
    const target = item({ ref: 'target', tagName: 'button', textPreview: 'Submit', selector: '#submit', interactive: true, rect: { x: 100, y: 40, width: 100, height: 40 } });
    expect(detectVisual(base({ elements: [overlay, target] }), ['fixed-element-obstruction'])).toHaveLength(1);
    expect(detectVisual(base({ elements: [overlay, { ...target, ref: 'target-2' }] }), ['fixed-element-obstruction'])).toHaveLength(0);
  });
  it('detects a finding that changes between selected viewports', () => {
    const first = base({ executionId: 'mobile', viewport: { width: 390, height: 844 }, elements: [item({ overflow: 'hidden', clientWidth: 100, scrollWidth: 160 })] });
    const second = base({ executionId: 'desktop', viewport: { width: 1366, height: 768 }, elements: [item({ overflow: 'visible', clientWidth: 120, scrollWidth: 120 })] });
    const results = [{ snapshot: first, findings: detectVisual(first, ['clipped-content']) }, { snapshot: second, findings: detectVisual(second, ['clipped-content']) }];
    expect(compareVisualViewports(results)[0]?.detectorId).toBe('responsive-layout');
  });
});
