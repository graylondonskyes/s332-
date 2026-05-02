#!/usr/bin/env node
/**
 * SkyDexia Provenance Ledger
 * Immutable record of every project lifecycle action: ingested, generated, exported.
 * Supports audit queries, hash verification, and chain-of-custody reporting.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROVENANCE_DIR = path.join(__dirname, 'provenance');

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function listProvenanceRecords(filter = {}) {
  if (!fs.existsSync(PROVENANCE_DIR)) return { ok: true, count: 0, records: [] };
  const files = fs.readdirSync(PROVENANCE_DIR).filter(f => f.endsWith('.json') && f !== 'shipment-log.json');
  const records = files.map(f => {
    const data = readJson(path.join(PROVENANCE_DIR, f), {});
    return { file: f, ...data };
  });

  let results = records;
  if (filter.projectId) results = results.filter(r => r.projectId === filter.projectId);
  if (filter.action) results = results.filter(r => r.action === filter.action);

  results.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  return { ok: true, count: results.length, records: results };
}

export function getProjectProvenance(projectId) {
  const all = listProvenanceRecords({ projectId });
  return { ok: true, projectId, timeline: all.records };
}

export function verifyProvenanceHash(recordFile) {
  const fullPath = path.join(PROVENANCE_DIR, recordFile);
  const record = readJson(fullPath, null);
  if (!record) throw new Error(`Provenance record '${recordFile}' not found`);
  const { hash, ...rest } = record;
  const recomputed = crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex');
  return { ok: hash === recomputed, recordFile, storedHash: hash, recomputedHash: recomputed, match: hash === recomputed };
}

export function appendProvenanceEntry(entry = {}) {
  if (!entry.projectId || !entry.action) throw new Error('entry.projectId and entry.action are required');
  const now = new Date().toISOString();
  const entryId = crypto.randomBytes(6).toString('hex');
  const record = { ...entry, at: now, entryId };
  record.hash = crypto.createHash('sha256').update(JSON.stringify({ ...record, hash: undefined })).digest('hex');
  const fileName = `${entry.projectId}-${entry.action}-${entryId}.json`;
  writeJson(path.join(PROVENANCE_DIR, fileName), record);
  return { ok: true, entryId, fileName, hash: record.hash };
}

export function generateChainOfCustodyReport(projectId) {
  const provenance = getProjectProvenance(projectId);
  const verified = provenance.timeline.map(r => {
    if (!r.file) return { ...r, hashVerified: null };
    try { return { ...r, ...verifyProvenanceHash(r.file) }; } catch { return { ...r, hashVerified: false }; }
  });
  const allVerified = verified.every(r => r.match !== false);
  return {
    ok: true,
    projectId,
    reportGeneratedAt: new Date().toISOString(),
    integrityStatus: allVerified ? 'VERIFIED' : 'TAMPERED_OR_MISSING',
    actionCount: verified.length,
    timeline: verified,
  };
}

// CLI interface
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === 'list') {
    console.log(JSON.stringify(listProvenanceRecords(), null, 2));
  } else if (cmd === 'project') {
    console.log(JSON.stringify(getProjectProvenance(process.argv[3]), null, 2));
  } else if (cmd === 'verify') {
    console.log(JSON.stringify(verifyProvenanceHash(process.argv[3]), null, 2));
  } else if (cmd === 'report') {
    console.log(JSON.stringify(generateChainOfCustodyReport(process.argv[3]), null, 2));
  } else {
    console.log('Usage: node skydexia-provenance.mjs list|project <id>|verify <file>|report <id>');
  }
}
