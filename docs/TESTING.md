# Testing

Accessibility & SEO detector tests should cover accessible names, labels, image alt behavior, duplicate IDs, document language, metadata, and selected-check integrity. Browser integration coverage should use bounded fixtures and verify persisted findings without relying on live external sites.
## Test layout

- Unit tests use Vitest and are colocated with the package or feature under test.
- Current focused tests cover outbound network policy, DNS/private-address blocking, crawl frontier normalization/limits, robots parsing/policy, sitemap parsing, crawl-vs-sitemap comparison, browser-job validation, legacy API auth service behavior, project input validation, and scan orchestration. Browser interception, isolation, event collection, screenshot, and cancellation suites should use deterministic Playwright fixtures as they are expanded.
- Browser result/evidence routes are included in typecheck, lint, and production build validation; live authorization/storage tests should use Firebase emulators or injected repositories rather than cloud credentials in the normal unit suite.
- Visual geometry and detector tests should use bounded deterministic fixture pages; the current implementation does not claim live fixture E2E coverage until Chromium, Redis, and Firebase services are available together.
- Annotation rendering is covered with isolated image-buffer tests for clipping, numbering, unusable geometry, and invalid input; storage authorization remains an integration concern for emulator-backed tests.
- Interaction safety classification is covered with focused unit tests; live control behavior should use bounded local fixture pages and mocked Firebase/queue dependencies unless the full browser runtime is available.
- Performance tests should assert LCP/CLS threshold boundaries, unavailable metrics, bounded resources, and selected-check filtering without asserting exact wall-clock timings. Compatibility tests should compare deterministic per-browser inputs and avoid claiming support when a browser runtime is unavailable.
- Compatibility tests should cover normalized console errors, browser-specific request failures, stable render signals, selected-check filtering, partial browser matrices, unavailable runtimes, and authorization for resources/findings/compatibility endpoints. Resource tests should cover safe URL display, pagination, type, browser, slow, and large filters.
- Custom-check tests should cover selector/value validation, compatible and incompatible operators, DOM/HTTP/browser/performance evaluation, unavailable metrics as `SKIPPED`, bounded values, and the absence of executable or arbitrary-network paths. API/repository tests should cover project ownership, immutable scan snapshots, result filtering, and summary counts.
- Full Scan tests should cover capability grouping, explicit selected-check filtering, one shared browser task per engine, site-vs-single-page crawl dependencies, deterministic crawl-page filtering/deduplication/root prioritization/caps, page/browser/viewport fan-out, compatibility/responsive validation, module/capability terminal states, monotonic progress, cancellation dominance, coverage-aware reconciliation, and deterministic occurrence identities on worker retry. Full Scan summary/module/progress authorization should use mocked repositories; live Redis/Firebase/browser verification remains an infrastructure-dependent E2E concern.
- Schedule tests should use a fixed clock and mocked repositories for Daily/Weekly/Monthly recurrence, IANA timezone/DST behavior, monthly day-31 semantics, schedule/template validation, project authorization, deterministic occurrence claims, retry idempotency, overlap skips, disabled schedules, Run now idempotency, custom-check version snapshot timing, provenance, and historical retention after archive. Live Firebase transaction, Redis/API handoff, scheduler process, and timed scan execution remain infrastructure-dependent E2E checks.
- Browser E2E tests are in `tests/e2e` and use Playwright.
- E2E website fixtures are under `tests/fixtures/websites`.
- No CI workflow files were found in the repository; local scripts and package scripts are the source of truth.

## Commands

From the repository root:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

The root `test` script currently runs only `vitest run packages/network-policy/test`. Package-level tests are available through each package's `test` script, for example:

```text
pnpm --filter @visionqa/api test
pnpm --filter @visionqa/web test
```

Database helpers are defined as `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:studio`. Prisma migrations are for the retained Postgres path; Firebase development does not use them.

## E2E prerequisites

`playwright.config.ts` uses `http://localhost:3000` by default and starts the web app automatically unless `PLAYWRIGHT_BASE_URL` is supplied. The login and registration specs validate rendering, form errors, password toggling, and safe auth errors. Firebase-backed route tests are skipped unless the documented Firebase E2E environment variables are set.

The repository also contains local Firebase emulator configuration in `firebase.json`, but no E2E fixture or command was found that automatically starts all Firebase/API dependencies.

## What to test

- Contract or validation changes: add focused Vitest cases for accepted and rejected inputs.
- API/controller changes: test authentication, ownership, cross-project access, invalid input, safe errors, and state transitions.
- Repository changes: test mapping, ownership checks, atomic default-environment behavior, and provider-specific failure paths.
- Queue/orchestrator changes: assert that only selected checks and required capabilities are dispatched; mock BullMQ/Redis for unit tests.
- Frontend workflow changes: test visible loading/error/empty states and the request payload produced by selected controls; add Playwright coverage for user-critical routes when credentials/infrastructure permit.
- Security-sensitive network changes: add policy tests for protocols, private IPs, metadata hosts, allowlists, redirects, and DNS behavior.
- Crawl changes: use deterministic injected resolvers/executors or local fixtures; cover dedupe, limits, content types, redirects, timeouts, body limits, and cancellation without weakening production policy.

Report tests should use authoritative source fixtures and assert deterministic severity ordering, selected-module coverage, honest PARTIAL/FAILED/CANCELLED status rendering, unavailable metrics as unavailable rather than zero, scheduled provenance, custom-check version/value redaction, URL masking, HTML escaping, immutable regeneration, and deterministic issue/evidence bounds. API authorization and terminal-scan validation should use mocked repositories; Firebase and live report generation remain infrastructure-dependent.

## Completion criteria

Run the relevant package checks and, for normal repository changes, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Report any skipped E2E or infrastructure-dependent checks. Do not claim real queue, Firebase, Redis, or browser execution unless it was actually run.
