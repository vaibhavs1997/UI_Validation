import { describe, expect, it } from 'vitest';
import { NetworkPolicyError, OutboundNetworkPolicy } from '../src';
describe('outbound network policy', () => {
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
});
