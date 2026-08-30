import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { getFirebaseConfig } from './config';
let emulatorConnected = false;
export function getFirebaseAuth() {
  const app = getApps().length ? getApp() : initializeApp(getFirebaseConfig());
  const auth = getAuth(app);
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' && !emulatorConnected) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); emulatorConnected = true; }
  return auth;
}
