import { describe, expect, it } from 'vitest';
import { scanJobIdentity } from './index.js';

describe('scan job identity', () => {
  it('is stable for retries and separates browser engines', () => {
    expect(scanJobIdentity({ scanId: 'scan-1', capability: 'browser', taskKey: 'browser:chromium', browsers: ['chromium'] })).toBe('scan-1:browser:chromium');
    expect(scanJobIdentity({ scanId: 'scan-1', capability: 'browser', taskKey: 'browser:firefox', browsers: ['firefox'] })).not.toBe('scan-1:browser:chromium');
  });
});
