import { z } from 'zod';
export const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});
export function loadEnv(env: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(env);
}
