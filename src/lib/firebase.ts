import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const WORKSPACE_SCOPES = ['https://www.googleapis.com/auth/gmail.send'] as const;

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => googleProvider.addScope(scope));
googleProvider.setCustomParameters({ prompt: 'select_account' });

let cachedGmailAccessToken: string | null = null;

export function setCachedGmailAccessToken(token: string | null): void {
  cachedGmailAccessToken = token;
}

export function getCachedGmailAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export async function requestGmailAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedGmailAccessToken) {
    return cachedGmailAccessToken;
  }

  const result = auth.currentUser
    ? await reauthenticateWithPopup(auth.currentUser, googleProvider)
    : await signInWithPopup(auth, googleProvider);

  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('ไม่สามารถรับสิทธิ์ส่งอีเมลผ่าน Gmail ได้ กรุณาลองอนุญาตอีกครั้ง');
  }

  cachedGmailAccessToken = credential.accessToken;
  return cachedGmailAccessToken;
}

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
