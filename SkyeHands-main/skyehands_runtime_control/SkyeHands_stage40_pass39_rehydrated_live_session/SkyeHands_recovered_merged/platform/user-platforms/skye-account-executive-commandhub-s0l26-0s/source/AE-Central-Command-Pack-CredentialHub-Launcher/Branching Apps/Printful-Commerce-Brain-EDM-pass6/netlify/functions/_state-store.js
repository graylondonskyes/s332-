
const fs = require('fs/promises');
const path = require('path');

const STORE_NAME = 'printful-pod-state';
const FALLBACK_DIR = process.env.PRINTFUL_STATE_DIR || '/tmp/printful-pod-state';
let adapterPromise = null;

function sanitizeCollection(value) {
  const cleaned = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleaned) {
    const error = new Error('collection is required.');
    error.statusCode = 400;
    throw error;
  }
  return cleaned;
}

function sanitizeId(value) {
  const cleaned = String(value || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-');
  if (!cleaned) {
    const error = new Error('id is required.');
    error.statusCode = 400;
    throw error;
  }
  return cleaned;
}

function makeRecord(collection, id, payload, meta = {}, existing = null) {
  const now = new Date().toISOString();
  return {
    id,
    collection,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    meta: {
      ...(existing?.meta || {}),
      ...(meta || {}),
    },
    payload,
  };
}

async function createFsAdapter() {
  await fs.mkdir(FALLBACK_DIR, { recursive: true }).catch(() => {});
  const dirFor = (collection) => path.join(FALLBACK_DIR, sanitizeCollection(collection));
  const fileFor = (collection, id) => path.join(dirFor(collection), `${sanitizeId(id)}.json`);

  return {
    mode: 'filesystem',
    async save(collection, id, payload, meta = {}) {
      collection = sanitizeCollection(collection);
      id = sanitizeId(id);
      await fs.mkdir(dirFor(collection), { recursive: true });
      let existing = null;
      try {
        existing = JSON.parse(await fs.readFile(fileFor(collection, id), 'utf8'));
      } catch {}
      const record = makeRecord(collection, id, payload, meta, existing);
      await fs.writeFile(fileFor(collection, id), JSON.stringify(record, null, 2), 'utf8');
      return record;
    },
    async get(collection, id) {
      collection = sanitizeCollection(collection);
      id = sanitizeId(id);
      try {
        return JSON.parse(await fs.readFile(fileFor(collection, id), 'utf8'));
      } catch {
        return null;
      }
    },
    async list(collection) {
      collection = sanitizeCollection(collection);
      const dir = dirFor(collection);
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const rows = [];
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
          try {
            rows.push(JSON.parse(await fs.readFile(path.join(dir, entry.name), 'utf8')));
          } catch {}
        }
        return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      } catch {
        return [];
      }
    },
    async remove(collection, id) {
      collection = sanitizeCollection(collection);
      id = sanitizeId(id);
      try {
        await fs.unlink(fileFor(collection, id));
      } catch {}
      return { deleted: true };
    },
  };
}

async function createBlobsAdapter() {
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore(STORE_NAME);
    const keyFor = (collection, id) => `${sanitizeCollection(collection)}/${sanitizeId(id)}.json`;
    return {
      mode: 'netlify-blobs',
      async save(collection, id, payload, meta = {}) {
        collection = sanitizeCollection(collection);
        id = sanitizeId(id);
        const existingRaw = await store.get(keyFor(collection, id), { consistency: 'strong' });
        let existing = null;
        if (existingRaw) {
          try { existing = JSON.parse(existingRaw); } catch {}
        }
        const record = makeRecord(collection, id, payload, meta, existing);
        await store.setJSON(keyFor(collection, id), record);
        return record;
      },
      async get(collection, id) {
        collection = sanitizeCollection(collection);
        id = sanitizeId(id);
        const raw = await store.get(keyFor(collection, id), { consistency: 'strong' });
        if (raw == null) return null;
        if (typeof raw === 'string') {
          try { return JSON.parse(raw); } catch { return null; }
        }
        return raw;
      },
      async list(collection) {
        collection = sanitizeCollection(collection);
        const rows = [];
        for await (const page of store.list({ prefix: `${collection}/`, paginate: true })) {
          for (const blob of page.blobs || []) {
            const raw = await store.get(blob.key, { consistency: 'strong' });
            if (raw == null) continue;
            try {
              rows.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
            } catch {}
          }
        }
        return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      },
      async remove(collection, id) {
        collection = sanitizeCollection(collection);
        id = sanitizeId(id);
        await store.delete(keyFor(collection, id));
        return { deleted: true };
      },
    };
  } catch {
    return null;
  }
}

async function getAdapter() {
  if (!adapterPromise) {
    adapterPromise = (async () => {
      const blobs = await createBlobsAdapter();
      if (blobs) return blobs;
      return createFsAdapter();
    })();
  }
  return adapterPromise;
}

async function saveRecord(collection, id, payload, meta = {}) {
  const adapter = await getAdapter();
  return adapter.save(collection, id, payload, meta);
}

async function getRecord(collection, id) {
  const adapter = await getAdapter();
  return adapter.get(collection, id);
}

async function listRecords(collection) {
  const adapter = await getAdapter();
  return adapter.list(collection);
}

async function deleteRecord(collection, id) {
  const adapter = await getAdapter();
  return adapter.remove(collection, id);
}

async function describeStore() {
  const adapter = await getAdapter();
  return {
    mode: adapter.mode,
    storeName: adapter.mode === 'netlify-blobs' ? STORE_NAME : 'filesystem-fallback',
    fallbackDir: adapter.mode === 'filesystem' ? FALLBACK_DIR : null,
  };
}

module.exports = {
  deleteRecord,
  describeStore,
  getRecord,
  listRecords,
  saveRecord,
  sanitizeCollection,
  sanitizeId,
};
