import { BadRequestException, Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { CreateSessionRequest } from '@visionqa/contracts';
import { FirebaseSessionGuard, type AuthenticatedRequest } from './firebase-session.guard.js';
import { FirebaseSessionService } from './firebase-session.service.js';

const sessionSchema = z.object({ idToken: z.string().min(1) });

@Controller('api/v1/auth')
export class FirebaseAuthController {
  constructor(private readonly sessions: FirebaseSessionService) {}
  @Post('session')
  async session(@Body() body: CreateSessionRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const parsed = sessionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid session request.');
    return this.sessions.establish(parsed.data.idToken, reply);
  }
  @Post('logout') @HttpCode(204)
  logout(@Res({ passthrough: true }) reply: FastifyReply): void { this.sessions.clear(reply); }
  @Get('me') @UseGuards(FirebaseSessionGuard)
  me(@Req() request: AuthenticatedRequest) { if (!request.user) throw new UnauthorizedException(); return { user: request.user }; }
}

