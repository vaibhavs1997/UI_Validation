import { z } from 'zod';
export const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  ENVIRONMENT_NAME: z.string().default('local'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});
export type EnvironmentConfig = z.infer<typeof environmentSchema>;
export function parseEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): EnvironmentConfig {
  return environmentSchema.parse(env);
}
