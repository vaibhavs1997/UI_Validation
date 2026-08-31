---
name: database-migration
description: Use when changing the retained Prisma/Postgres schema, migrations, or Firebase repository contracts.
---

# Database and persistence changes

## Prerequisites

Read `AGENTS.md`, `docs/ARCHITECTURE.md`, and `docs/SECURITY.md`. Determine whether the change targets active Firebase persistence or the retained Prisma/Postgres path.

## Procedure

1. Inspect the relevant repository interface and all callers.
2. For Firebase, update repository mapping and Firestore paths without moving persistence into API controllers.
3. For Prisma, inspect `packages/database/prisma/schema.prisma` and existing migrations before changing the schema.
4. Preserve ownership checks and atomic behavior for project/environment defaults.
5. Update shared contracts and tests only when the persisted shape or public behavior changes.
6. Run Prisma generation only when Prisma sources require it; do not treat it as a Firebase migration.

## Validation

Use `pnpm db:generate` for Prisma client generation, then run `pnpm typecheck`, affected package tests, and `pnpm build`. Run `pnpm db:migrate` only with an explicitly configured Postgres environment.

## Avoid

Do not switch the active provider, edit generated Prisma client files, create migrations for Firebase documents, or change a persisted shape without checking all adapters.
