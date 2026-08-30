import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import cookie from '@fastify/cookie';
import { loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.register(cookie as never);
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 4000) });
}
void bootstrap();
