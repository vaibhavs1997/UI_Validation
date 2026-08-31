---
name: backend-development
description: Use when changing the NestJS/Fastify API, Firebase session flow, projects, environments, scans, or backend validation.
---

# Backend development

## Prerequisites

Read `AGENTS.md`, `docs/ARCHITECTURE.md`, and `docs/SECURITY.md`. Inspect the relevant Nest module, service, repository, contracts, and existing tests.

## Procedure

1. Identify the existing controller/service/repository boundary before adding code.
2. Add or reuse framework-independent types in `packages/contracts`.
3. Validate request bodies with Zod in the controller and translate failures into safe HTTP errors.
4. Keep use-case coordination in a service and persistence in `packages/database` repositories.
5. Apply Firebase session guarding and verify project/resource ownership for every project-scoped operation.
6. Keep secrets and Firebase Admin imports server-only.
7. Add focused tests for success, invalid input, unauthenticated access, and cross-resource access.

## Validation

Run `pnpm typecheck`, the affected package test, `pnpm lint`, and `pnpm build`.

## Avoid

Do not put Firestore calls in controllers, trust browser-supplied ownership, expose raw Firebase errors, or create a second auth/persistence abstraction without documenting the transitional path.
