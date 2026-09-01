# Security model

Accessibility & SEO collection is bounded to selected DOM metadata and element summaries. It does not persist raw HTML, form values, or arbitrary page content, and it remains subject to the existing target validation, cancellation, and outbound network policy.
## Authentication and sessions

- Firebase Web Auth is used by `apps/web/src/lib/firebase/auth.ts`.
- `FirebaseAuthController` accepts an ID token at `/api/v1/auth/session`.
- `FirebaseSessionService` verifies ID tokens/session cookies with Firebase Admin and sets the HttpOnly `visionqa_session` cookie.
- Cookie settings are `httpOnly`, `sameSite: lax`, `path: /`, and `secure` only in production. The lifetime comes from `AUTH_SESSION_TTL_SECONDS`.
- `FirebaseSessionGuard` rejects requests without a resolvable Firebase user.
- A legacy Prisma/password/session auth path remains in `apps/api/src/modules/auth`; do not assume it is equivalent to the active Firebase path.

## Authorization and isolation

- Current Firebase repositories authorize by comparing `createdBy` on the project document with the authenticated user ID.
- Environment operations first authorize the parent project and then access the nested environment.
- Scan operations authorize the parent project and the nested scan relationship.
- The current model has `organizationId` fields, but Firebase project access is owner-based and does not implement organization membership/role authorization yet.
- Firestore and Storage rules deny all direct client reads/writes (`firestore.rules`, `storage.rules`). Application access is expected through server-side Firebase Admin repositories.
- Evidence access verifies the authenticated project owner and evidence ID before generating a short-lived signed read URL. Service-account credentials and permanent public storage URLs are never returned.

## Secrets and sensitive state

- Root `.env` is ignored by Git. `.env.example` documents configuration names.
- `NEXT_PUBLIC_FIREBASE_*` values are public web configuration. `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are server-only and must never be prefixed with `NEXT_PUBLIC_` or sent to the browser.
- Firebase Admin initialization is in `packages/database/src/firebase/firebase-admin.ts` and normalizes escaped private-key newlines.
- Queue payloads must not contain credentials, cookies, ID tokens, private keys, or target credentials.
- Interaction validation never submits forms or activates controls classified as destructive, potentially destructive, or unknown. Candidate links remain under the existing browser request interception and outbound network policy; synthetic values are not populated into sensitive fields.
- Performance collection is passive: it reads browser timing/resource entries, caps resource rows, does not fetch resources through a second client, and does not trigger page interactions or downloads. Browser comparisons use the existing intercepted executions.
- Custom Checks are data-only declarative rules. Definitions are bounded by category, operator, selector, expected-value, and project/scan limits; selectors are limited to safe bounded CSS syntax. Custom Checks cannot execute JavaScript, `eval`, `new Function`, shell commands, Playwright scripts, interactions, or arbitrary network requests. Preview validates and interprets definitions without fetching a supplied URL, and scan creation snapshots the selected version.
- Browser compatibility comparison uses only normalized, bounded console/request facts and deterministic visual support signals from the existing intercepted executions. Requested engines are never silently substituted, and unavailable/failed engines remain visible as partial coverage rather than being reported as passed.
- Full Scan does not add a network or worker-selection escape hatch. Its plan is built server-side from the detector catalog, workers reload the persisted scan target and custom snapshots, and module/check selection is preserved when shared browser facts are evaluated. Site-wide browser pages come only from the persisted fetched HTML crawl inventory; every selected page is canonicalized, same-origin checked, and revalidated through `OutboundNetworkPolicy` before navigation. Queue payloads cannot expand the page set. Cancellation remains authoritative over late capability completion, including queued browser page contexts.
- Schedules do not create a second scan execution path. Schedule creation validates ownership, recurrence, target, modules, browsers, viewports, and custom checks through the normal scan validation service; every run revalidates the saved target and reloads current project-owned custom checks before snapshotting them. The scheduler-to-API trigger uses a server-only `SCHEDULER_INTERNAL_TOKEN`; it performs no target request and has no worker queue access. Transactional occurrence claims, deterministic run IDs, and scan idempotency keys protect against duplicate scheduler instances and retries. Disabled or archived schedules cannot produce future automatic runs.
- Do not log raw session values or authentication tokens. Existing authentication diagnostics log error details; keep those logs free of secrets.

## Outbound network access

`packages/network-policy/src/index.ts` provides `OutboundNetworkPolicy`, which allows only HTTP/HTTPS, blocks localhost, loopback, common private IPv4 ranges, and the cloud metadata host, and can enforce an allowlist. It is covered by focused tests.

The crawl and HTTP workers use secure HTTP clients that validate and resolve each destination, pin the selected resolved address for the request, manually revalidate redirects, limit response size, and abort on timeout/cancellation. The browser worker installs context-level Playwright routing before page creation and applies the same policy to every HTTP/HTTPS request, including subresources and redirects. Browser interception does not guarantee DNS connection pinning against rebinding because Playwright owns the socket; container-level egress restrictions remain a required defense-in-depth layer. Robots, sitemap, and resource requests are bounded, and XML entity processing is disabled.

## API and input protections

- API controllers use Zod schemas for auth, project, environment, and scan request validation.
- Project/environment URLs are restricted to HTTP/HTTPS and normalized before persistence. New scan URLs are independently validated at the API boundary and stored as an immutable target snapshot; this syntactic validation does not replace worker-level SSRF/network-policy checks.
- Scan modules and checks are validated against the detector catalog; the backend chooses capabilities and queues.
- CORS is enabled in `apps/api/src/main.ts` with the configured `WEB_ORIGIN` and credentials.

Known gaps: no rate-limiting implementation was found; webhook verification is not implemented; no centralized structured-log redaction layer is present; and organization membership roles are not enforced in the Firebase path.

Reports are generated only from server-side, project-authorized persisted scan/result repositories. Generation rejects non-terminal scans, never navigates to the target site, never reruns detectors or changes Issue/Scan state, and stores immutable versioned snapshots with a checksum. Target URLs omit query/hash credentials, custom values are redacted, report HTML escapes target-derived text, evidence is represented only by private metadata references, and report deletion removes only the report snapshot.

## Security invariants

Future changes must preserve authenticated resource ownership checks, server-only Admin credentials, HttpOnly session cookies, deny-by-default direct Firebase rules, safe outbound URL validation, and backend-owned worker selection.
