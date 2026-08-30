import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required Firebase server configuration: ${name}`);
  return value;
}

export function getFirebaseAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  if (process.env.USE_FIREBASE_EMULATOR === 'true') {
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    process.env.STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';
  }
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  return initializeApp({
    credential: cert({
      projectId: required('FIREBASE_PROJECT_ID'),
      clientEmail: required('FIREBASE_CLIENT_EMAIL'),
      privateKey: required('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    }),
    ...(storageBucket ? { storageBucket } : {}),
  });
}
export function getFirebaseAdminAuth(): Auth { return getAuth(getFirebaseAdminApp()); }
export function getFirestoreDb(): Firestore { return getFirestore(getFirebaseAdminApp()); }
export function getFirebaseStorage(): Storage { return getStorage(getFirebaseAdminApp()); }
