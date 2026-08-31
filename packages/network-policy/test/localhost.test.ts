import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkPolicyError, OutboundNetworkPolicy } from '../src';
describe('outbound network policy', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('blocks localhost', () => {
    expect(() =>
      new OutboundNetworkPolicy().validateUrl('http://localhost:3000'),
    ).toThrow(NetworkPolicyError);
  });
  it('allows public https URLs', () => {
    expect(
      new OutboundNetworkPolicy().validateUrl('https://example.com').hostname,
    ).toBe('example.com');
  });
  it('blocks private and metadata addresses', () => {
    for (const url of ['http://127.0.0.1', 'http://10.0.0.1', 'http://172.16.0.1', 'http://192.168.1.1', 'http://169.254.169.254', 'http://[::1]']) expect(() => new OutboundNetworkPolicy().validateUrl(url)).toThrow(NetworkPolicyError);
  });
  it('blocks hostnames resolving to private addresses', async () => {
    const policy = new OutboundNetworkPolicy({ resolver: async () => [{ address: '10.0.0.5', family: 4 }, { address: '93.184.216.34', family: 4 }] });
    await expect(policy.validateAndResolve('https://example.com')).rejects.toThrow(NetworkPolicyError);
  });
  it('allows only the explicitly configured runtime fixture address', async () => {
    const policy = new OutboundNetworkPolicy({ allowedPrivateHosts: ['fixture.local'], allowedPrivateAddresses: ['127.0.0.1'], resolver: async () => [{ address: '127.0.0.1', family: 4 }] });
    await expect(policy.validateAndResolve('http://fixture.local:4100')).resolves.toMatchObject({ addresses: ['127.0.0.1'] });
    await expect(policy.validateAndResolve('http://fixture.local:4100')).resolves.toBeDefined();
  });
  it('does not enable the runtime fixture allowance in production', () => {
    vi.stubEnv('RUNTIME_E2E', 'true'); vi.stubEnv('RUNTIME_FIXTURE_HOST', '127.0.0.1'); vi.stubEnv('RUNTIME_FIXTURE_IP', '127.0.0.1'); vi.stubEnv('NODE_ENV', 'production');
    expect(() => new OutboundNetworkPolicy().validateUrl('http://127.0.0.1:4100')).toThrow(NetworkPolicyError);
  });
});
