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
});
