---
name: security-review
description: Use when changing authentication, authorization, secrets, outbound URL access, queues, file/evidence handling, logging, or external integrations.
---

# Security review

## Prerequisites

Read `docs/SECURITY.md` and inspect `firestore.rules`, `storage.rules`, Firebase session code, `packages/network-policy`, API guards, and the affected feature.

## Procedure

1. Identify the trust boundary and the authenticated identity source.
2. Verify every project-scoped resource relationship server-side.
3. Confirm secrets remain server-only and are absent from logs, browser bundles, and queue payloads.
4. For outbound requests, enforce HTTP/HTTPS and the existing network policy; test private, loopback, metadata, redirect, and allowlist cases as applicable.
5. Validate all external input and return safe user-facing errors.
6. Document protections that are missing as known gaps rather than implying they exist.

## Validation

Run focused security tests, `pnpm typecheck`, `pnpm lint`, and relevant package tests/builds. Do not claim live provider or queue verification unless it was performed.

## Avoid

Never log tokens/private keys, place Admin credentials in `NEXT_PUBLIC_` variables, trust frontend-selected workers, or bypass deny-by-default Firebase rules.
