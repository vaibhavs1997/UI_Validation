import type { ScanStatus } from '@visionqa/contracts';
export function ScanStatusBadge({ status }: { status: ScanStatus }) { return <span className={`scan-status scan-status-${status}`}>{status[0]!.toUpperCase() + status.slice(1)}</span>; }
