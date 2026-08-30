import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaService } from '../../infrastructure/PrismaService.js';

export const AUTH_COOKIE = 'visionqa_session';

function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}
  private ttl(): number { return Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 604800); }
  private cookieName(): string { return process.env.AUTH_COOKIE_NAME ?? AUTH_COOKIE; }
  async create(userId: string, reply: FastifyReply): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttl() * 1000);
    await this.prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
    reply.setCookie(this.cookieName(), token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt });
  }
  async resolve(request: FastifyRequest) {
    const token = request.cookies?.[this.cookieName()];
    if (!token) return null;
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date()) return null;
    return session.user;
  }
  async revoke(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = request.cookies?.[this.cookieName()];
    if (token) await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    reply.clearCookie(this.cookieName(), { path: '/' });
  }
}
