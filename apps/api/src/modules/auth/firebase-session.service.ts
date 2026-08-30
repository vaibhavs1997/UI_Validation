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
    let stage = 'token verification';
    try {
      const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
      stage = 'profile persistence';
      const fallbackUser: AuthUser = { id: decoded.uid, name: String(decoded.name ?? ''), email: String(decoded.email ?? '') };
      let profile = fallbackUser;
      try { profile = await this.users.upsertProfile({ id: decoded.uid, name: decoded.name ?? null, email: String(decoded.email ?? '') }); } catch (profileError) { console.error('[firebase-session] profile persistence skipped:', profileError instanceof Error ? profileError.message : String(profileError)); }
      const expiresIn = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 604800) * 1000;
      stage = 'session cookie creation';
      let sessionValue = idToken;
      let maxAge = 3600;
      try { sessionValue = await getFirebaseAdminAuth().createSessionCookie(idToken, { expiresIn }); maxAge = Math.floor(expiresIn / 1000); } catch (cookieError) {
        const detail = cookieError instanceof Error ? cookieError.message : String(cookieError);
        if (!/EACCES|ECONN|ETIMEDOUT|ENOTFOUND|network/i.test(detail)) throw cookieError;
        console.warn('[firebase-session] session cookie endpoint unavailable; using short-lived verified-token session.');
      }
      reply.setCookie(cookieName(), sessionValue, {
        httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
        maxAge,
      });
      return { user: profile };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`[firebase-session] session establishment failed during ${stage}:`, detail);
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
      let decoded;
      try { decoded = await getFirebaseAdminAuth().verifySessionCookie(cookie, true); } catch { decoded = await getFirebaseAdminAuth().verifyIdToken(cookie); }
      const profile = await this.users.findById(decoded.uid);
      if (profile) return profile;
      return await this.users.upsertProfile({ id: decoded.uid, name: decoded.name ?? null, email: String(decoded.email ?? '') });
    } catch { return null; }
  }

  clear(reply: FastifyReply): void { reply.clearCookie(cookieName(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }); }
}
