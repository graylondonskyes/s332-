const DB_NAME = 'ae-brain-command-site';
const DB_VERSION = 1;
const STATE_STORE = 'stateSnapshots';
const SYNC_STORE = 'syncEvents';

function openDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SYNC_STORE)) db.createObjectStore(SYNC_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('indexedDB failed to open'));
  });
}

async function put(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error || new Error(`failed to write ${storeName}`));
  });
}

async function get(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error(`failed to read ${storeName}`));
  });
}

async function getAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error(`failed to list ${storeName}`));
  });
}

export async function loadHybridState(storageKey) {
  try {
    const row = await get(STATE_STORE, 'latest');
    if (row?.payload) {
      return { payload: row.payload, source: 'indexeddb', snapshotAt: row.savedAt || '' };
    }
  } catch {}
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return { payload: raw, source: 'localStorage', snapshotAt: new Date().toISOString() };
  } catch {}
  return { payload: '', source: 'empty', snapshotAt: '' };
}

export async function saveHybridState(storageKey, payload) {
  try { localStorage.setItem(storageKey, payload); } catch {}
  let indexedOk = false;
  try {
    await put(STATE_STORE, { id: 'latest', payload, savedAt: new Date().toISOString() });
    indexedOk = true;
  } catch {}
  return { localStorage: true, indexedDb: indexedOk, savedAt: new Date().toISOString() };
}

export async function queueStorageSync(meta = {}) {
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: meta.status || 'queued',
    detail: meta.detail || '',
    source: meta.source || 'indexeddb-hybrid',
    createdAt: new Date().toISOString(),
    meta,
  };
  try { await put(SYNC_STORE, event); } catch {}
  return event;
}

export async function listStorageSyncEvents(limit = 12) {
  try {
    const rows = await getAll(SYNC_STORE);
    return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
  } catch {
    return [];
  }
}

export async function syncHybridStateToNeon(payload, actor = 'local-founder') {
  try {
    const res = await fetch('/.netlify/functions/ae-storage-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor, source: 'indexeddb-hybrid', state: JSON.parse(payload || '{}') })
    });
    const data = await res.json().catch(() => ({}));
    await queueStorageSync({ status: res.ok ? 'persisted' : 'failed', detail: data?.message || data?.error || '', result: data });
    return { ok: res.ok, data };
  } catch (error) {
    await queueStorageSync({ status: 'failed', detail: error?.message || 'request failed' });
    return { ok: false, error: error?.message || 'request failed' };
  }
}
