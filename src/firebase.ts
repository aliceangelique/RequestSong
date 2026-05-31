import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Safe checking if Firebase is fully provisioned
export const isFirebaseConfigured = !!(
  firebaseConfig &&
  firebaseConfig.apiKey &&
  firebaseConfig.projectId
);

const app = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

// Initialize exports safely with experimentalForceLongPolling to handle proxy/iframe/sandbox WS blockers
export const db = app
  ? initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId || '(default)')
  : null;
export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Global Firestore error handler that converts "Missing or insufficient permissions"
 * into a structured JSON string for automated diagnostics.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };

  console.error('Firestore Error captured: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Sign in helper utilizing popup login as suggested for iframe compatibility
 */
export async function signInWithGoogle() {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Check your configurations.');
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In failed:', error);
    throw error;
  }
}

/**
 * Sign in helper utilizing redirect login for webviews and popup-restricted environments
 */
export async function signInWithGoogleRedirect() {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Check your configurations.');
  }
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error('Google Redirect Sign-In failed:', error);
    throw error;
  }
}

/**
 * Helper to fetch redirect results on page reload
 */
export async function getGoogleRedirectResult() {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error) {
    console.error('Google Redirect Retrieval failed:', error);
    throw error;
  }
}

/**
 * Sign out helper
 */
export async function handleSignOut() {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-Out failed:', error);
    throw error;
  }
}
