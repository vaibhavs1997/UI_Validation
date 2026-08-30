import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rootEnv = Object.fromEntries(fs.readFileSync(path.join(workspaceRoot, '.env'), 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => { const separator = line.indexOf('='); return [line.slice(0, separator), line.slice(separator + 1).trim().replace(/^"|"$/g, '')]; }));
const publicFirebaseEnv = {
  apiKey: rootEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: rootEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: rootEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: rootEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: rootEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: rootEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: rootEnv.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep dev artifacts isolated so `next build` cannot invalidate a running dev server.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  transpilePackages: ['@visionqa/contracts', '@visionqa/ui'],
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: publicFirebaseEnv.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: publicFirebaseEnv.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: publicFirebaseEnv.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: publicFirebaseEnv.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: publicFirebaseEnv.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: publicFirebaseEnv.appId,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: publicFirebaseEnv.measurementId,
    NEXT_PUBLIC_USE_FIREBASE_EMULATOR: rootEnv.NEXT_PUBLIC_USE_FIREBASE_EMULATOR,
  },
  webpack: (config, { webpack }) => {
    config.plugins.push(new webpack.DefinePlugin({
      __VISIONQA_FIREBASE_CONFIG__: JSON.stringify({
        ...publicFirebaseEnv,
      }),
    }));
    return config;
  },
};
export default nextConfig;
