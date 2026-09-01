import { describe, expect, it, vi } from 'vitest';
import type { Project, Scan } from '@visionqa/contracts';
import { ScanOrchestrator } from './scans.orchestrator.js';

const project: Project = {
  id: 'p1',
  name: 'Project',
  baseUrl: 'https://example.com',
  createdBy: 'u1',
  organizationId: null,
  environments: [
    {
      id: 'e1',
      name: 'Production',
      type: 'production',
      baseUrl: 'https://example.com',
      isDefault: true,
    },
  ],
};
const urlFirstProject: Project = {
  id: 'p1',
  name: 'Project',
  createdBy: 'u1',
  organizationId: null,
  environments: [],
};
const scan = (
  checks: string[],
  module: Scan['module'] = 'crawl-site-structure',
  withEnvironment = true,
): Scan => ({
  id: 's1',
  projectId: 'p1',
  ...(withEnvironment ? { environmentId: 'e1' } : {}),
  createdBy: 'u1',
  scope: 'site',
  type: 'module',
  module,
  checks,
  requestedUrls: [],
  browsers: ['chromium'],
  viewports: [{ width: 1440, height: 900 }],
  options: {},
  status: 'queued',
  progress: { completed: 0, total: 1, percent: 0 },
  createdAt: '',
  updatedAt: '',
});
const urlFirstScan: Scan = {
  ...scan(['crawl'], 'crawl-site-structure', false),
  target: {
    requestedUrl: 'https://another.example/path',
    normalizedUrl: 'https://another.example/path',
    origin: 'https://another.example',
    protocol: 'https',
    hostname: 'another.example',
    finalUrl: null,
  },
};

describe('ScanOrchestrator', () => {
  it('dispatches only crawl work for crawl checks', async () => {
    const dispatcher = {
      dispatchCrawl: vi.fn(),
      dispatchHttp: vi.fn(),
      dispatchBrowser: vi.fn(),
    };
    await new ScanOrchestrator().dispatch(scan(['crawl']), project, dispatcher);
    expect(dispatcher.dispatchCrawl).toHaveBeenCalledOnce();
    expect(dispatcher.dispatchHttp).not.toHaveBeenCalled();
    expect(dispatcher.dispatchBrowser).not.toHaveBeenCalled();
  });
  it('groups checks by required capability', () => {
    expect(
      new ScanOrchestrator().buildPlan(scan(['crawl', 'robots'])).tasks,
    ).toEqual([
      expect.objectContaining({
        key: 'crawl',
        capability: 'crawl',
        checks: ['crawl', 'robots'],
      }),
    ]);
  });
  it('plans one shared browser task per requested engine for a full scan', () => {
    const full: Scan = {
      ...scan([], 'full-scan'),
      type: 'full',
      modules: [
        { module: 'visual-responsive', checks: ['text-overlap'] },
        { module: 'accessibility-seo', checks: ['accessible-name'] },
        { module: 'performance-compatibility', checks: ['core-web-vitals'] },
      ],
      browsers: ['chromium', 'firefox'],
    };
    const tasks = new ScanOrchestrator().buildPlan(full).tasks;
    expect(tasks.filter((task) => task.capability === 'browser')).toHaveLength(
      2,
    );
    expect(tasks.filter((task) => task.capability === 'browser')[0]).toEqual(
      expect.objectContaining({
        checks: ['text-overlap', 'accessible-name', 'core-web-vitals'],
        modules: [
          'visual-responsive',
          'accessibility-seo',
          'performance-compatibility',
        ],
        viewports: [{ width: 1440, height: 900 }],
      }),
    );
  });
  it('unions responsive viewports while keeping one shared desktop context', () => {
    const full: Scan = {
      ...scan([], 'full-scan'),
      type: 'full',
      modules: [
        { module: 'visual-responsive', checks: ['horizontal-overflow'] },
        { module: 'accessibility-seo', checks: ['accessible-name'] },
      ],
      viewports: [
        { width: 390, height: 844 },
        { width: 1440, height: 900 },
        { width: 1440, height: 900 },
      ],
    };
    expect(
      new ScanOrchestrator()
        .buildPlan(full)
        .tasks.find((task) => task.capability === 'browser'),
    ).toEqual(
      expect.objectContaining({
        viewports: [
          { width: 390, height: 844 },
          { width: 1440, height: 900 },
        ],
      }),
    );
  });
  it('dispatches a new scan when the project has no environments', async () => {
    const dispatcher = {
      dispatchCrawl: vi.fn(),
      dispatchHttp: vi.fn(),
      dispatchBrowser: vi.fn(),
    };
    await new ScanOrchestrator().dispatch(
      urlFirstScan,
      urlFirstProject,
      dispatcher,
    );
    expect(dispatcher.dispatchCrawl).toHaveBeenCalledWith(
      expect.objectContaining({ targetUrl: 'https://another.example/path' }),
    );
  });
});
