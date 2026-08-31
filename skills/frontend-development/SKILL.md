---
name: frontend-development
description: Use when changing the Next.js App Router UI, auth forms, dashboard shell, project context, QA pages, or scan screens.
---

# Frontend development

## Prerequisites

Read `AGENTS.md`, `docs/ARCHITECTURE.md`, and `DESIGN.md`. Inspect the route, its layout, the relevant feature service/context, and `apps/web/src/app/globals.css`.

## Procedure

1. Confirm whether the route/component is a Server Component or requires `'use client'`.
2. Reuse the existing feature service and project context instead of adding direct business-data access.
3. Use accessible labels, semantic buttons/links, keyboard-safe custom controls, and explicit loading/error/empty states.
4. Follow the existing purple liquid-glass visual language and responsive breakpoints.
5. Keep Firebase Web SDK usage limited to client identity operations; business data goes through the API.
6. Add or update focused tests for validation and user-visible behavior.

## Validation

Run `pnpm --filter @visionqa/web typecheck`, `pnpm --filter @visionqa/web lint`, `pnpm --filter @visionqa/web test`, and `pnpm --filter @visionqa/web build`. Use `pnpm test:e2e` for critical browser flows when prerequisites exist.

## Avoid

Do not use server-only credentials in client code, bypass the project context, introduce a competing theme system, or hide API failures behind blank UI.
