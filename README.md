# VisionQA

VisionQA is a production-oriented foundation for modular website QA scanning. Phase 0 establishes the monorepo boundaries, contracts, execution workers, security seams, and local infrastructure; detector algorithms and full scan execution are intentionally deferred.

## Architecture

- `apps/web`: Next.js App Router dashboard shell.
- `apps/api`: NestJS + Fastify business API, currently with `GET /health`.
- `apps/worker-*`: independently scalable browser, crawl, and HTTP execution processes.
- `apps/scheduler`: turns due schedules into queued scan work; it never runs browser scans.
- `packages/contracts`: framework-agnostic API/domain types.
- `packages/detector-sdk` and `packages/detectors`: detector contracts and placeholders.
- `packages/database`: PostgreSQL/Prisma persistence model.
- `packages/queue`: BullMQ queue names and type-safe job payloads.
- `packages/network-policy`: centralized outbound URL validation boundary.

## Prerequisites

Node.js 20+, pnpm 9+, and Docker Desktop. Copy `.env.example` to `.env` before running services.

```bash
pnpm install
pnpm dev
```

Start local dependencies with `docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis minio`.

Useful commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:generate`, and `pnpm test:e2e`.

## Current status

Implemented: workspace configuration, typed contracts, Prisma schema, queue contracts, network-policy URL checks, API health endpoint, dashboard routing shell, worker entry points, fixtures, CI, and Docker scaffolding.

Scaffolded only: crawling, Playwright execution, overlap detection, accessibility, performance, report exporters, authentication, integrations, scheduling persistence, and cloud evidence uploads. No AI/LLM dependency is part of the scanner core.

## Next recommended phase

Phase 1: secure scanner foundation — outbound network policy, Playwright browser isolation, request interception, and safe crawling primitives.
