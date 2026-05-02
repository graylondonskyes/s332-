#!/usr/bin/env node
/**
 * SkyDexia Project Ingestion API
 * Accepts project specs, validates them, adds capabilities to the registry,
 * and records provenance.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const REGISTRY_PATH = path.join(__dirname, 'capability-registry.json');
const PROVENANCE_DIR = path.join(__dirname, 'provenance');
const PROJECTS_PATH = path.join(__dirname, 'generated-projects', 'projects-index.json');

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function generateId(prefix = 'proj') {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

export function validateProjectSpec(spec = {}) {
  const errors = [];
  if (!spec.name || typeof spec.name !== 'string' || !spec.name.trim()) errors.push('name is required');
  if (!spec.description || typeof spec.description !== 'string') errors.push('description is required');
  if (!Array.isArray(spec.capabilities) || spec.capabilities.length === 0) errors.push('capabilities[] must be a non-empty array');
  if (spec.capabilities) {
    spec.capabilities.forEach((cap, i) => {
      if (!cap.id) errors.push(`capabilities[${i}].id is required`);
      if (!cap.lane) errors.push(`capabilities[${i}].lane is required`);
    });
  }
  return errors;
}

export function ingestProject(spec = {}) {
  const errors = validateProjectSpec(spec);
  if (errors.length > 0) throw new Error(`Invalid project spec: ${errors.join(', ')}`);

  const projectId = generateId('proj');
  const now = new Date().toISOString();

  // Build project record
  const project = {
    id: projectId,
    name: spec.name.trim(),
    description: spec.description,
    capabilities: spec.capabilities,
    template: spec.template || null,
    owner: spec.owner || 'unknown',
    tags: Array.isArray(spec.tags) ? spec.tags : [],
    status: 'ingested',
    ingestedAt: now,
    generatedAt: null,
    exportedAt: null,
  };

  // Persist to projects index
  const projects = readJson(PROJECTS_PATH, []);
  projects.push(project);
  writeJson(PROJECTS_PATH, projects);

  // Register capabilities in the registry
  const registry = readJson(REGISTRY_PATH, { version: 1, capabilities: [] });
  for (const cap of spec.capabilities) {
    const existingIdx = registry.capabilities.findIndex(c => c.id === cap.id);
    const entry = {
      id: cap.id,
      lane: cap.lane,
      requires: Array.isArray(cap.requires) ? cap.requires : [],
      entrypoint: cap.entrypoint || null,
      projectId,
      addedAt: now,
    };
    if (existingIdx >= 0) {
      registry.capabilities[existingIdx] = { ...registry.capabilities[existingIdx], ...entry };
    } else {
      registry.capabilities.push(entry);
    }
  }
  writeJson(REGISTRY_PATH, registry);

  // Write provenance record
  const provenanceRecord = {
    projectId,
    action: 'ingested',
    spec,
    at: now,
    hash: crypto.createHash('sha256').update(JSON.stringify(spec)).digest('hex'),
  };
  const provenancePath = path.join(PROVENANCE_DIR, `${projectId}-ingest.json`);
  writeJson(provenancePath, provenanceRecord);

  return { ok: true, projectId, project, provenanceHash: provenanceRecord.hash };
}

export function listProjects(filter = {}) {
  const projects = readJson(PROJECTS_PATH, []);
  let results = projects;
  if (filter.status) results = results.filter(p => p.status === filter.status);
  if (filter.owner) results = results.filter(p => p.owner === filter.owner);
  return { ok: true, count: results.length, projects: results };
}

export function getProject(projectId) {
  const projects = readJson(PROJECTS_PATH, []);
  const project = projects.find(p => p.id === projectId);
  if (!project) throw new Error(`Project '${projectId}' not found`);
  const provenancePath = path.join(PROVENANCE_DIR, `${projectId}-ingest.json`);
  const provenance = readJson(provenancePath, null);
  return { ok: true, project, provenance };
}

// CLI interface
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === 'list') {
    console.log(JSON.stringify(listProjects(), null, 2));
  } else if (cmd === 'get') {
    console.log(JSON.stringify(getProject(process.argv[3]), null, 2));
  } else if (cmd === 'ingest') {
    const spec = JSON.parse(process.argv[3] || '{}');
    console.log(JSON.stringify(ingestProject(spec), null, 2));
  } else {
    console.log('Usage: node skydexia-ingest.mjs list|get <id>|ingest <json-spec>');
  }
}
