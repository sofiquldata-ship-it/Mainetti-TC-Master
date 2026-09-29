import { initializeFirestore, doc, getDoc, setDoc, deleteDoc, setLogLevel, Firestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { LinkedSheetConfig } from './googleSheetsService';
import { PIData } from '../types/tc';

// Mute internal Firestore SDK network retry/offline logs to prevent console errors
try {
  setLogLevel('silent');
} catch {
  // ignore if not supported in environment
}

// Cloud Firestore is not provisioned on this GCP project (the app uses Google Sheets & localStorage).
// Keeping this flag disabled prevents unhandled connection failure errors and network stalls.
const IS_FIRESTORE_ENABLED = false;

let dbInstance: Firestore | null = null;

function getDb(): Firestore | null {
  if (!IS_FIRESTORE_ENABLED) return null;
  if (!dbInstance) {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      dbInstance = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });
    } catch {
      dbInstance = null;
    }
  }
  return dbInstance;
}

export const db = dbInstance;

const CONFIG_DOC_PATH = 'app_config/master_google_sheet';
const DATA_DOC_PATH = 'app_data/master_pi_list';

// Helper for timeout wrapper so offline state doesn't block UI or throw unhandled exceptions
const withTimeout = <T>(promise: Promise<T>, timeoutMs = 2000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore connection timeout')), timeoutMs)
    ),
  ]);
};

/**
 * Save master Google Sheet configuration to cloud Firestore so all devices/browsers share the same sheet
 */
export const saveLinkedSheetToFirestore = async (config: LinkedSheetConfig | null): Promise<void> => {
  if (!IS_FIRESTORE_ENABLED) return;
  try {
    const firestore = getDb();
    if (!firestore) return;
    const configDocRef = doc(firestore, CONFIG_DOC_PATH);
    if (!config) {
      await withTimeout(deleteDoc(configDocRef));
    } else {
      await withTimeout(
        setDoc(configDocRef, {
          ...config,
          updatedAt: new Date().toISOString(),
        })
      );
    }
  } catch {
    // Silent fallback to local storage
  }
};

/**
 * Fetch master Google Sheet configuration from cloud Firestore
 */
export const fetchLinkedSheetFromFirestore = async (): Promise<LinkedSheetConfig | null> => {
  if (!IS_FIRESTORE_ENABLED) return null;
  try {
    const firestore = getDb();
    if (!firestore) return null;
    const configDocRef = doc(firestore, CONFIG_DOC_PATH);
    const snap = await withTimeout(getDoc(configDocRef));
    if (snap.exists()) {
      const data = snap.data();
      return {
        spreadsheetId: data.spreadsheetId,
        spreadsheetUrl: data.spreadsheetUrl,
        title: data.title,
        lastSyncedAt: data.lastSyncedAt,
        autoSync: data.autoSync ?? true,
      };
    }
  } catch {
    // Silent fallback to local storage
  }
  return null;
};

/**
 * Save entire PI master list to Firestore for cross-browser persistence
 */
export const savePIDataToFirestore = async (piList: PIData[]): Promise<void> => {
  if (!IS_FIRESTORE_ENABLED) return;
  try {
    const firestore = getDb();
    if (!firestore) return;
    const dataDocRef = doc(firestore, DATA_DOC_PATH);
    await withTimeout(
      setDoc(dataDocRef, {
        items: piList,
        updatedAt: new Date().toISOString(),
        count: piList.length,
      })
    );
  } catch {
    // Silent fallback to local storage
  }
};

/**
 * Fetch PI master list from Firestore for cross-browser persistence
 */
export const fetchPIDataFromFirestore = async (): Promise<PIData[] | null> => {
  if (!IS_FIRESTORE_ENABLED) return null;
  try {
    const firestore = getDb();
    if (!firestore) return null;
    const dataDocRef = doc(firestore, DATA_DOC_PATH);
    const snap = await withTimeout(getDoc(dataDocRef));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.items)) {
        return data.items;
      }
    }
  } catch {
    // Silent fallback to local storage
  }
  return null;
};
