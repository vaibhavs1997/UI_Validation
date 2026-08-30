import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/PrismaService.js';
import type { FastifyReply } from 'fastify';
import type { LoginRequest, RegisterRequest } from '@visionqa/contracts';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

const publicUser = (user: { id: string; name: string | null; email: string }) => ({ id: user.id, name: user.name ?? '', email: user.email });

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService, private readonly sessions: SessionService) {}
  async register(input: RegisterRequest, reply: FastifyReply) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An account with this email already exists.');
    const user = await this.prisma.user.create({ data: { name: input.name.trim(), email, passwordHash: await this.passwords.hash(input.password) } });
    await this.sessions.create(user.id, reply);
    return { user: publicUser(user) };
  }
  async login(input: LoginRequest, reply: FastifyReply) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await this.passwords.verify(input.password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password.');
    await this.sessions.create(user.id, reply);
    return { user: publicUser(user) };
  }
  async me(user: { id: string; name: string | null; email: string }) { return { user: publicUser(user) }; }
}
