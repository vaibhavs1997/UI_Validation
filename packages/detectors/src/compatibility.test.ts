import { describe, expect, it } from 'vitest';
import type { BrowserFact, BrowserPageExecution } from '@visionqa/contracts';
import { BrowserCompatibilityComparisonService, normalizeBrowserError, normalizeRequestIdentity } from './compatibility.js';

const execution = (browser: BrowserPageExecution['browser'], id: string = browser): BrowserPageExecution => ({ id, scanId: 'scan', projectId: 'project', pageUrl: 'https://example.com/app', browser, viewport: { width: 1366, height: 768 }, status: 'COMPLETED', startedAt: '', consoleErrorCount: 0, pageErrorCount: 0, failedRequestCount: 0 });
const fact = (executionId: string, fields: Partial<BrowserFact>): BrowserFact => ({ id: `${executionId}-fact`, scanId: 'scan', executionId, kind: 'PAGE_ERROR', timestamp: '', ...fields });

describe('browser compatibility comparison', () => {
  const service = new BrowserCompatibilityComparisonService();
  it('normalizes browser-specific stack formatting without merging distinct errors', () => { expect(normalizeBrowserError('ReferenceError: X at https://example.com/app.js:10:4')).toBe('ReferenceError: X at <url>'); expect(normalizeBrowserError('TypeError: Y')).not.toBe(normalizeBrowserError('ReferenceError: X')); });
  it('finds a Firefox-only console error', () => { const result = service.compare([execution('chromium'), execution('firefox', 'ff'), execution('webkit')], [fact('ff', { kind: 'PAGE_ERROR', message: 'ReferenceError: X is not defined' })], [], ['browser-console-differences']); expect(result).toHaveLength(1); expect(result[0]!.affectedBrowser).toBe('firefox'); });
  it('does not report a request failure shared by all browsers', () => { const executions = [execution('chromium'), execution('firefox', 'ff'), execution('webkit')]; const facts = executions.map((item) => fact(item.id, { kind: 'FAILED_REQUEST', url: 'https://example.com/app.js?cacheBust=123', resourceType: 'script' })); expect(service.compare(executions, facts, [], ['browser-request-differences'])).toEqual([]); });
  it('normalizes volatile request parameters while retaining the resource path', () => { expect(normalizeRequestIdentity('https://example.com/app.js?cacheBust=123')).toBe('https://example.com/app.js'); expect(normalizeRequestIdentity('https://example.com/app.js?version=2')).toBe('https://example.com/app.js?version=2'); });
  it('does not compare unrelated pages or a single browser', () => { const other = { ...execution('firefox', 'ff'), pageUrl: 'https://example.com/other' }; const facts = [fact('ff', { kind: 'PAGE_ERROR', message: 'ReferenceError: X' })]; expect(service.compare([execution('chromium'), other], facts, [], ['browser-console-differences'])).toEqual([]); expect(service.compare([execution('chromium')], facts, [], ['browser-console-differences'])).toEqual([]); });
});
