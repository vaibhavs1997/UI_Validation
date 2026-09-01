import { describe, expect, it } from 'vitest';
import { deriveFullScanStatus } from './index.js';

describe('full scan terminal semantics', () => {
  it('stays running while any required capability is pending', () => {
    expect(deriveFullScanStatus({ crawl: 'COMPLETED', 'browser:chromium': 'RUNNING' })).toEqual({ status: 'running', allTerminal: false });
  });
  it('uses partial coverage for unavailable capabilities', () => {
    expect(deriveFullScanStatus({ crawl: 'COMPLETED', 'browser:firefox': 'UNAVAILABLE' })).toEqual({ status: 'partial', allTerminal: true });
  });
  it('lets cancellation dominate late failures', () => {
    expect(deriveFullScanStatus({ crawl: 'CANCELLED', browser: 'FAILED' })).toEqual({ status: 'cancelled', allTerminal: true });
  });
});
