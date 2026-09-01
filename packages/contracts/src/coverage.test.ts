import { describe, expect, it } from 'vitest';
import { coverageCanReconcile, type FullScanCoverageRecord } from './index.js';

const base: FullScanCoverageRecord = {
  detectorId: 'accessible-name',
  normalizedPageUrl: 'https://example.com/about',
  status: 'COVERED',
  browser: 'chromium',
  viewport: { width: 1440, height: 900 },
};

describe('coverage-aware reconciliation', () => {
  it('requires covered matching page and execution context', () => {
    expect(
      coverageCanReconcile(
        {
          detectorId: 'accessible-name',
          pageUrl: 'https://example.com/about#team',
          browser: 'chromium',
          viewport: { width: 1440, height: 900 },
        },
        base,
      ),
    ).toBe(true);
    expect(
      coverageCanReconcile(
        {
          detectorId: 'accessible-name',
          pageUrl: 'https://example.com/contact',
        },
        base,
      ),
    ).toBe(false);
  });

  it('does not reconcile omitted, failed, or mismatched browser/viewport coverage', () => {
    expect(
      coverageCanReconcile(
        { detectorId: 'accessible-name', pageUrl: base.normalizedPageUrl },
        { ...base, status: 'FAILED' },
      ),
    ).toBe(false);
    expect(
      coverageCanReconcile(
        {
          detectorId: 'accessible-name',
          pageUrl: base.normalizedPageUrl,
          browser: 'firefox',
        },
        base,
      ),
    ).toBe(false);
    expect(
      coverageCanReconcile(
        {
          detectorId: 'accessible-name',
          pageUrl: base.normalizedPageUrl,
          viewport: { width: 390, height: 844 },
        },
        base,
      ),
    ).toBe(false);
  });

  it('requires compatible custom-check identity', () => {
    expect(
      coverageCanReconcile(
        {
          detectorId: 'custom-check:check-1',
          pageUrl: base.normalizedPageUrl,
          customCheckId: 'check-1',
          customCheckVersion: 2,
        },
        {
          ...base,
          detectorId: 'custom-check:check-1',
          customCheckId: 'check-1',
          customCheckVersion: 2,
        },
      ),
    ).toBe(true);
    expect(
      coverageCanReconcile(
        {
          detectorId: 'custom-check:check-1',
          pageUrl: base.normalizedPageUrl,
          customCheckId: 'check-1',
          customCheckVersion: 1,
        },
        {
          ...base,
          detectorId: 'custom-check:check-1',
          customCheckId: 'check-1',
          customCheckVersion: 2,
        },
      ),
    ).toBe(false);
  });
});
