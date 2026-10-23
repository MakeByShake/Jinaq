import { initializeApp, getApps } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isBrowser = typeof window !== 'undefined';
export const isFirebaseConfigured = !!firebaseConfig.apiKey;

if (isBrowser && !isFirebaseConfigured) {
  console.error(
    '[Jinaq] Firebase is not configured: set the NEXT_PUBLIC_FIREBASE_* environment variables ' +
      '(locally in .env.local, on Vercel in Project Settings → Environment Variables) and redeploy.',
  );
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Without an API key getAuth() throws, which would break `next build` and the whole page.
// In that case auth stays null: public pages still render, sign-in shows an error.
export const auth: Auth = isFirebaseConfigured ? getAuth(app) : (null as unknown as Auth);

// Enable offline persistence with multi-tab support
export const db = isBrowser
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  : getFirestore(app);
