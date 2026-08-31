import type { ScanTarget } from './index.js';

export function createScanTarget(requestedUrl: string): ScanTarget {
  const parsed = new URL(requestedUrl.trim());
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) throw new Error('URL must use http or https and include a hostname.');
  parsed.hash = '';
  const normalizedUrl = parsed.toString();
  return { requestedUrl: requestedUrl.trim(), normalizedUrl, origin: parsed.origin, protocol: parsed.protocol.slice(0, -1) as 'http' | 'https', hostname: parsed.hostname, ...(parsed.port ? { port: Number(parsed.port) } : {}), finalUrl: null, safeDisplayUrl: `${parsed.origin}${parsed.pathname}` };
}
