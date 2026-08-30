import { BadRequestException, Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { LoginRequest, RegisterRequest } from '@visionqa/contracts';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

const registerSchema = z.object({ name: z.string().trim().min(2), email: z.string().email(), password: z.string().min(8).regex(/[A-Za-z]/).regex(/\d/) });
const loginSchema = z.object({ email: z.string().trim().min(1), password: z.string().min(1) });

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly sessions: SessionService) {}
  @Post('register') async register(@Body() body: RegisterRequest, @Res({ passthrough: true }) reply: FastifyReply) { const parsed = registerSchema.safeParse(body); if (!parsed.success) throw new BadRequestException('Invalid registration details.'); return this.auth.register(parsed.data, reply); }
  @Post('login') async login(@Body() body: LoginRequest, @Res({ passthrough: true }) reply: FastifyReply) { const parsed = loginSchema.safeParse(body); if (!parsed.success) throw new UnauthorizedException('Invalid email or password.'); return this.auth.login(parsed.data, reply); }
  @Post('logout') @HttpCode(204) async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> { await this.sessions.revoke(request, reply); }
  @Get('me') @UseGuards(AuthGuard) async me(@Req() request: FastifyRequest & { user?: { id: string; name: string | null; email: string } }) { return this.auth.me(request.user!); }
}
