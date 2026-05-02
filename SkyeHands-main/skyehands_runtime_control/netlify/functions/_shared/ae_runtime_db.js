const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const runtimeRoot = path.resolve(__dirname, '..', '..', '.ae-runtime');
const dbFile = path.join(runtimeRoot, 'runtime-db.json');

const seedState = {
  clients: [],
  tasks: [],
  assignments: [],
  threads: [],
  messages: [],
  snapshots: []
};

function ensureDb() {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, `${JSON.stringify(seedState, null, 2)}\n`, 'utf8');
  }
}

function loadDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } catch {
    return { ...seedState };
  }
}

function saveDb(db) {
  ensureDb();
  fs.writeFileSync(dbFile, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function addRecord(collectionName, payload = {}) {
  const db = loadDb();
  const row = { id: makeId(collectionName.slice(0, -1)), createdAt: nowIso(), updatedAt: nowIso(), ...payload };
  db[collectionName].push(row);
  saveDb(db);
  return row;
}

function listRecords(collectionName, filter = null) {
  const db = loadDb();
  const rows = Array.isArray(db[collectionName]) ? db[collectionName] : [];
  return typeof filter === 'function' ? rows.filter(filter) : rows;
}

function updateRecord(collectionName, id, patch = {}) {
  const db = loadDb();
  let updated = null;
  db[collectionName] = (db[collectionName] || []).map((row) => {
    if (row.id !== id) return row;
    updated = { ...row, ...patch, updatedAt: nowIso() };
    return updated;
  });
  saveDb(db);
  return updated;
}

function latestSnapshot() {
  const db = loadDb();
  return (db.snapshots || []).slice(-1)[0] || null;
}

function writeSnapshot(payload = {}) {
  const db = loadDb();
  const row = {
    id: makeId('snapshot'),
    createdAt: nowIso(),
    payload
  };
  db.snapshots.push(row);
  saveDb(db);
  return row;
}

module.exports = { addRecord, listRecords, updateRecord, writeSnapshot, latestSnapshot };
