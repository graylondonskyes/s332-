#!/usr/bin/env node
/**
 * SkyDexia Export & Shipment API
 * Packages generated project output into a deliverable archive,
 * records shipment provenance, and tracks export history.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROJECTS_PATH = path.join(__dirname, 'generated-projects', 'projects-index.json');
const PROVENANCE_DIR = path.join(__dirname, 'provenance');
const OUTPUT_DIR = path.join(__dirname, 'generated-projects');
const EXPORTS_DIR = path.join(__dirname, 'generated-projects', 'exports');
const SHIPMENT_LOG_PATH = path.join(__dirname, 'provenance', 'shipment-log.json');

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function updateProjectStatus(projectId, status, extra = {}) {
  const projects = readJson(PROJECTS_PATH, []);
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx < 0) throw new Error(`Project '${projectId}' not found`);
  projects[idx] = { ...projects[idx], status, ...extra };
  writeJson(PROJECTS_PATH, projects);
  return projects[idx];
}

function collectGeneratedFiles(projectId) {
  const projectOutputDir = path.join(OUTPUT_DIR, projectId);
  if (!fs.existsSync(projectOutputDir)) return [];
  return fs.readdirSync(projectOutputDir)
    .filter(f => f.endsWith('.output.json'))
    .map(f => {
      const fullPath = path.join(projectOutputDir, f);
      const data = readJson(fullPath, {});
      return { file: f, capabilityId: data.capabilityId, dryRun: data.dryRun, outputLength: (data.output || '').length };
    });
}

export function exportProject(projectId, options = {}) {
  const projects = readJson(PROJECTS_PATH, []);
  const project = projects.find(p => p.id === projectId);
  if (!project) throw new Error(`Project '${projectId}' not found`);
  if (!['generated', 'exported'].includes(project.status)) {
    throw new Error(`Project '${projectId}' status is '${project.status}' — must be 'generated' before export`);
  }

  const now = new Date().toISOString();
  const exportId = crypto.randomBytes(6).toString('hex');

  // Collect all generated output files
  const generatedFiles = collectGeneratedFiles(projectId);
  if (generatedFiles.length === 0) throw new Error(`No generated output files found for project '${projectId}'`);

  // Build export manifest
  const manifest = {
    exportId,
    projectId,
    projectName: project.name,
    exportedAt: now,
    capabilities: generatedFiles.map(f => f.capabilityId),
    fileCount: generatedFiles.length,
    dryRun: generatedFiles.every(f => f.dryRun),
    destination: options.destination || 'local',
    recipient: options.recipient || null,
  };

  // Write export package (manifest + all output files bundled as a JSON package)
  const exportPackage = {
    manifest,
    project,
    outputs: generatedFiles.map(f => {
      const fullPath = path.join(OUTPUT_DIR, projectId, f.file);
      return readJson(fullPath, {});
    }),
  };
  const exportPath = path.join(EXPORTS_DIR, `${projectId}-export-${exportId}.json`);
  writeJson(exportPath, exportPackage);

  // Update shipment log
  const shipmentLog = readJson(SHIPMENT_LOG_PATH, []);
  const shipmentEntry = {
    exportId,
    projectId,
    projectName: project.name,
    at: now,
    fileCount: generatedFiles.length,
    destination: manifest.destination,
    recipient: manifest.recipient,
    exportPath: path.relative(path.join(__dirname, '..'), exportPath),
  };
  shipmentLog.push(shipmentEntry);
  writeJson(SHIPMENT_LOG_PATH, shipmentLog);

  // Write provenance
  const provenanceHash = crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  writeJson(path.join(PROVENANCE_DIR, `${projectId}-export-${exportId}.json`), {
    exportId, projectId, action: 'exported', manifest, at: now, hash: provenanceHash,
  });

  updateProjectStatus(projectId, 'exported', { exportedAt: now, lastExportId: exportId });

  return {
    ok: true,
    exportId,
    projectId,
    exportPath: path.relative(path.join(__dirname, '..'), exportPath),
    manifest,
    fileCount: generatedFiles.length,
    provenanceHash,
  };
}

export function listShipments(filter = {}) {
  const log = readJson(SHIPMENT_LOG_PATH, []);
  let results = log;
  if (filter.projectId) results = results.filter(e => e.projectId === filter.projectId);
  if (filter.destination) results = results.filter(e => e.destination === filter.destination);
  return { ok: true, count: results.length, shipments: results.slice().reverse() };
}

export function getExportPackage(exportId) {
  const log = readJson(SHIPMENT_LOG_PATH, []);
  const entry = log.find(e => e.exportId === exportId);
  if (!entry) throw new Error(`Export '${exportId}' not found in shipment log`);
  const exportPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', entry.exportPath);
  const pkg = readJson(exportPath, null);
  if (!pkg) throw new Error(`Export package file missing for export '${exportId}'`);
  return { ok: true, exportId, package: pkg };
}

// CLI interface
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === 'export') {
    const projectId = process.argv[3];
    if (!projectId) { console.error('Usage: node skydexia-export.mjs export <projectId>'); process.exit(1); }
    try { console.log(JSON.stringify(exportProject(projectId), null, 2)); } catch (e) { console.error(e.message); process.exit(1); }
  } else if (cmd === 'list') {
    console.log(JSON.stringify(listShipments(), null, 2));
  } else if (cmd === 'get') {
    const exportId = process.argv[3];
    try { console.log(JSON.stringify(getExportPackage(exportId), null, 2)); } catch (e) { console.error(e.message); process.exit(1); }
  } else {
    console.log('Usage: node skydexia-export.mjs export <projectId>|list|get <exportId>');
  }
}
