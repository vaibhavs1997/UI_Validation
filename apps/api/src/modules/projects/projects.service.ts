import { Injectable } from '@nestjs/common';
import { FirebaseEnvironmentRepository, FirebaseProjectRepository } from '@visionqa/database/firebase';
import type { CreateEnvironmentInput, CreateProjectInput, Environment, Project, UpdateEnvironmentInput } from '@visionqa/database/contracts';

@Injectable()
export class ProjectsService {
  private readonly projects = new FirebaseProjectRepository();
  private readonly environments = new FirebaseEnvironmentRepository();

  create(ownerId: string, input: CreateProjectInput): Promise<Project> {
    return this.projects.createProject(ownerId, input);
  }

  list(ownerId: string): Promise<Project[]> {
    return this.projects.findProjectsForUser(ownerId);
  }

  find(ownerId: string, projectId: string): Promise<Project | null> {
    return this.projects.findProjectByIdForUser(ownerId, projectId);
  }

  update(ownerId: string, projectId: string, input: Partial<Pick<Project, 'name' | 'baseUrl'>>): Promise<Project | null> {
    return this.projects.updateProject(ownerId, projectId, input);
  }

  createEnvironment(ownerId: string, projectId: string, input: CreateEnvironmentInput): Promise<Environment | null> { return this.environments.create(ownerId, projectId, input); }
  listEnvironments(ownerId: string, projectId: string): Promise<Environment[] | null> { return this.environments.findByProject(ownerId, projectId); }
  findEnvironment(ownerId: string, projectId: string, environmentId: string): Promise<Environment | null> { return this.environments.findById(ownerId, projectId, environmentId); }
  updateEnvironment(ownerId: string, projectId: string, environmentId: string, input: UpdateEnvironmentInput): Promise<Environment | null> { return this.environments.update(ownerId, projectId, environmentId, input); }
  deleteEnvironment(ownerId: string, projectId: string, environmentId: string): Promise<'deleted' | 'only-environment' | null> { return this.environments.delete(ownerId, projectId, environmentId); }
}
