---
name: testing
description: Use when adding regression coverage or validating changes across contracts, API services, repositories, queues, workers, and frontend features.
---

# Testing

## Prerequisites

Read `docs/TESTING.md` and inspect nearby Vitest/Playwright tests plus the package scripts.

## Procedure

1. Choose the narrowest test layer that proves the behavior.
2. Mock Firebase, Redis/BullMQ, and external services for unit tests; do not require live infrastructure for ordinary unit tests.
3. Cover invalid input, authorization boundaries, safe errors, and state transitions for API changes.
4. For orchestrators, assert that only explicitly selected checks/capabilities are dispatched.
5. For frontend changes, test labels, loading/error/empty states, and request payloads.
6. Use E2E only for critical cross-layer flows and report skipped infrastructure-dependent cases.

## Validation

Run the affected package test, then normally `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Run `pnpm test:e2e` when Firebase/API/browser prerequisites are available.

## Avoid

Do not claim live Firebase, Redis, or worker execution from mocked tests, and do not add fake scan findings or fixture records to make UI tests pass.
