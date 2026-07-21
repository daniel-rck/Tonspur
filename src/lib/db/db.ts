import { type DBSchema, type IDBPDatabase, openDB } from "idb";

/**
 * Tonspur stores everything in one out-of-line key-value store. App data
 * (the movie pack incl. the user's YouTube links, and highscores) lives here
 * in IndexedDB — never in localStorage — per the web-base local-first rule.
 */
export interface AppSchema extends DBSchema {
  kv: { key: string; value: unknown };
}

const DB_NAME = "tonspur";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AppSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<AppSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AppSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      },
    });
  }
  return dbPromise;
}

/** Read a JSON-serialisable value by key. Returns undefined when absent. */
export async function getKV<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get("kv", key)) as T | undefined;
}

/** Write a value by key and notify subscribers. */
export async function setKV(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("kv", value, key);
  notifyMutation("kv");
}

/** Notify subscribers of mutations. Channels are per-store. */
export function notifyMutation(storeName: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(`db:${storeName}`);
  channel.postMessage({ type: "mutation", at: Date.now() });
  channel.close();
}
