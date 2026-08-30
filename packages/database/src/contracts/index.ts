export type UserProfile = { id: string; name: string; email: string };
export type UpsertUserProfile = { id: string; name?: string | null; email: string };
export interface UserRepository {
  findById(id: string): Promise<UserProfile | null>;
  upsertProfile(input: UpsertUserProfile): Promise<UserProfile>;
}
export type Environment = { id: string; name: string; type: string; baseUrl: string; isDefault: boolean };
export type Project = { id: string; name: string; baseUrl: string; createdBy: string; organizationId: string | null; environments: Environment[] };
export type CreateProjectInput = { name: string; baseUrl: string; environmentName: string; environmentType: string };
export interface ProjectRepository {
  createProject(ownerId: string, input: CreateProjectInput): Promise<Project>;
  findProjectsForUser(ownerId: string): Promise<Project[]>;
  findProjectByIdForUser(ownerId: string, projectId: string): Promise<Project | null>;
  updateProject(ownerId: string, projectId: string, input: Partial<Pick<Project, 'name' | 'baseUrl'>>): Promise<Project | null>;
}
