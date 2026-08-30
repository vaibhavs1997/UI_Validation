import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import type { CreateProjectRequest, UpdateProjectRequest } from '@visionqa/contracts';
import { FirebaseSessionGuard, type AuthenticatedRequest } from '../auth/firebase-session.guard.js';
import { ProjectsService } from './projects.service.js';

const urlSchema = z.string().trim().url().refine((value) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}, 'URL must use http or https.');
const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  baseUrl: urlSchema,
  environmentName: z.string().trim().min(1).max(80),
  environmentType: z.enum(['production', 'staging', 'qa', 'development']),
});
const updateSchema = z.object({ name: z.string().trim().min(1).max(100).optional(), baseUrl: urlSchema.optional() }).refine((value) => Object.keys(value).length > 0, 'At least one project field is required.');

function normalizedUrl(value: string): string {
  const url = new URL(value);
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, '')}${url.search}${url.hash}`;
}

@Controller('api/v1/projects')
@UseGuards(FirebaseSessionGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateProjectRequest) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid project details.');
    const input = { ...parsed.data, baseUrl: normalizedUrl(parsed.data.baseUrl) };
    return { project: await this.projects.create(request.user!.id, input) };
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest) { return { projects: await this.projects.list(request.user!.id) }; }

  @Get(':projectId')
  async find(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string) {
    const project = await this.projects.find(request.user!.id, projectId);
    if (!project) throw new NotFoundException('Project not found.');
    return { project };
  }

  @Patch(':projectId')
  async update(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: UpdateProjectRequest) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid project details.');
    const input = {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.baseUrl !== undefined ? { baseUrl: normalizedUrl(parsed.data.baseUrl) } : {}),
    };
    const project = await this.projects.update(request.user!.id, projectId, input);
    if (!project) throw new NotFoundException('Project not found.');
    return { project };
  }
}
