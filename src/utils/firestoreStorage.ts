import { initializeFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { LinkedSheetConfig } from './googleSheetsService';
import { PIData } from '../types/tc';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

const CONFIG_DOC_PATH = 'app_config/master_google_sheet';
const DATA_DOC_PATH = 'app_data/master_pi_list';

// Helper for timeout wrapper so offline state doesn't block UI or throw unhandled exceptions
const withTimeout = <T>(promise: Promise<T>, timeoutMs = 3000): Promise<T> => {
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
  try {
    const configDocRef = doc(db, CONFIG_DOC_PATH);
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
  } catch (err) {
    console.warn('Firestore save linked sheet skipped/offline (falling back to localStorage):', err);
  }
};

/**
 * Fetch master Google Sheet configuration from cloud Firestore
 */
export const fetchLinkedSheetFromFirestore = async (): Promise<LinkedSheetConfig | null> => {
  try {
    const configDocRef = doc(db, CONFIG_DOC_PATH);
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
  } catch (err) {
    console.warn('Firestore fetch linked sheet skipped/offline:', err);
  }
  return null;
};

/**
 * Save entire PI master list to Firestore for cross-browser persistence
 */
export const savePIDataToFirestore = async (piList: PIData[]): Promise<void> => {
  try {
    const dataDocRef = doc(db, DATA_DOC_PATH);
    await withTimeout(
      setDoc(dataDocRef, {
        items: piList,
        updatedAt: new Date().toISOString(),
        count: piList.length,
      })
    );
  } catch (err) {
    console.warn('Firestore save PIData skipped/offline:', err);
  }
};

/**
 * Fetch PI master list from Firestore for cross-browser persistence
 */
export const fetchPIDataFromFirestore = async (): Promise<PIData[] | null> => {
  try {
    const dataDocRef = doc(db, DATA_DOC_PATH);
    const snap = await withTimeout(getDoc(dataDocRef));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.items)) {
        return data.items;
      }
    }
  } catch (err) {
    console.warn('Firestore fetch PIData skipped/offline:', err);
  }
  return null;
};
