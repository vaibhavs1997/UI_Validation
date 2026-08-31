# Security model

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
- Do not log raw session values or authentication tokens. Existing authentication diagnostics log error details; keep those logs free of secrets.

## Outbound network access

`packages/network-policy/src/index.ts` provides `OutboundNetworkPolicy`, which allows only HTTP/HTTPS, blocks localhost, loopback, common private IPv4 ranges, and the cloud metadata host, and can enforce an allowlist. It is covered by focused tests.

The crawl and HTTP workers use secure HTTP clients that validate and resolve each destination, pin the selected resolved address for the request, manually revalidate redirects, limit response size, and abort on timeout/cancellation. The browser worker installs context-level Playwright routing before page creation and applies the same policy to every HTTP/HTTPS request, including subresources and redirects. Browser interception does not guarantee DNS connection pinning against rebinding because Playwright owns the socket; container-level egress restrictions remain a required defense-in-depth layer. Robots, sitemap, and resource requests are bounded, and XML entity processing is disabled.

## API and input protections

- API controllers use Zod schemas for auth, project, environment, and scan request validation.
- Project/environment URLs are restricted to HTTP/HTTPS and normalized before persistence.
- Scan modules and checks are validated against the detector catalog; the backend chooses capabilities and queues.
- CORS is enabled in `apps/api/src/main.ts` with the configured `WEB_ORIGIN` and credentials.

Known gaps: no rate-limiting implementation was found; webhook verification is not implemented; no centralized structured-log redaction layer is present; and organization membership roles are not enforced in the Firebase path.

## Security invariants

Future changes must preserve authenticated resource ownership checks, server-only Admin credentials, HttpOnly session cookies, deny-by-default direct Firebase rules, safe outbound URL validation, and backend-owned worker selection.
