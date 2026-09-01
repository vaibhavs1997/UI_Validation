'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useProjects } from '@/features/projects/project-context';
import {
  cancelScan,
  getBrowserFacts,
  getBrowserPages,
  getBrowserSummary,
  getCrawlComparison,
  getCrawlPages,
  getCrawlQuality,
  getCrawlSummary,
  getScan,
  getScanEvidence,
} from '@/features/scans/scan.service';
import { ScanStatusBadge } from '@/features/scans/components/ScanStatusBadge';
import type {
  BrowserFact,
  BrowserPageExecution,
  CrawlPage,
  CrawlSummary,
  Evidence,
  Scan,
} from '@visionqa/contracts';
import { VisualResultsPanel } from '@/features/scans/components/VisualResultsPanel';
import { TargetUrlDisplay } from '@/features/scans/components/TargetUrlDisplay';
import { InteractionResultsPanel } from '@/features/scans/components/InteractionResultsPanel';
import { AccessibilitySeoResultsPanel } from '@/features/scans/components/AccessibilitySeoResultsPanel';
import { PerformanceCompatibilityResultsPanel } from '@/features/scans/components/PerformanceCompatibilityResultsPanel';
import { FullScanResultsPanel } from '@/features/scans/components/FullScanResultsPanel';
import { GenerateReportButton } from '@/features/reports/GenerateReportButton';

type Tab =
  | 'overview'
  | 'pages'
  | 'findings'
  | 'robots'
  | 'sitemap'
  | 'comparison'
  | 'console'
  | 'network'
  | 'evidence';
type Comparison = {
  matched: string[];
  crawlOnly: string[];
  sitemapOnly: string[];
};

