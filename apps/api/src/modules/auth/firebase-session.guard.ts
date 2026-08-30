import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { FirebaseSessionService } from './firebase-session.service.js';
import type { AuthUser } from '@visionqa/contracts';

export type AuthenticatedRequest = FastifyRequest & { user?: AuthUser };

@Injectable()
export class FirebaseSessionGuard implements CanActivate {
  constructor(private readonly sessions: FirebaseSessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.sessions.resolve(request);
    if (!user) throw new UnauthorizedException();
    request.user = user;
    return true;
  }
}

