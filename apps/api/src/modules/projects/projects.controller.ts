import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import type { CreateEnvironmentRequest, CreateProjectRequest, UpdateEnvironmentRequest, UpdateProjectRequest } from '@visionqa/contracts';
import { FirebaseSessionGuard, type AuthenticatedRequest } from '../auth/firebase-session.guard.js';
import { ProjectsService } from './projects.service.js';

const urlSchema = z.string().trim().url().refine((value) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}, 'URL must use http or https.');
const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  baseUrl: urlSchema,
  environmentName: z.string().trim().min(1).max(80),
  environmentType: z.enum(['production', 'staging', 'qa', 'development', 'custom']),
});
const updateSchema = z.object({ name: z.string().trim().min(1).max(100) }).refine((value) => Object.keys(value).length > 0, 'At least one project field is required.');
const environmentSchema = z.object({ name: z.string().trim().min(1).max(80), type: z.enum(['production', 'staging', 'qa', 'development', 'custom']), baseUrl: urlSchema, isDefault: z.boolean().optional() });
const environmentUpdateSchema = environmentSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one environment field is required.');

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
    const input = { name: parsed.data.name };
    const project = await this.projects.update(request.user!.id, projectId, input);
    if (!project) throw new NotFoundException('Project not found.');
    return { project };
  }

  @Post(':projectId/environments')
  async createEnvironment(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: CreateEnvironmentRequest) { const parsed = environmentSchema.safeParse(body); if (!parsed.success) throw new BadRequestException('Invalid environment details.'); const input = { name: parsed.data.name, type: parsed.data.type, baseUrl: normalizedUrl(parsed.data.baseUrl), ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}) }; const environment = await this.projects.createEnvironment(request.user!.id, projectId, input); if (!environment) throw new NotFoundException('Project not found.'); return { environment }; }

  @Get(':projectId/environments')
  async listEnvironments(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string) { const environments = await this.projects.listEnvironments(request.user!.id, projectId); if (!environments) throw new NotFoundException('Project not found.'); return { environments }; }

  @Get(':projectId/environments/:environmentId')
  async findEnvironment(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Param('environmentId') environmentId: string) { const environment = await this.projects.findEnvironment(request.user!.id, projectId, environmentId); if (!environment) throw new NotFoundException('Environment not found.'); return { environment }; }

  @Patch(':projectId/environments/:environmentId')
  async updateEnvironment(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Param('environmentId') environmentId: string, @Body() body: UpdateEnvironmentRequest) { const parsed = environmentUpdateSchema.safeParse(body); if (!parsed.success) throw new BadRequestException('Invalid environment details.'); const input = { ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}), ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}), ...(parsed.data.baseUrl !== undefined ? { baseUrl: normalizedUrl(parsed.data.baseUrl) } : {}), ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}) }; const environment = await this.projects.updateEnvironment(request.user!.id, projectId, environmentId, input); if (!environment) throw new NotFoundException('Environment not found.'); return { environment }; }

  @Delete(':projectId/environments/:environmentId')
  async deleteEnvironment(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Param('environmentId') environmentId: string) { const result = await this.projects.deleteEnvironment(request.user!.id, projectId, environmentId); if (result === null) throw new NotFoundException('Environment not found.'); if (result === 'only-environment') throw new ConflictException('A project must have at least one environment.'); return { deleted: true }; }
}