export default function ScanDetailPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const { selectedProject } = useProjects();
  const [scan, setScan] = useState<Scan | null>(null);
  const [pages, setPages] = useState<CrawlPage[]>([]);
  const [summary, setSummary] = useState<CrawlSummary | null>(null);
  const [quality, setQuality] = useState<Record<string, unknown> | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [browserPages, setBrowserPages] = useState<BrowserPageExecution[]>([]);
  const [browserFacts, setBrowserFacts] = useState<BrowserFact[]>([]);
  const [browserSummary, setBrowserSummary] = useState<{
    pagesExecuted: number;
    uniquePages: number;
    consoleErrors: number;
    javascriptErrors: number;
    failedRequests: number;
    httpErrors: number;
    networkPolicyBlocked: number;
    screenshots: number;
  } | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const selectedEnvironment = scan?.target
    ? {
        name: `${scan.target.safeDisplayUrl ?? scan.target.requestedUrl} · ${scan.target.protocol.toUpperCase()} · ${scan.scope} · ${scan.checks.join(', ')}`,
      }
    : null;

  useEffect(() => {
    if (!selectedProject || !scanId) return;
    let active = true;
    const refresh = async () => {
      try {
        const next = await getScan(selectedProject.id, scanId);
        if (!active) return;
        setScan(next);
        if (next.module === 'browser-network') {
          const [
            pageResult,
            summaryResult,
            consoleResult,
            networkResult,
            evidenceResult,
          ] = await Promise.all([
            getBrowserPages(selectedProject.id, scanId),
            getBrowserSummary(selectedProject.id, scanId),
            getBrowserFacts(selectedProject.id, scanId, 'console'),
            getBrowserFacts(selectedProject.id, scanId, 'network'),
            getScanEvidence(selectedProject.id, scanId),
          ]);
          if (active) {
            setBrowserPages(pageResult.executions);
            setBrowserSummary(summaryResult);
            setBrowserFacts([...consoleResult.facts, ...networkResult.facts]);
            setEvidence(evidenceResult.evidence);
          }
        } else if (
          next.checks.includes('crawl') ||
          next.checks.includes('robots') ||
          next.checks.includes('sitemap')
        ) {
          const [pageResult, crawlSummary] = await Promise.all([
            getCrawlPages(selectedProject.id, scanId),
            getCrawlSummary(selectedProject.id, scanId),
          ]);
          if (active) {
            setPages(pageResult.pages);
            setSummary(crawlSummary);
          }
        }
      } catch {
        if (active) setError('Unable to load this scan.');
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (!scan || scan.status === 'queued' || scan.status === 'running')
        void refresh();
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedProject, scanId, scan?.status]);

  useEffect(() => {
    if (
      !selectedProject ||
      !scanId ||
      !scan ||
      (tab !== 'robots' && tab !== 'sitemap' && tab !== 'comparison')
    )
      return;
    const load = async () => {
      try {
        if (tab === 'comparison')
          setComparison(await getCrawlComparison(selectedProject.id, scanId));
        else setQuality(await getCrawlQuality(selectedProject.id, scanId, tab));
      } catch {
        setError(`Unable to load ${tab} results.`);
      }
    };
    void load();
  }, [selectedProject, scanId, scan, tab]);

  const cancel = async () => {
    if (!selectedProject || !scan) return;
    setCancelling(true);
    try {
      setScan(await cancelScan(selectedProject.id, scan.id));
    } catch {
      setError('Unable to cancel scan.');
    } finally {
      setCancelling(false);
    }
  };
  const tabs: Array<[Tab, string]> =
    scan?.module === 'browser-network'
      ? [
          ['overview', 'Overview'],
          ['pages', 'Pages'],
          ['console', 'Console'],
          ['network', 'Network'],
          ['evidence', 'Evidence'],
        ]
      : scan?.module === 'visual-responsive'
        ? [
            ['overview', 'Overview'],
            ['findings', 'Findings'],
            ['pages', 'Pages'],
            ['evidence', 'Evidence'],
          ]
        : [
            ['overview', 'Overview'],
            ['pages', 'Pages'],
            ['robots', 'Robots'],
            ['sitemap', 'Sitemap'],
            ['comparison', 'Comparison'],
          ];

  const browserFactsFor = (kind: BrowserFact['kind']) =>
    browserFacts.filter((fact) => fact.kind === kind);
  if (scan?.module === 'full-scan' && selectedProject)
    return (
      <section className="scan-page">
        <Link className="scan-back-link" href="/scans">
          ← Scan history
        </Link>
        <p className="dashboard-eyebrow">SCAN DETAIL · FULL SCAN</p>
        <h1 className="dashboard-page-title">Full Scan</h1>
        <GenerateReportButton projectId={selectedProject.id} scan={scan} />
        <FullScanResultsPanel
          projectId={selectedProject.id}
          scan={scan}
          onScan={setScan}
        />
      </section>
    );
  if (scan?.module === 'interactions-forms' && selectedProject)
    return (
      <section className="scan-page">
        <Link className="scan-back-link" href="/scans">
          ← Scan history
        </Link>
        <p className="dashboard-eyebrow">SCAN DETAIL</p>
        <h1 className="dashboard-page-title">Interactions &amp; Forms</h1>
        <GenerateReportButton projectId={selectedProject.id} scan={scan} />
        {error && (
          <p className="scan-error" role="alert">
            {error}
          </p>
        )}
        <div className="scan-detail-card">
          <div className="scan-detail-header">
            <div>
              <h2>Interaction scan</h2>
              <p>
                <TargetUrlDisplay
                  url={scan.target?.requestedUrl ?? 'Target unavailable'}
                />{' '}
                · {scan.browsers.join(', ')}
              </p>
            </div>
            <ScanStatusBadge status={scan.status} />
          </div>
        </div>
        <InteractionResultsPanel
          projectId={selectedProject.id}
          scanId={scan.id}
        />
      </section>
    );
  if (scan?.module === 'visual-responsive' && selectedProject)
    return (
      <section className="scan-page">
        <Link className="scan-back-link" href="/scans">
          ← Scan history
        </Link>
        <p className="dashboard-eyebrow">SCAN DETAIL</p>
        <h1 className="dashboard-page-title">Visual &amp; Responsive</h1>
        <GenerateReportButton projectId={selectedProject.id} scan={scan} />
        {error && (
          <p className="scan-error" role="alert">
            {error}
          </p>
        )}
        <div className="scan-detail-card">
          <div className="scan-detail-header">
            <div>
              <h2>Visual scan</h2>
              <p>
                <TargetUrlDisplay
                  url={scan.target?.requestedUrl ?? 'Target unavailable'}
                />{' '}
                · {scan.browsers.join(', ')} ·{' '}
                {scan.viewports
                  .map((viewport) => `${viewport.width}×${viewport.height}`)
                  .join(', ')}
              </p>
            </div>
            <ScanStatusBadge status={scan.status} />
          </div>
        </div>
        <VisualResultsPanel projectId={selectedProject.id} scanId={scan.id} />
      </section>
    );
  if (scan?.module === 'accessibility-seo' && selectedProject)
    return (
      <section className="scan-page">
        <Link className="scan-back-link" href="/scans">
          ← Scan history
        </Link>
        <p className="dashboard-eyebrow">SCAN DETAIL</p>
        <h1 className="dashboard-page-title">Accessibility &amp; SEO</h1>
        <GenerateReportButton projectId={selectedProject.id} scan={scan} />
        {error && (
          <p className="scan-error" role="alert">
            {error}
          </p>
        )}
        <div className="scan-detail-card">
          <div className="scan-detail-header">
            <div>
              <h2>Accessibility and SEO scan</h2>
              <p>
                <TargetUrlDisplay
                  url={scan.target?.requestedUrl ?? 'Target unavailable'}
                />{' '}
                · {scan.browsers.join(', ')}
              </p>
            </div>
            <ScanStatusBadge status={scan.status} />
          </div>
        </div>
        <AccessibilitySeoResultsPanel
          projectId={selectedProject.id}
          scanId={scan.id}
        />
      </section>
    );
  if (scan?.module === 'performance-compatibility' && selectedProject)
    return (
      <section className="scan-page">
        <Link className="scan-back-link" href="/scans">
          ← Scan history
        </Link>
        <p className="dashboard-eyebrow">SCAN DETAIL</p>
        <h1 className="dashboard-page-title">
          Performance &amp; Compatibility
        </h1>
        <GenerateReportButton projectId={selectedProject.id} scan={scan} />
        {error && (
          <p className="scan-error" role="alert">
            {error}
          </p>
        )}
        <div className="scan-detail-card">
          <div className="scan-detail-header">
            <div>
              <h2>Performance scan</h2>
              <p>
                <TargetUrlDisplay
                  url={scan.target?.requestedUrl ?? 'Target unavailable'}
                />{' '}
                · {scan.browsers.join(', ')}
              </p>
            </div>
            <ScanStatusBadge status={scan.status} />
          </div>
        </div>
        <PerformanceCompatibilityResultsPanel
          projectId={selectedProject.id}
          scanId={scan.id}
        />
      </section>
    );
  return (
    <section className="scan-page">
      <Link className="scan-back-link" href="/scans">
        ← Scan history
      </Link>
      <p className="dashboard-eyebrow">SCAN DETAIL</p>
      <h1 className="dashboard-page-title">{scan?.module ?? 'Scan'}</h1>
      {scan && selectedProject && (
        <GenerateReportButton projectId={selectedProject.id} scan={scan} />
      )}
      {error && (
        <p className="scan-error" role="alert">
          {error}
        </p>
      )}
      {scan && (
        <>
          <div className="scan-detail-card">
            <div className="scan-detail-header">
              <div>
                <h2>Scan status</h2>
                <p>
                  {selectedProject?.name} ·{' '}
                  {selectedEnvironment?.name ?? 'Environment'}
                </p>
              </div>
              <ScanStatusBadge status={scan.status} />
            </div>
            <dl className="scan-detail-grid">
              <div>
                <dt>Pages discovered</dt>
                <dd>
                  {scan.progress.discovered ??
                    summary?.pagesDiscovered ??
                    browserSummary?.uniquePages ??
                    0}
                </dd>
              </div>
              <div>
                <dt>Pages processed</dt>
                <dd>{scan.progress.processed ?? scan.progress.completed}</dd>
              </div>
              <div>
                <dt>Pages failed</dt>
                <dd>{scan.progress.failed ?? summary?.pagesFailed ?? 0}</dd>
              </div>
              <div>
                <dt>Pending</dt>
                <dd>{scan.progress.pending ?? 0}</dd>
              </div>
            </dl>
            {(scan.status === 'queued' || scan.status === 'running') && (
              <p className="scan-progress-label">Collecting browser results…</p>
            )}
            {(scan.status === 'queued' || scan.status === 'running') && (
              <button
                className="dashboard-secondary-button"
                type="button"
                disabled={cancelling}
                onClick={() => void cancel()}
              >
                {cancelling ? 'Cancelling…' : 'Cancel scan'}
              </button>
            )}
          </div>
          <nav className="scan-tabs" aria-label="Scan results">
            {tabs.map(([value, label]) => (
              <button
                key={value}
                className={tab === value ? 'scan-tab active' : 'scan-tab'}
                type="button"
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </nav>
          {scan.module === 'browser-network' &&
            browserSummary &&
            tab === 'overview' && (
              <div className="scan-detail-card">
                <h2>Browser summary</h2>
                <dl className="scan-detail-grid">
                  <div>
                    <dt>Pages checked</dt>
                    <dd>{browserSummary.uniquePages}</dd>
                  </div>
                  <div>
                    <dt>Console errors</dt>
                    <dd>{browserSummary.consoleErrors}</dd>
                  </div>
                  <div>
                    <dt>JavaScript errors</dt>
                    <dd>{browserSummary.javascriptErrors}</dd>
                  </div>
                  <div>
                    <dt>Failed requests</dt>
                    <dd>{browserSummary.failedRequests}</dd>
                  </div>
                  <div>
                    <dt>HTTP errors</dt>
                    <dd>{browserSummary.httpErrors}</dd>
                  </div>
                  <div>
                    <dt>Blocked by policy</dt>
                    <dd>{browserSummary.networkPolicyBlocked}</dd>
                  </div>
                </dl>
              </div>
            )}
          {scan.module === 'browser-network' && tab === 'pages' && (
            <div className="scan-detail-card">
              <h2>Browser pages</h2>
              <div className="scan-page-table">
                {browserPages.length ? (
                  browserPages.map((page) => (
                    <div className="scan-page-row" key={page.id}>
                      <div>
                        <strong>{page.pageUrl}</strong>
                        <small>
                          {page.browser} · {page.viewport.width} ×{' '}
                          {page.viewport.height}
                        </small>
                      </div>
                      <span>
                        {page.httpStatus ?? '—'} · {page.durationMs ?? '—'}ms
                      </span>
                      <ScanStatusBadge
                        status={
                          page.status === 'COMPLETED'
                            ? 'completed'
                            : page.status === 'FAILED'
                              ? 'failed'
                              : page.status === 'CANCELLED'
                                ? 'cancelled'
                                : 'running'
                        }
                      />
                    </div>
                  ))
                ) : (
                  <p>No browser pages have been recorded yet.</p>
                )}
              </div>
            </div>
          )}
          {scan.module === 'browser-network' &&
            (tab === 'console' || tab === 'network') && (
              <div className="scan-detail-card">
                <h2>
                  {tab === 'console'
                    ? 'Console and JavaScript errors'
                    : 'Network observations'}
                </h2>
                {(tab === 'console'
                  ? [
                      ...browserFactsFor('CONSOLE'),
                      ...browserFactsFor('PAGE_ERROR'),
                    ]
                  : [
                      ...browserFactsFor('RESPONSE'),
                      ...browserFactsFor('FAILED_REQUEST'),
                      ...browserFactsFor('NETWORK_POLICY_BLOCKED'),
                    ]
                ).length ? (
                  <div className="scan-page-table">
                    {(tab === 'console'
                      ? [
                          ...browserFactsFor('CONSOLE'),
                          ...browserFactsFor('PAGE_ERROR'),
                        ]
                      : [
                          ...browserFactsFor('RESPONSE'),
                          ...browserFactsFor('FAILED_REQUEST'),
                          ...browserFactsFor('NETWORK_POLICY_BLOCKED'),
                        ]
                    ).map((fact) => (
                      <div className="scan-page-row" key={fact.id}>
                        <div>
                          <strong>
                            {fact.message ?? fact.url ?? 'Browser observation'}
                          </strong>
                          <small>
                            {fact.kind} · {fact.source ?? fact.url ?? '—'}
                          </small>
                        </div>
                        <span>{fact.status ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>
                    {tab === 'console'
                      ? 'No console errors were captured.'
                      : 'No matching requests.'}
                  </p>
                )}
              </div>
            )}
          {scan.module === 'browser-network' && tab === 'evidence' && (
            <div className="scan-detail-card">
              <h2>Screenshot evidence</h2>
              {evidence.length ? (
                <div className="scan-page-table">
                  {evidence.map((item) => (
                    <div className="scan-page-row" key={item.id}>
                      <div>
                        <strong>{item.pageUrl ?? 'Captured screenshot'}</strong>
                        <small>
                          {item.browser ?? 'Browser'} ·{' '}
                          {item.viewport
                            ? `${item.viewport.width} × ${item.viewport.height}`
                            : 'Viewport unavailable'}{' '}
                          · {item.createdAt}
                        </small>
                      </div>
                      <Link
                        className="dashboard-card-action"
                        href={`/api/v1/projects/${selectedProject?.id ?? ''}/evidence/${item.id}`}
                      >
                        Open evidence →
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No screenshot evidence is available.</p>
              )}
            </div>
          )}
          {scan.module !== 'browser-network' &&
            tab === 'overview' &&
            summary && (
              <div className="scan-detail-card">
                <h2>Crawl summary</h2>
                <dl className="scan-detail-grid">
                  <div>
                    <dt>Discovered</dt>
                    <dd>{summary.pagesDiscovered}</dd>
                  </div>
                  <div>
                    <dt>Fetched</dt>
                    <dd>{summary.pagesFetched}</dd>
                  </div>
                  <div>
                    <dt>Failed</dt>
                    <dd>{summary.pagesFailed}</dd>
                  </div>
                  <div>
                    <dt>Max depth</dt>
                    <dd>{summary.maxDepthReached}</dd>
                  </div>
                </dl>
              </div>
            )}
          {scan.module !== 'browser-network' && tab === 'pages' && (
            <div className="scan-detail-card">
              <h2>Discovered pages</h2>
              <div className="scan-page-table">
                {pages.length ? (
                  pages.map((page) => (
                    <div className="scan-page-row" key={page.id}>
                      <div>
                        <strong>{page.url}</strong>
                        <small>
                          {page.title || 'Untitled'} · depth {page.depth}
                        </small>
                      </div>
                      <span>{page.statusCode ?? '—'}</span>
                      <ScanStatusBadge
                        status={
                          page.crawlStatus.toLowerCase() as Scan['status']
                        }
                      />
                    </div>
                  ))
                ) : (
                  <p>No crawl pages have been recorded yet.</p>
                )}
              </div>
            </div>
          )}
          {(tab === 'robots' || tab === 'sitemap') && (
            <div className="scan-detail-card">
              <h2>
                {tab === 'robots' ? 'Robots.txt result' : 'Sitemap result'}
              </h2>
              {quality ? (
                <pre className="scan-quality-json">
                  {JSON.stringify(quality, null, 2)}
                </pre>
              ) : (
                <p>Results are not available yet.</p>
              )}
            </div>
          )}
          {tab === 'comparison' && (
            <div className="scan-detail-card">
              <h2>Crawl vs sitemap</h2>
              {comparison ? (
                <dl className="scan-detail-grid">
                  <div>
                    <dt>Matched</dt>
                    <dd>{comparison.matched.length}</dd>
                  </div>
                  <div>
                    <dt>Crawl only</dt>
                    <dd>{comparison.crawlOnly.length}</dd>
                  </div>
                  <div>
                    <dt>Sitemap only</dt>
                    <dd>{comparison.sitemapOnly.length}</dd>
                  </div>
                </dl>
              ) : (
                <p>Comparison is not available yet.</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
