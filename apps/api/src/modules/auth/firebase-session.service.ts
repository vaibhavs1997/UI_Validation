import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getFirebaseAdminAuth, FirebaseUserRepository } from '@visionqa/database/firebase';
import type { AuthUser } from '@visionqa/contracts';

export const FIREBASE_AUTH_COOKIE = 'visionqa_session';

function cookieName(): string { return process.env.AUTH_COOKIE_NAME ?? FIREBASE_AUTH_COOKIE; }
@Injectable()
export class FirebaseSessionService {
  private readonly users = new FirebaseUserRepository();

  async establish(idToken: string, reply: FastifyReply): Promise<{ user: AuthUser }> {
    if (!idToken) throw new UnauthorizedException('Unable to establish a session.');
    try {
      const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
      const user = await getFirebaseAdminAuth().getUser(decoded.uid);
      const profile = await this.users.upsertProfile({ id: user.uid, name: user.displayName ?? null, email: user.email ?? '' });
      const expiresIn = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 604800) * 1000;
      const sessionCookie = await getFirebaseAdminAuth().createSessionCookie(idToken, { expiresIn });
      reply.setCookie(cookieName(), sessionCookie, {
        httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
        maxAge: Math.floor(expiresIn / 1000),
      });
      return { user: profile };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[firebase-session] session establishment failed:', detail);
      if (/EACCES|ECONN|ETIMEDOUT|ENOTFOUND|network|Missing required Firebase/i.test(detail)) {
        throw new ServiceUnavailableException('Firebase is temporarily unreachable. Check the API server connection and try again.');
      }
      if (/id-token-expired|id-token-revoked|argument-error|invalid/i.test(detail)) {
        throw new UnauthorizedException('Your sign-in session could not be verified. Please sign in again.');
      }
      throw new UnauthorizedException('We could not complete sign-in. Please try again.');
    }
  }

  async resolve(request: FastifyRequest): Promise<AuthUser | null> {
    const cookie = request.cookies?.[cookieName()];
    if (!cookie) return null;
    try {
      const decoded = await getFirebaseAdminAuth().verifySessionCookie(cookie, true);
      const profile = await this.users.findById(decoded.uid);
      if (profile) return profile;
      const user = await getFirebaseAdminAuth().getUser(decoded.uid);
      return await this.users.upsertProfile({ id: user.uid, name: user.displayName ?? null, email: user.email ?? '' });
    } catch { return null; }
  }

  clear(reply: FastifyReply): void { reply.clearCookie(cookieName(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }); }
}
