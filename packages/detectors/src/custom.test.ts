import { describe, expect, it } from 'vitest';
import { evaluateCustomCheck, validateCustomCheckDefinition } from './custom.js';

describe('custom check validation', () => {
  it('accepts bounded CSS selectors and rejects malformed selectors', () => {
    const valid = { targetType: 'DOM' as const, source: 'text', selector: '#submit', operator: 'CONTAINS' as const, expected: 'Submit' };
    expect(validateCustomCheckDefinition(valid).valid).toBe(true);
    expect(validateCustomCheckDefinition({ ...valid, selector: 'div[' }).valid).toBe(false);
    expect(validateCustomCheckDefinition({ ...valid, selector: 'x'.repeat(301) }).valid).toBe(false);
  });
  it('rejects incompatible numeric and text operators', () => {
    expect(validateCustomCheckDefinition({ targetType: 'PERFORMANCE', source: 'lcp', operator: 'CONTAINS', expected: '3' }).valid).toBe(false);
    expect(validateCustomCheckDefinition({ targetType: 'DOM', source: 'count', selector: '#submit', operator: 'COUNT_EQUALS', expected: 1 }).valid).toBe(true);
  });
});

describe('custom check evaluator', () => {
  const dom = { elements: [{ ref: 'e1', selector: '#submit', text: 'Submit order', visible: true, enabled: true, attributes: { class: 'primary' } }] };
  it('evaluates DOM existence, count, text, attribute and visibility', () => {
    expect(evaluateCustomCheck({ targetType: 'DOM', source: 'text', selector: '#submit', operator: 'CONTAINS', expected: 'Submit' }, { dom }).status).toBe('PASS');
    expect(evaluateCustomCheck({ targetType: 'DOM', source: 'count', selector: '#submit', operator: 'COUNT_EQUALS', expected: 1 }, { dom }).status).toBe('PASS');
    expect(evaluateCustomCheck({ targetType: 'ATTRIBUTE', source: 'attribute', selector: '#submit', property: 'class', operator: 'EQUALS', expected: 'primary' }, { dom }).status).toBe('PASS');
    expect(evaluateCustomCheck({ targetType: 'DOM', source: 'visible', selector: '#submit', operator: 'VISIBLE' }, { dom }).status).toBe('PASS');
  });
  it('evaluates HTTP, browser and performance facts without fetching', () => {
    expect(evaluateCustomCheck({ targetType: 'HTTP', source: 'status', operator: 'EQUALS', expected: 200 }, { http: { status: 200 } }).status).toBe('PASS');
    expect(evaluateCustomCheck({ targetType: 'BROWSER', source: 'consoleErrors', operator: 'LESS_OR_EQUAL', expected: 0 }, { browser: { consoleErrorCount: 0, pageErrorCount: 0, failedRequestCount: 0, httpErrorCount: 0 } }).status).toBe('PASS');
    expect(evaluateCustomCheck({ targetType: 'PERFORMANCE', source: 'lcp', operator: 'LESS_THAN', expected: 3000 }, { performance: { pageUrl: 'https://example.com', browser: 'chromium', viewport: { width: 1, height: 1 }, navigation: { ttfbMs: null, domContentLoadedMs: null, loadMs: null }, webVitals: { fcpMs: null, lcpMs: 2500, cls: null }, network: { requestCount: 0, failedRequestCount: 0, transferredBytes: null, encodedBytes: null }, resources: [] } }).status).toBe('PASS');
    expect(evaluateCustomCheck({ targetType: 'PERFORMANCE', source: 'lcp', operator: 'LESS_THAN', expected: 3000 }, { performance: { pageUrl: 'https://example.com', browser: 'chromium', viewport: { width: 1, height: 1 }, navigation: { ttfbMs: null, domContentLoadedMs: null, loadMs: null }, webVitals: { fcpMs: null, lcpMs: null, cls: null }, network: { requestCount: 0, failedRequestCount: 0, transferredBytes: null, encodedBytes: null }, resources: [] } }).status).toBe('SKIPPED');
  });
});
