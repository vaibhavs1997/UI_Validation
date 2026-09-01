'use client';

import { useRouter } from 'next/navigation';
import type { Scan } from '@visionqa/contracts';
import { generateReport } from './report.service';

export function GenerateReportButton({
  projectId,
  scan,
}: {
  projectId: string;
  scan: Scan;
}) {
  const router = useRouter();
  const terminal = ['completed', 'partial', 'failed', 'cancelled'].includes(
    scan.status,
  );
  const generate = async () => {
    if (!terminal) return;
    try {
      const result = await generateReport(
        projectId,
        scan.id,
        { includeIssues: true },
        crypto.randomUUID(),
      );
      router.push(`/reports/${result.reportId}`);
    } catch {
      router.push('/reports');
    }
  };
  return (
    <button
      className="dashboard-secondary-button no-print"
      type="button"
      disabled={!terminal}
      title={
        terminal
          ? 'Create an immutable report snapshot'
          : 'Reports are available after the scan reaches a terminal state'
      }
      onClick={() => void generate()}
    >
      {terminal ? 'Generate report' : 'Report unavailable while running'}
    </button>
  );
}
