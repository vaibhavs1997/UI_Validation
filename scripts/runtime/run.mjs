import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const children = [];
const env = { ...process.env, NODE_ENV: 'development', RUNTIME_E2E: 'true', RUNTIME_FIXTURE_HOST: '127.0.0.1', RUNTIME_FIXTURE_IP: '127.0.0.1', USE_FIREBASE_EMULATOR: 'true', NEXT_PUBLIC_USE_FIREBASE_EMULATOR: 'true', FIREBASE_PROJECT_ID: process.env.RUNTIME_FIREBASE_PROJECT_ID ?? 'visionqa-local', FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ?? 'runtime@visionqa-local.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ?? 'runtime-key', FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ?? 'visionqa-local.appspot.com', REDIS_URL: process.env.RUNTIME_REDIS_URL ?? 'redis://127.0.0.1:6380', RUNTIME_FIXTURE_PORT: process.env.RUNTIME_FIXTURE_PORT ?? '4100' };
const command = (file, args, options = {}) => { const child = spawn(file, args, { env, stdio: 'inherit', ...options }); children.push(child); return child; };
const executable = (name) => isWindows ? `${name}.cmd` : name;
const check = (file, args = ['--version']) => new Promise((resolve) => { const child = spawn(file, args, { stdio: 'ignore' }); child.once('error', () => resolve(false)); child.once('exit', (code) => resolve(code === 0)); });

const missing = [];
for (const [label, file, args] of [['Firebase CLI', executable('firebase'), ['--version']], ['Docker', executable('docker'), ['--version']], ['Java', executable('java'), ['-version']]]) if (!(await check(file, args))) missing.push(label);
if (missing.length) { console.error(`Runtime E2E prerequisites missing: ${missing.join(', ')}. Install the listed tools, then rerun pnpm e2e:runtime.`); process.exitCode = 1; }
else {
  command(executable('docker'), ['compose', '-f', 'docker-compose.runtime.yml', 'up', '-d', 'redis-runtime']);
  command(process.execPath, ['tests/fixtures/runtime/server.mjs']);
  command(executable('firebase'), ['emulators:start', '--project', env.FIREBASE_PROJECT_ID, '--only', 'auth,firestore,storage']);
  command(executable('pnpm'), ['--filter', '@visionqa/api', 'dev:watch']);
  command(executable('pnpm'), ['--filter', '@visionqa/worker-crawl', 'dev']);
  command(executable('pnpm'), ['--filter', '@visionqa/worker-http', 'dev']);
  command(executable('pnpm'), ['--filter', '@visionqa/worker-browser', 'dev']);
  command(executable('pnpm'), ['--filter', '@visionqa/web', 'dev']);
  console.log('Runtime services are starting: Firebase emulators, Redis, fixture, API, workers, and web.');
}

const stop = () => { for (const child of children) child.kill('SIGTERM'); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
