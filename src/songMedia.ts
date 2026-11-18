// Per-song recordings chosen by the user, kept on this device:
// - a YouTube video (only its id, in localStorage), played with the official embed;
// - an audio file of their own (mp3/m4a/...), stored in IndexedDB.

const LINKS_KEY = 'pustaha_song_youtube';
const DB_NAME = 'pustaha-media';
const STORE = 'audio';

export const songKey = (book: string, number: string) => `${book}:${number}`;

/** "https://youtu.be/ID", "watch?v=ID", "/shorts/ID", "/embed/ID" or a bare id → id. */
export function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function readLinks(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LINKS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getYoutubeLink(key: string): string | null {
  return readLinks()[key] ?? null;
}

export function setYoutubeLink(key: string, id: string | null) {
  try {
    const links = readLinks();
    if (id) links[key] = id;
    else delete links[key];
    localStorage.setItem(LINKS_KEY, JSON.stringify(links));
  } catch {
    // storage unavailable (private mode)
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export interface SavedAudio {
  name: string;
  blob: Blob;
}

export function getAudio(key: string): Promise<SavedAudio | undefined> {
  return withStore<SavedAudio | undefined>('readonly', (s) => s.get(key)).catch(() => undefined);
}

export function saveAudio(key: string, file: File): Promise<void> {
  return withStore<void>('readwrite', (s) => s.put({ name: file.name, blob: file } satisfies SavedAudio, key));
}

export function deleteAudio(key: string): Promise<void> {
  return withStore<void>('readwrite', (s) => s.delete(key));
}
