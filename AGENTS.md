# VisionQA agent guidance

Read this file first on every task, then inspect the existing implementation before editing. Load only the deeper references and skills relevant to the requested work.

## Documentation map

- Read [ARCHITECTURE](docs/ARCHITECTURE.md) for structural, backend, persistence, package-boundary, queue, worker, or integration changes.
- Read [SECURITY](docs/SECURITY.md) for authentication, authorization, project isolation, secrets, outbound network access, queues, file handling, logging, or external-service changes.
- Read [TESTING](docs/TESTING.md) when adding, changing, or evaluating tests, or when deciding validation for a change.
- Read [DESIGN](DESIGN.md) for meaningful frontend, UI, styling, responsive, accessibility, or interaction changes.
- If a change spans areas, read each applicable document; otherwise do not load unrelated documentation.
- Update the relevant documentation when an implementation change makes its current statements materially inaccurate.

## Skills map

Follow the applicable skill procedure when the task matches its scope:

- [backend-development](skills/backend-development/SKILL.md): NestJS/Fastify API, auth/session, project/environment/scan, or backend validation work.
- [frontend-development](skills/frontend-development/SKILL.md): Next.js routes, components, auth UI, dashboard, QA screens, or scan UI work.
- [database-migration](skills/database-migration/SKILL.md): Prisma/Postgres schema/migration or Firebase repository/persistence-contract work.
- [testing](skills/testing/SKILL.md): test creation, test changes, regression coverage, or validation planning.
- [security-review](skills/security-review/SKILL.md): auth, authorization, secrets, network policy, queues, evidence/files, logging, or integrations.

Use multiple skills when a task crosses scopes. Do not load unrelated skills.

## Repository rules

- This is a pnpm workspace/Turborepo. Applications live in `apps/*`; shared packages live in `packages/*`.
- Keep changes in the existing package boundary. Shared domain/API types belong in `packages/contracts`; persistence belongs in `packages/database`; queue payloads belong in `packages/queue`.
- `apps/web` is a Next.js App Router application. Keep browser-only Firebase/Auth/UI code behind client boundaries and keep server credentials out of frontend code.
- `apps/api` is a NestJS + Fastify API. Controllers validate HTTP input and authorization; services coordinate use cases; repositories contain Firebase/Prisma persistence.
- Firebase is the active application provider. Prisma/Postgres is a retained compatibility path; do not switch providers or change schemas without an explicit request.
- Preserve the Firebase session flow: the web client signs in with Firebase, the API verifies the ID token, and the API sets the HttpOnly `visionqa_session` cookie.
- Every project/environment/scan operation must verify the authenticated user and the resource relationship. Never trust an ID supplied by the browser.
- Keep Firebase Admin credentials, private keys, tokens, cookies, and secrets server-side. `.env` is ignored; update `.env.example` when configuration contracts change.
- Validate outbound URLs through `packages/network-policy` before adding scanner/network behavior. Do not add arbitrary URL fetching, redirects, or code execution without a security review.
- Do not claim scaffolded workers, detectors, queues, reports, or integrations are functional. Check current implementation before documenting or exposing behavior.
- Reuse existing contracts and services before adding a duplicate abstraction. Keep API error messages safe and user-facing errors separate from diagnostic logs.
- Do not modify generated `.next`, `.next-dev`, `dist`, coverage, or `node_modules` artifacts as source changes.

## Validation

Before completing a change, run the narrowest relevant checks and normally finish with:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For browser behavior, use `pnpm test:e2e` when the required local services and credentials are available. Report skipped or unavailable infrastructure explicitly.
