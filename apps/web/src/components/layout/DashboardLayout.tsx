import Link from 'next/link';

const sections = [
  [
    'OVERVIEW',
    [
      ['Dashboard', '/dashboard/dashboard'],
      ['Issues', '/dashboard/issues'],
      ['Scan History', '/dashboard/scans'],
    ],
  ],
  [
    'QA CHECKS',
    [
      ['Crawl & Site Structure', '/dashboard/qa/crawl'],
      ['Links & Resources', '/dashboard/qa/links-resources'],
      ['Visual & Responsive', '/dashboard/qa/visual-responsive'],
      ['Interactions & Forms', '/dashboard/qa/interactions-forms'],
      ['Browser & Network', '/dashboard/qa/browser-network'],
      ['Accessibility & SEO', '/dashboard/qa/accessibility-seo'],
      [
        'Performance & Compatibility',
        '/dashboard/qa/performance-compatibility',
      ],
      ['Custom Checks', '/dashboard/qa/custom-checks'],
    ],
  ],
  [
    'AUTOMATION',
    [
      ['Full Scan', '/dashboard/full-scan'],
      ['Schedules', '/dashboard/schedules'],
    ],
  ],
  ['REPORTING', [['Reports', '/dashboard/reports']]],
  [
    'CONFIGURATION',
    [
      ['Website Configuration', '/dashboard/settings/project'],
      ['Integrations', '/dashboard/integrations'],
      ['Settings', '/dashboard/settings/project'],
    ],
  ],
] as const;

export function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 260,
          background: '#10182b',
          color: '#d7def0',
          padding: 24,
        }}
      >
        <strong style={{ color: 'white', fontSize: 20 }}>VisionQA</strong>
        <div
          style={{
            margin: '28px 0',
            padding: 12,
            background: '#1c2740',
            borderRadius: 8,
          }}
        >
          Demo project ▾
        </div>
        {sections.map(([title, links]) => (
          <div key={title} style={{ marginBottom: 22 }}>
            <small style={{ color: '#7f8baa', letterSpacing: 1 }}>
              {title}
            </small>
            {links.map(([label, href]) => (
              <Link
                key={href + label}
                href={href}
                style={{ display: 'block', padding: '8px 0', fontSize: 14 }}
              >
                {label}
              </Link>
            ))}
          </div>
        ))}
      </aside>
      <div style={{ flex: 1 }}>
        <header
          style={{
            height: 72,
            background: 'white',
            borderBottom: '1px solid #e6e9f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
          }}
        >
          <span>Project workspace</span>
          <span style={{ color: '#64708a' }}>Account placeholder</span>
        </header>
        <main style={{ padding: 32, maxWidth: 1200 }}>{children}</main>
      </div>
    </div>
  );
}
