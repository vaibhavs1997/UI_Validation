import { describe, expect, it } from 'vitest';
import { validateBrowserJob } from './BrowserWorker.js';
describe('browser worker foundation', () => { it('rejects malformed browser jobs', () => { expect(() => validateBrowserJob({ capability: 'browser', scanId: '', projectId: 'p', environmentId: 'e', targetUrl: 'https://example.com', checks: [], options: {}, module: 'browser-network', browsers: ['chromium'], viewports: [] })).toThrow('Invalid browser job'); }); });
