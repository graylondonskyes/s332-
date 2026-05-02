#!/usr/bin/env node
/**
 * SkyDexia Generation Engine
 * Takes a project from the ingestion pipeline, invokes AE brain capabilities
 * to generate code/content, and stores the output with provenance.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROJECTS_PATH = path.join(__dirname, 'generated-projects', 'projects-index.json');
const PROVENANCE_DIR = path.join(__dirname, 'provenance');
const OUTPUT_DIR = path.join(__dirname, 'generated-projects');

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

async function invokeBrain(brainId, prompt, dryRun = false) {
  if (dryRun || !process.env.ANTHROPIC_API_KEY) {
    return {
      brain: brainId,
      dryRun: true,
      output: `[DRY RUN] Brain '${brainId}' would process: ${prompt.slice(0, 80)}...`,
      model: 'dry-run',
      tokens: 0,
    };
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Brain '${brainId}' API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return {
    brain: brainId,
    dryRun: false,
    output: data.content?.[0]?.text || '',
    model: data.model,
    tokens: data.usage?.output_tokens || 0,
  };
}

export async function generateProject(projectId, options = {}) {
  const projects = readJson(PROJECTS_PATH, []);
  const project = projects.find(p => p.id === projectId);
  if (!project) throw new Error(`Project '${projectId}' not found`);
  if (!['ingested', 'generation_failed'].includes(project.status)) {
    throw new Error(`Project '${projectId}' is in status '${project.status}' — cannot regenerate`);
  }

  const now = new Date().toISOString();
  const generationId = crypto.randomBytes(6).toString('hex');
  const dryRun = options.dryRun !== false && !process.env.ANTHROPIC_API_KEY;

  updateProjectStatus(projectId, 'generating', { generatingAt: now, generationId });

  const generationResults = [];
  const errors = [];

  for (const cap of project.capabilities) {
    const prompt = [
      `You are the SkyeHands AE Brain for lane '${cap.lane}'.`,
      `Generate implementation for capability: ${cap.id}`,
      `Project: ${project.name}`,
      `Description: ${project.description}`,
      `Entrypoint target: ${cap.entrypoint || 'auto'}`,
      `Requirements: ${(cap.requires || []).join(', ') || 'none'}`,
      `Produce complete, production-ready code for this capability.`,
    ].join('\n');

    try {
      const result = await invokeBrain(cap.lane, prompt, dryRun);
      const outputFile = path.join(OUTPUT_DIR, projectId, `${cap.id}.output.json`);
      writeJson(outputFile, { capabilityId: cap.id, ...result, generatedAt: now });
      generationResults.push({ capabilityId: cap.id, ok: true, dryRun: result.dryRun, outputFile: path.relative(path.join(__dirname, '..'), outputFile) });
    } catch (err) {
      errors.push({ capabilityId: cap.id, error: err.message });
    }
  }

  const finalStatus = errors.length > 0 && generationResults.length === 0 ? 'generation_failed' : 'generated';
  const updatedProject = updateProjectStatus(projectId, finalStatus, {
    generatedAt: now,
    generationId,
    generationSummary: { total: project.capabilities.length, succeeded: generationResults.length, failed: errors.length },
  });

  // Write provenance
  const provenanceRecord = {
    projectId,
    generationId,
    action: 'generated',
    dryRun,
    results: generationResults,
    errors,
    at: now,
    hash: crypto.createHash('sha256').update(JSON.stringify({ projectId, generationId, results: generationResults })).digest('hex'),
  };
  writeJson(path.join(PROVENANCE_DIR, `${projectId}-generate-${generationId}.json`), provenanceRecord);

  return { ok: errors.length === 0, projectId, generationId, dryRun, results: generationResults, errors, provenanceHash: provenanceRecord.hash };
}

// CLI interface
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const projectId = process.argv[2];
  if (!projectId) { console.error('Usage: node skydexia-generate.mjs <projectId> [--dry-run]'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  generateProject(projectId, { dryRun })
    .then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(err => { console.error(err.message); process.exit(1); });
}
