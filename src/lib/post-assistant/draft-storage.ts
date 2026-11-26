'use client';

import {
  ActivityBrief,
  BrandId,
  CoverHeadline,
  MediaMode,
  StructuredCaptions,
  TargetChannelsConfig,
} from './types';

const DB_NAME = 'sv_post_assistant_v2';
const STORE_NAME = 'active_session';
const ACTIVE_KEY = 'current_draft';

export interface LocalAutosaveSnapshot {
  draftId: string | null;
  brand: BrandId;
  mediaMode: MediaMode;
  brief: ActivityBrief;
  coverHeadline: CoverHeadline;
  captions: StructuredCaptions;
  targetChannels: TargetChannelsConfig;
  savedAt: string;
}

function openAutosaveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function saveLocalAutosave(snapshot: LocalAutosaveSnapshot): Promise<void> {
  try {
    const db = await openAutosaveDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot, ACTIVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Non-fatal in private browsing / SSR
  }
}

export async function loadLocalAutosave(): Promise<LocalAutosaveSnapshot | null> {
  try {
    const db = await openAutosaveDb();
    const result = await new Promise<LocalAutosaveSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(ACTIVE_KEY);
      req.onsuccess = () => resolve((req.result as LocalAutosaveSnapshot) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function clearLocalAutosave(): Promise<void> {
  try {
    const db = await openAutosaveDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(ACTIVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Non-fatal
  }
}
