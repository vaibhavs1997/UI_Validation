import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const reply = {} as never;
  it('normalizes email and returns no password hash on registration', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'u1', name: 'QA User', email: 'qa@example.com', passwordHash: 'hash' }) } };
    const passwords = { hash: vi.fn().mockResolvedValue('hash') };
    const sessions = { create: vi.fn().mockResolvedValue(undefined) };
    const result = await new AuthService(prisma as never, passwords as never, sessions as never).register({ name: 'QA User', email: ' QA@Example.com ', password: 'Secure123' }, reply);
    expect(result).toEqual({ user: { id: 'u1', name: 'QA User', email: 'qa@example.com' } });
    expect(passwords.hash).toHaveBeenCalledWith('Secure123');
    expect(sessions.create).toHaveBeenCalledWith('u1', reply);
  });

  it('uses the same public error for unknown and invalid credentials', async () => {
    const passwords = { verify: vi.fn().mockResolvedValue(false) };
    const sessions = { create: vi.fn() };
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    const service = new AuthService(prisma as never, passwords as never, sessions as never);
    await expect(service.login({ email: 'missing@example.com', password: 'wrong' }, reply)).rejects.toThrow('Invalid email or password.');
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'QA', email: 'qa@example.com', passwordHash: 'hash' });
    await expect(service.login({ email: 'qa@example.com', password: 'wrong' }, reply)).rejects.toThrow('Invalid email or password.');
  });
});
