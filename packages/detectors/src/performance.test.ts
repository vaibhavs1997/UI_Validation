import { describe, expect, it } from 'vitest';
import { analyzePerformance, classifyCls, classifyLcp, type PerformanceSnapshot } from './performance.js';
const snapshot = (overrides: Partial<PerformanceSnapshot> = {}): PerformanceSnapshot => ({ pageUrl: 'https://example.com', browser: 'chromium', viewport: { width: 1366, height: 768 }, navigation: { ttfbMs: 120, domContentLoadedMs: 500, loadMs: 6000 }, webVitals: { fcpMs: 1000, lcpMs: 4500, cls: .3 }, network: { requestCount: 121, failedRequestCount: 0, transferredBytes: 9 * 1024 * 1024, encodedBytes: 8 * 1024 * 1024 }, resources: [], ...overrides });
describe('performance detectors', () => {
  it('classifies LCP and CLS boundaries', () => { expect(classifyLcp(2500)).toBe('GOOD'); expect(classifyLcp(4000)).toBe('NEEDS_IMPROVEMENT'); expect(classifyLcp(4001)).toBe('POOR'); expect(classifyCls(.1)).toBe('GOOD'); expect(classifyCls(.25)).toBe('NEEDS_IMPROVEMENT'); expect(classifyCls(.251)).toBe('POOR'); expect(classifyLcp(null)).toBe('UNAVAILABLE'); });
  it('creates only selected performance findings', () => { const findings = analyzePerformance(snapshot(), ['core-web-vitals']); expect(findings.map((item) => item.detectorId)).toEqual(['core-web-vitals', 'core-web-vitals']); });
  it('does not convert unavailable values into findings', () => { const result = analyzePerformance(snapshot({ navigation: { ttfbMs: null, domContentLoadedMs: null, loadMs: null }, webVitals: { fcpMs: null, lcpMs: null, cls: null } }), ['navigation-performance', 'core-web-vitals']); expect(result).toEqual([]); });
});
