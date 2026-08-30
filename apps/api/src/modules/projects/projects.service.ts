import { Injectable } from '@nestjs/common';
import { FirebaseProjectRepository } from '@visionqa/database/firebase';
import type { CreateProjectInput, Project } from '@visionqa/database/contracts';

@Injectable()
export class ProjectsService {
  private readonly projects = new FirebaseProjectRepository();

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
}
