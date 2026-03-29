/* IndexedDB wrapper for CosmiCanvas */

const DB_NAME = 'maya_whiteboard';
const DB_VER  = 1;

let _dbPromise = null;

export function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('boards')) {
        db.createObjectStore('boards', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then(db => {
    const t = db.transaction(storeName, mode);
    return t.objectStore(storeName);
  });
}

function req(store, method, ...args) {
  return new Promise((resolve, reject) => {
    const r = store[method](...args);
    r.onsuccess = () => resolve(r.result);
    r.onerror   = () => reject(r.error);
  });
}

/* ---- boards ---- */

export async function saveBoard(board) {
  const store = await tx('boards', 'readwrite');
  board.updatedAt = Date.now();
  return req(store, 'put', board);
}

export async function loadBoard(id) {
  const store = await tx('boards', 'readonly');
  return req(store, 'get', id);
}

export async function listBoards() {
  const store = await tx('boards', 'readonly');
  const all = await req(store, 'getAll');
  return all
    .map(b => ({ id: b.id, name: b.name, updatedAt: b.updatedAt }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function deleteBoard(id) {
  const store = await tx('boards', 'readwrite');
  return req(store, 'delete', id);
}

/* ---- blobs ---- */

export async function saveBlob(key, data, mimeType, width, height) {
  const store = await tx('blobs', 'readwrite');
  return req(store, 'put', { key, data, mimeType, width, height });
}

export async function loadBlob(key) {
  const store = await tx('blobs', 'readonly');
  return req(store, 'get', key);
}

export async function deleteBlob(key) {
  const store = await tx('blobs', 'readwrite');
  return req(store, 'delete', key);
}

export async function deleteOrphanedBlobs(boardId) {
  const board = await loadBoard(boardId);
  if (!board) return;
  const used = new Set();
  for (const el of board.elements || []) {
    if (el.blobKey) used.add(el.blobKey);
  }
  const store = await tx('blobs', 'readwrite');
  const allKeys = await req(store, 'getAllKeys');
  for (const k of allKeys) {
    if (!used.has(k)) {
      store.delete(k);
    }
  }
}
