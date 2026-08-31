import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class NetworkPolicyError extends Error {
  constructor(message: string) { super(message); this.name = 'NetworkPolicyError'; }
}
export * from './http.js';
export type DnsResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
const blockedHosts = new Set(['localhost', 'metadata.google.internal', 'metadata.google.internal.']);
function ipv4Parts(host: string): number[] | null { if (isIP(host) !== 4) return null; const parts = host.split('.').map(Number); return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null; }
function isBlockedIp(host: string): boolean { const normalized = host.toLowerCase().replace(/^\[|\]$/g, ''); const parts = ipv4Parts(normalized); if (parts) { const [a, b] = parts; return a === 0 || a === 10 || (a === 100 && b! >= 64 && b! <= 127) || a === 127 || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 0) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a! >= 224; } if (isIP(normalized) !== 6) return false; const value = normalized.split(':').map((part) => part.padStart(4, '0')).join('').toLowerCase(); return normalized === '::1' || normalized === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb') || value.startsWith('ff'); }
export interface OutboundNetworkPolicyOptions { allowedDomains?: string[]; allowPrivateNetworks?: boolean; resolver?: DnsResolver; }
export class OutboundNetworkPolicy {
  private readonly resolver: DnsResolver;
  constructor(private readonly options: OutboundNetworkPolicyOptions = {}) { this.resolver = options.resolver ?? (async (hostname) => (await dnsLookup(hostname, { all: true })) as Array<{ address: string; family: number }>); }
  validateUrl(rawUrl: string): URL { let url: URL; try { url = new URL(rawUrl); } catch { throw new NetworkPolicyError('Invalid outbound URL'); } if (!['http:', 'https:'].includes(url.protocol)) throw new NetworkPolicyError('Only HTTP and HTTPS are allowed'); const host = url.hostname.toLowerCase().replace(/\.$/, ''); if (!this.options.allowPrivateNetworks && (blockedHosts.has(host) || isBlockedIp(host))) throw new NetworkPolicyError('Private, loopback, or metadata hosts are blocked'); if (this.options.allowedDomains?.length && !this.options.allowedDomains.some((domain) => host === domain.toLowerCase() || host.endsWith(`.${domain.toLowerCase()}`))) throw new NetworkPolicyError('Host is not allowlisted'); return url; }
  async validateAndResolve(rawUrl: string): Promise<{ url: URL; addresses: string[] }> { const url = this.validateUrl(rawUrl); const addresses = isIP(url.hostname) ? [url.hostname] : (await this.resolver(url.hostname)).map((item) => item.address); if (!addresses.length) throw new NetworkPolicyError('Host did not resolve'); if (!this.options.allowPrivateNetworks && addresses.some(isBlockedIp)) throw new NetworkPolicyError('Host resolves to a private, loopback, or metadata address'); return { url, addresses }; }
}
