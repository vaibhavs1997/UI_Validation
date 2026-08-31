# Architecture

Accessibility & SEO scans reuse the browser worker and persisted issue/evidence model. The worker collects a bounded page metadata and accessibility snapshot, applies only the selected deterministic checks, and stores normalized findings; no separate worker or remote analysis service is introduced.
## Current overview

VisionQA is a pnpm/Turborepo monorepo for a modular website QA product. The current system has a Next.js dashboard, a NestJS/Fastify API, Firebase-backed application repositories, shared contracts, queue contracts, and scaffolded workers.

```mermaid
flowchart LR
  Web[apps/web\nNext.js App Router] -->|HTTP + HttpOnly cookie| API[apps/api\nNestJS + Fastify]
  API --> Auth[Firebase Auth Admin]
  API --> Firestore[Firestore repositories]
  API --> Queue[packages/queue\nBullMQ contracts]
  Queue --> Workers[worker-crawl / worker-http / worker-browser]
  Web --> Firebase[Firebase Web SDK\nidentity only]
```

## Workspace structure

- `apps/web`: App Router pages, auth forms, dashboard layout, project context, URL-first scan UI, and CSS styling.
- `apps/api`: Nest modules for auth, projects, scans, environment loading, and the health endpoint.
- `apps/worker-crawl`: BullMQ worker with bounded HTTP/HTML crawling, robots parsing, bounded sitemap discovery, resource-reference extraction, frontier management, and Firebase quality/page persistence. `apps/worker-http` validates selected link/resource targets and persists normalized results/issues. `apps/worker-browser` runs isolated Playwright contexts with request interception, bounded browser facts, and screenshot evidence.
- `apps/scheduler`: scheduler entry point; currently a readiness scaffold.
- `packages/contracts`: framework-independent domain and API types, including projects, environments, scans, and statuses.
- `packages/database`: repository interfaces, Firebase Admin repositories, Firebase Storage adapter, Prisma schema/client compatibility path.
- Browser results use separate bounded repository queries for page executions and browser facts; screenshot metadata is stored in Firestore while screenshot bytes remain in private Firebase Storage.
- `packages/queue`: queue names, typed job payloads, execution-plan types, dispatcher abstraction, and BullMQ dispatcher.
- `packages/detector-sdk` and `packages/detectors`: detector interfaces and the current detector metadata catalog.
- Visual geometry is collected once per browser execution and passed to selected deterministic detectors in `packages/detectors`; findings are normalized through the existing issue repository, and responsive findings compare the selected viewport executions after the set completes.
- For accepted visual findings, the browser worker preserves the original `SCREENSHOT`, renders bounded geometry into a separate private `VISUAL_ANNOTATION`, records bounded metadata, and attaches both evidence references to the issue occurrence. Annotation failures are logged and do not invalidate the finding or scan.
- The `interactions-forms` module reuses the browser worker and isolated Playwright contexts. It discovers bounded candidates, classifies them through one safety policy, runs only explicitly selected checks, resets the page between attempts, and persists normalized interaction findings with bounded before/after screenshot evidence when needed.
- The `performance-compatibility` module reuses the browser worker. A completed navigation produces one bounded `PerformanceSnapshot` from browser Performance APIs and selected performance detectors persist actionable issues; compatibility executions use the same isolated browser boundary and are only comparable when multiple engines actually run.
- `packages/network-policy`: outbound URL validation for protocol, private/loopback/metadata hosts, and optional domain allowlists.
- `packages/auth`, `packages/config`, `packages/evidence`, `packages/integrations`, `packages/observability`, `packages/reporting`, and `packages/ui`: small shared contracts/scaffolds; their current exports are limited.

## Request and persistence flow

1. The web client uses Firebase Web Auth for sign-in/registration.
2. The web client posts the Firebase ID token to `apps/api`.
3. The API verifies the token with Firebase Admin and sets `visionqa_session` as an HttpOnly cookie.
4. Authenticated API controllers use `FirebaseSessionGuard` and delegate to services.
5. Project and environment services use Firebase repositories. Active project data is loaded into the web `ProjectProvider`.
6. Scan creation validates selected checks, persists a Firestore scan, builds a capability plan, and dispatches typed queue jobs.

```mermaid
sequenceDiagram
  participant B as Browser
  participant F as Firebase Auth
  participant A as API
  participant D as Firestore
  participant R as Redis/BullMQ
  B->>F: Sign in
  F-->>B: ID token
  B->>A: POST /api/v1/auth/session
  A->>F: Verify ID token
  A-->>B: HttpOnly visionqa_session cookie
  B->>A: Authenticated project/scan request
  A->>D: Persist/read application data
  A->>R: Dispatch selected capability jobs
```

## Boundaries and transitional paths

- Controllers own HTTP routing, Zod request validation, and HTTP error translation. Services coordinate business operations. Repositories isolate persistence.
- Firebase is the active provider for identity, user profiles, projects, environments, and scans. New scans persist their target snapshot under `projects/{projectId}/scans/{scanId}`; nested environments remain readable legacy/optional configuration.
- Prisma/Postgres remains modeled in `packages/database/prisma/schema.prisma` and is used by the legacy password/session service. It is not the active Firebase project workflow.
- Queue contracts dispatch crawl/HTTP/browser jobs without credentials. New jobs receive the persisted scan target selected by the API, and workers reload that target from the scan when processing; workers retain their own outbound network validation. Crawl discovery persists page/resource inputs; the HTTP worker validates deduplicated targets and persists normalized resource results and issue occurrences. The browser worker owns rendered execution, bounded geometry snapshots, screenshot evidence, and deterministic visual checks; interaction-specific logic remains future capability.
- The product target model is URL-first: `Project → Scan.target → Scan execution`. Environments and project `baseUrl` fields are legacy/optional and are not required by new scan creation or the primary dashboard shell. Historical scans without a target remain readable through their legacy environment reference.
- Detector SDK interfaces and metadata exist, but the detector catalog currently describes mostly planned checks.
- Evidence, integrations, reporting, and scheduler packages are interfaces or readiness scaffolds rather than complete product flows.

## Dependency direction

Prefer dependencies from applications toward shared packages. Shared packages must not import UI or application modules. Keep Firestore calls in `packages/database`; keep BullMQ wiring in `packages/queue` or infrastructure; keep browser-facing code in `apps/web`.
