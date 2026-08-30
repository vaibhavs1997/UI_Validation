
declare const __VISIONQA_FIREBASE_CONFIG__: FirebaseOptions;
export const firebaseConfig = __VISIONQA_FIREBASE_CONFIG__;
export function assertFirebaseConfig(): void {
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const;
  const missing = required.filter((key) => !firebaseConfig[key]);
  if (missing.length) throw new Error(`Firebase is not configured. Missing: ${missing.join(', ')}`);
}
export function getFirebaseConfig(): FirebaseOptions {
  assertFirebaseConfig();
  return firebaseConfig as FirebaseOptions;
}
import type { FirebaseOptions } from 'firebase/app';
