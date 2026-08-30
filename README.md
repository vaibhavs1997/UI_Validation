# VisionQA

VisionQA is a production-oriented foundation for modular website QA scanning. Phase 0 establishes the monorepo boundaries, contracts, execution workers, security seams, and local infrastructure; detector algorithms and full scan execution are intentionally deferred.

## Architecture

- `apps/web`: Next.js App Router dashboard shell.
- `apps/api`: NestJS + Fastify business API, currently with `GET /health`.
- `apps/worker-*`: independently scalable browser, crawl, and HTTP execution processes.
- `apps/scheduler`: turns due schedules into queued scan work; it never runs browser scans.
- `packages/contracts`: framework-agnostic API/domain types.
- `packages/detector-sdk` and `packages/detectors`: detector contracts and placeholders.
- `packages/database`: isolated PostgreSQL/Prisma adapter plus Firebase Admin repositories.
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

## Active persistence

Firebase is the active development provider. Set `DATABASE_PROVIDER=firebase` and configure Firebase Web credentials for `apps/web` plus Firebase Admin credentials for `apps/api`/`packages/database`. Firebase Authentication owns identity, the API exchanges verified ID tokens for an HttpOnly `visionqa_session` cookie, and Firestore stores application profiles at `users/{firebaseUid}`. Frontend business data should go through the NestJS API.

PostgreSQL + Prisma is preserved as an alternate adapter. Set `DATABASE_PROVIDER=postgres` only when the Postgres environment is available; Postgres migrations are adapter-specific and are not part of the Firebase startup path.

### Firebase setup

1. Create a Firebase project, enable Email/Password Authentication, and create a Firestore database.
2. Copy `.env.example` to `.env`.
3. Add the `NEXT_PUBLIC_FIREBASE_*` Web SDK values to the web environment.
4. Add `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `FIREBASE_STORAGE_BUCKET` to the server environment. Keep these server-only.
5. Start the web and API services. Set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` and `USE_FIREBASE_EMULATOR=true` when using the local emulators configured in `firebase.json`.

Firebase Web credentials are safe client configuration; Firebase Admin credentials, especially `FIREBASE_PRIVATE_KEY`, must never use a `NEXT_PUBLIC_` prefix or be committed.

## Current status

Implemented: workspace configuration, typed contracts, Prisma schema, queue contracts, network-policy URL checks, API health endpoint, dashboard routing shell, worker entry points, fixtures, CI, and Docker scaffolding.

Scaffolded only: crawling, Playwright execution, overlap detection, accessibility, performance, report exporters, authentication, integrations, scheduling persistence, and cloud evidence uploads. No AI/LLM dependency is part of the scanner core.

## Next recommended phase

Phase 1: secure scanner foundation — outbound network policy, Playwright browser isolation, request interception, and safe crawling primitives.
