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

const TOKEN_KEY = 'mainetti_google_oauth_token_v2';
const USER_KEY = 'mainetti_google_oauth_user_v2';
const EXPIRY_KEY = 'mainetti_google_oauth_expiry_v2';

export const saveTokenToStorage = (token: string, user: any) => {
  try {
    cachedAccessToken = token;
    localStorage.setItem(TOKEN_KEY, token);
    const userInfo = {
      displayName: user.displayName || 'Google Connected User',
      email: user.email || 'user@google.com',
      photoURL: user.photoURL || '',
      uid: user.uid || 'gis-' + Date.now(),
    };
    localStorage.setItem(USER_KEY, JSON.stringify(userInfo));
    // Google access tokens expire in 3600s. Store expiration timestamp (55 minutes for safety)
    const expiresAt = Date.now() + 55 * 60 * 1000;
    localStorage.setItem(EXPIRY_KEY, String(expiresAt));
  } catch (e) {
    console.error('Failed to save token to localStorage:', e);
  }
};

export const getStoredTokenAndUser = (): { token: string; user: any } | null => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    const expiryStr = localStorage.getItem(EXPIRY_KEY);

    if (!token || !rawUser || !expiryStr) return null;

    const expiresAt = parseInt(expiryStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      clearTokenStorage();
      return null;
    }

    const user = JSON.parse(rawUser);
    cachedAccessToken = token;
    return { token, user };
  } catch (e) {
    return null;
  }
};

export const clearTokenStorage = () => {
  try {
    cachedAccessToken = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  } catch (e) {
    console.error('Failed to clear token storage:', e);
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Restore saved session immediately on page load / reload if valid
  const stored = getStoredTokenAndUser();
  if (stored) {
    cachedAccessToken = stored.token;
    if (onAuthSuccess) onAuthSuccess(stored.user as User, stored.token);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        saveTokenToStorage(cachedAccessToken, user);
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        const stored = getStoredTokenAndUser();
        if (stored) {
          if (onAuthSuccess) onAuthSuccess(user, stored.token);
        } else if (!isSigningIn) {
          if (onAuthFailure) onAuthFailure();
        }
      }
    } else {
      const stored = getStoredTokenAndUser();
      if (stored) {
        if (onAuthSuccess) onAuthSuccess(stored.user as User, stored.token);
      } else {
        if (onAuthFailure) onAuthFailure();
      }
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
              saveTokenToStorage(response.access_token, mockUser);
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
    saveTokenToStorage(credential.accessToken, result.user);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.warn('Firebase popup sign-in attempt encountered issue:', error);
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
        throw error;
      }
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  const stored = getStoredTokenAndUser();
  return stored ? stored.token : null;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const googleSignOut = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('SignOut error:', e);
  }
  clearTokenStorage();
};
