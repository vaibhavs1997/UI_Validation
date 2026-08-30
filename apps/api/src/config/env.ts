import { z } from 'zod';
export const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  DATABASE_PROVIDER: z.enum(['firebase', 'postgres']).default('firebase'),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  AUTH_COOKIE_NAME: z.string().default('visionqa_session'),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
}).superRefine((env, context) => {
  if (env.DATABASE_PROVIDER === 'firebase') {
    for (const name of ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'] as const) {
      if (!env[name]) context.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: `Required when DATABASE_PROVIDER=firebase.` });
    }
  } else if (!env.DATABASE_URL) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'Required when DATABASE_PROVIDER=postgres.' });
  }
});
export function loadEnv(env: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(env);
}
