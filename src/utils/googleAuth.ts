import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

declare global {
  interface Window {
    google?: any;
  }
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const gisTokenClientSignIn = (): Promise<{ user: User; accessToken: string }> => {
  return new Promise((resolve, reject) => {
    const clientId = firebaseConfig.oAuthClientId;
    if (!clientId) {
      reject(new Error('OAuth Client ID is missing in firebase-applet-config.json'));
      return;
    }

    const startGIS = () => {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error || 'Google OAuth Sign-In failed'));
              return;
            }
            if (response.access_token) {
              cachedAccessToken = response.access_token;
              const mockUser: any = {
                displayName: 'Google Connected User',
                email: 'user@google.com',
                uid: 'gis-' + Date.now(),
              };
              resolve({ user: mockUser, accessToken: response.access_token });
            } else {
              reject(new Error('No access token received from Google OAuth'));
            }
          },
        });
        client.requestAccessToken();
      } catch (err) {
        reject(err);
      }
    };

    if (!window.google?.accounts?.oauth2) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = startGIS;
      script.onerror = () => reject(new Error('Failed to load Google Identity Services library'));
      document.body.appendChild(script);
    } else {
      startGIS();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    // 1. First try Firebase popup sign-in
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google sign in');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.warn('Firebase popup sign-in attempt encountered issue:', error);
    // 2. If unauthorized domain or popup blocked on Vercel/custom host, try direct GIS token client
    if (
      error?.code === 'auth/unauthorized-domain' ||
      error?.message?.includes('unauthorized-domain') ||
      error?.code === 'auth/popup-blocked'
    ) {
      try {
        console.log('Attempting GIS token client fallback...');
        const gisRes = await gisTokenClientSignIn();
        return gisRes;
      } catch (gisError) {
        console.error('GIS token client fallback error:', gisError);
        throw error; // Throw original error so UI can display domain authorization instructions
      }
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
