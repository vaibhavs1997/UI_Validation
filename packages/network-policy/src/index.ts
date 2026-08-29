export class NetworkPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkPolicyError';
  }
}
const blockedHosts = new Set([
  'localhost',
  'metadata.google.internal',
  '169.254.169.254',
]);
function isPrivateIpv4(host: string): boolean {
  const p = host.split('.').map(Number);
  const [a, b] = p;
  return (
    p.length === 4 &&
    a !== undefined &&
    b !== undefined &&
    (a === 10 ||
      a === 127 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 169 && b === 254))
  );
}
export interface OutboundNetworkPolicyOptions {
  allowedDomains?: string[];
  allowPrivateNetworks?: boolean;
}
export class OutboundNetworkPolicy {
  constructor(private readonly options: OutboundNetworkPolicyOptions = {}) {}
  validateUrl(rawUrl: string): URL {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new NetworkPolicyError('Invalid outbound URL');
    }
    if (!['http:', 'https:'].includes(url.protocol))
      throw new NetworkPolicyError('Only HTTP and HTTPS are allowed');
    const host = url.hostname.toLowerCase();
    if (
      !this.options.allowPrivateNetworks &&
      (blockedHosts.has(host) || host === '::1' || isPrivateIpv4(host))
    )
      throw new NetworkPolicyError(
        'Private, loopback, or metadata hosts are blocked',
      );
    if (
      this.options.allowedDomains?.length &&
      !this.options.allowedDomains.some(
        (domain) => host === domain || host.endsWith(`.${domain}`),
      )
    )
      throw new NetworkPolicyError('Host is not allowlisted');
    return url;
  }
}
