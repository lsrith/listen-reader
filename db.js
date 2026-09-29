// IndexedDB storage. Books hold metadata and the chapter list; chapter bodies
// live in their own store keyed [bookId, index] so a page loads only its range.

const DB_NAME = 'listen-reader';
const DB_VERSION = 1;

let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('books', { keyPath: 'id' });
        db.createObjectStore('chapters', { keyPath: ['book', 'i'] });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function result(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listBooks() {
  const db = await openDb();
  const books = await result(db.transaction('books').objectStore('books').getAll());
  return books.sort((a, b) => (b.lastOpened || b.addedAt) - (a.lastOpened || a.addedAt));
}

export async function getBook(id) {
  const db = await openDb();
  return result(db.transaction('books').objectStore('books').get(id));
}

export async function putBook(book) {
  const db = await openDb();
  const tx = db.transaction('books', 'readwrite');
  tx.objectStore('books').put(book);
  return done(tx);
}

export async function putChapters(chapters) {
  const db = await openDb();
  const tx = db.transaction('chapters', 'readwrite');
  const store = tx.objectStore('chapters');
  for (const c of chapters) store.put(c);
  return done(tx);
}

export async function getChapters(bookId, from, to) {
  const db = await openDb();
  const range = IDBKeyRange.bound([bookId, from], [bookId, to]);
  return result(db.transaction('chapters').objectStore('chapters').getAll(range));
}

export async function deleteChapters(bookId) {
  const db = await openDb();
  const tx = db.transaction('chapters', 'readwrite');
  tx.objectStore('chapters').delete(IDBKeyRange.bound([bookId, 0], [bookId, Infinity]));
  return done(tx);
}

export async function deleteBook(bookId) {
  await deleteChapters(bookId);
  const db = await openDb();
  const tx = db.transaction('books', 'readwrite');
  tx.objectStore('books').delete(bookId);
  return done(tx);
}

// Per-viewer settings. Storage can be unavailable (private mode), so every
// access falls back to the default.
const DEFAULTS = { perPage: 5, rate: 1 };

export function getSetting(key) {
  try {
    const v = localStorage.getItem('setting:' + key);
    return v === null ? DEFAULTS[key] : JSON.parse(v);
  } catch {
    return DEFAULTS[key];
  }
}

export function setSetting(key, value) {
  try {
    localStorage.setItem('setting:' + key, JSON.stringify(value));
  } catch {}
}
