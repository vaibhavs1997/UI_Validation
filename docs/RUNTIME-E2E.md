# Runtime E2E prerequisites

The runtime verification target uses local-only infrastructure:

- Firebase Auth, Firestore, and Storage emulators with project id `visionqa-local`
- Redis on `127.0.0.1:6380`, isolated from the normal development port
- The deterministic fixture website on `127.0.0.1:4100`
- API on port 4000 and web on port 3000

Install Java (required by the Firebase Emulator Suite), Firebase CLI, Docker Desktop with Linux containers, and the Playwright Chromium dependency before running the runtime suite. The repository does not commit credentials or production Firebase settings for this environment.

Run `pnpm e2e:runtime` to perform prerequisite checks, start the isolated Redis container, start the fixture, and start the Firebase emulators. The command intentionally fails when Firebase CLI or Docker is unavailable; it never falls back to production Firebase or a broad private-network bypass.

The runner validates Firebase CLI, Docker, and Java before starting. The fixture exposes `/health`, crawl pages, robots/sitemap data, broken resources, redirects, slow responses, browser error pages, and deterministic visual geometry pages. It exists only to exercise already-implemented modules; it does not add detectors.
