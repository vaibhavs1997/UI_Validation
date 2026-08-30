import { defineConfig } from '@playwright/test';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: 'pnpm --filter @visionqa/web dev', port: 3000, reuseExistingServer: true },
  use: { baseURL },
});
