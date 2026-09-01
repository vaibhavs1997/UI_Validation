import { BadRequestException, Injectable } from '@nestjs/common';
import type { CreateCustomCheckRequest, CustomCheckDefinition, UpdateCustomCheckRequest } from '@visionqa/contracts';
import { CUSTOM_CHECK_LIMITS, customCheckRuleSummary, evaluateCustomCheck, validateCustomCheckDefinition } from '@visionqa/detectors';
import { FirebaseCustomCheckRepository } from '@visionqa/database/firebase';
import { ProjectsService } from '../projects/projects.service.js';

@Injectable()
export class CustomChecksService {
  private readonly checks = new FirebaseCustomCheckRepository();
  constructor(private readonly projects: ProjectsService) {}
  private async ensureProject(ownerId: string, projectId: string) { if (!(await this.projects.find(ownerId, projectId))) throw new BadRequestException('Project not found.'); }
  private validate(input: { name?: string; description?: string; definition?: CustomCheckDefinition }) { if (input.name !== undefined && (!input.name.trim() || input.name.length > CUSTOM_CHECK_LIMITS.maxNameLength)) throw new BadRequestException('Enter a name up to 120 characters.'); if (input.description && input.description.length > CUSTOM_CHECK_LIMITS.maxDescriptionLength) throw new BadRequestException('Description is too long.'); if (input.definition) { const result = validateCustomCheckDefinition(input.definition); if (!result.valid) throw new BadRequestException(result.errors.join(' ')); } }
  async create(ownerId: string, projectId: string, input: CreateCustomCheckRequest) { await this.ensureProject(ownerId, projectId); this.validate(input); const existing = await this.checks.list(ownerId, projectId); if ((existing?.length ?? 0) >= CUSTOM_CHECK_LIMITS.maxChecksPerProject) throw new BadRequestException('This project has reached the custom check limit.'); const check = await this.checks.create(ownerId, projectId, { ...input, name: input.name.trim(), ...(input.description?.trim() ? { description: input.description.trim() } : {}) }); if (!check) throw new BadRequestException('Project not found.'); return check; }
  async list(ownerId: string, projectId: string) { await this.ensureProject(ownerId, projectId); return (await this.checks.list(ownerId, projectId)) ?? []; }
  async find(ownerId: string, projectId: string, checkId: string) { await this.ensureProject(ownerId, projectId); return this.checks.find(ownerId, projectId, checkId); }
  async update(ownerId: string, projectId: string, checkId: string, input: UpdateCustomCheckRequest) { await this.ensureProject(ownerId, projectId); this.validate(input); return this.checks.update(ownerId, projectId, checkId, input); }
  async delete(ownerId: string, projectId: string, checkId: string) { await this.ensureProject(ownerId, projectId); return this.checks.delete(ownerId, projectId, checkId); }
  async preview(ownerId: string, projectId: string, definition: CustomCheckDefinition, context?: Parameters<typeof evaluateCustomCheck>[1]) { await this.ensureProject(ownerId, projectId); this.validate({ definition }); return { summary: customCheckRuleSummary(definition), result: context ? evaluateCustomCheck(definition, context) : undefined }; }
}
