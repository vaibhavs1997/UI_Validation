import { createScanTarget } from './scan-target.js';
import type { Scan, ScanTarget } from './index.js';

export class LegacyScanTargetError extends Error {
  readonly code = 'LEGACY_SCAN_TARGET_UNAVAILABLE';

  constructor() {
    super('This historical scan no longer has an available target URL.');
    this.name = 'LegacyScanTargetError';
  }
}

export function resolveScanTarget(scan: Pick<Scan, 'target' | 'environmentId'>, legacyUrl?: string): ScanTarget {
  if (scan.target) return scan.target;
  if (!legacyUrl) throw new LegacyScanTargetError();
  try { return createScanTarget(legacyUrl); } catch { throw new LegacyScanTargetError(); }
}
