import { getApps, initializeApp, type FirebaseApp } from "firebase/app";

/**
 * Placeholder web config. No Firebase project exists yet — fill these values
 * in (Project settings → Your apps → SDK setup) and the app goes live.
 */
const PLACEHOLDER: Record<string, string> = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

function hasRealConfig(): boolean {
  return PLACEHOLDER.apiKey !== "YOUR_API_KEY";
}

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!hasRealConfig()) return null;
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(PLACEHOLDER);
  }
  return app;
}

export function isFirebaseConfigured(): boolean {
  return hasRealConfig() && typeof window !== "undefined";
}
