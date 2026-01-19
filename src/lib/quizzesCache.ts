type CachedQuiz = Record<string, unknown>;

const DB_NAME = "quizza-host-cache";
const DB_VERSION = 1;
const STORE_NAME = "quizzes";
const CACHE_KEY = "list";

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

export const readCachedQuizzes = async (): Promise<CachedQuiz[] | null> => {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(CACHE_KEY);
    const result = await new Promise<unknown>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return Array.isArray(result) ? (result as CachedQuiz[]) : null;
  } catch {
    return null;
  }
};

export const writeCachedQuizzes = async (quizzes: CachedQuiz[]) => {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(quizzes, CACHE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore cache errors
  }
};
