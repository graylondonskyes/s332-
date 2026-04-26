import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import {
  applyAiPatchProposal,
  createAiPatchProposal,
  getAiPatchProposal,
  getAiPatchStatus,
  rejectAiPatchProposal,
  rollbackAiPatchProposal,
  inspectAiPatchContext
} from '../lib/ai-patch-manager.mjs';

function parseArgs(argv) {
  const [command = 'list', ...rest] = argv;
  const options = {
    command,
    proposalId: null,
    workspaceId: 'local-default',
    title: null,
    summary: null,
    specPath: null,
    actorId: 'ai-patch-cli',
    note: null,
    query: null,
    contextPaths: [],
    includeChanged: false,
    contextMaxFiles: 8,
    contextMaxChars: 4000,
    contextNote: null
  };
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === '--workspace') { options.workspaceId = rest[index + 1] || options.workspaceId; index += 1; continue; }
    if (value === '--title') { options.title = rest[index + 1] || null; index += 1; continue; }
    if (value === '--summary') { options.summary = rest[index + 1] || null; index += 1; continue; }
    if (value === '--spec') { options.specPath = rest[index + 1] || null; index += 1; continue; }
    if (value === '--actor') { options.actorId = rest[index + 1] || options.actorId; index += 1; continue; }
    if (value === '--note') { options.note = rest[index + 1] || null; index += 1; continue; }
    if (value === '--query') { options.query = rest[index + 1] || null; index += 1; continue; }
    if (value === '--context-path') { options.contextPaths.push(rest[index + 1] || ''); index += 1; continue; }
    if (value === '--include-changed') { options.includeChanged = true; continue; }
    if (value === '--context-max-files') { options.contextMaxFiles = Number.parseInt(String(rest[index + 1] || '8'), 10) || 8; index += 1; continue; }
    if (value === '--context-max-chars') { options.contextMaxChars = Number.parseInt(String(rest[index + 1] || '4000'), 10) || 4000; index += 1; continue; }
    if (value === '--context-note') { options.contextNote = rest[index + 1] || null; index += 1; continue; }
    if (!options.proposalId) options.proposalId = value;
  }
  return options;
}

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function loadSpec(specPath) {
  if (!specPath) throw new Error('Use --spec <file.json> to provide AI patch operations.');
  const absolutePath = path.resolve(specPath);
  if (!fs.existsSync(absolutePath)) throw new Error(`Patch spec file not found: ${absolutePath}`);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

async function main() {
  const config = getStackConfig();
  ensureRuntimeState(config, process.env);
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'list') {
    printJson({ ok: true, action: 'list', ...getAiPatchStatus(config, args.workspaceId || null) });
    return;
  }
  if (args.command === 'show') {
    if (!args.proposalId) throw new Error('Proposal id is required for show.');
    printJson({ ok: true, action: 'show', proposal: getAiPatchProposal(config, args.proposalId) });
    return;
  }
  if (args.command === 'context') {
    printJson({ ok: true, action: 'context', ...inspectAiPatchContext(config, args.workspaceId, {
      query: args.query,
      requestedPaths: args.contextPaths,
      includeChanged: args.includeChanged,
      maxFiles: args.contextMaxFiles,
      maxChars: args.contextMaxChars,
      note: args.contextNote
    }) });
    return;
  }
  if (args.command === 'propose') {
    const spec = loadSpec(args.specPath);
    printJson({ ok: true, action: 'propose', ...createAiPatchProposal(config, {
      workspaceId: args.workspaceId,
      title: args.title || spec.title,
      summary: args.summary || spec.summary,
      operations: spec.operations,
      requestedBy: args.actorId,
      context: {
        ...(spec.context || {}),
        query: args.query || spec.context?.query || null,
        requestedPaths: args.contextPaths.length ? args.contextPaths : (spec.context?.requestedPaths || []),
        includeChanged: args.includeChanged || Boolean(spec.context?.includeChanged),
        maxFiles: args.contextMaxFiles || spec.context?.maxFiles || 8,
        maxChars: args.contextMaxChars || spec.context?.maxChars || 4000,
        note: args.contextNote || spec.context?.note || null
      }
    })});
    return;
  }
  if (args.command === 'apply') {
    if (!args.proposalId) throw new Error('Proposal id is required for apply.');
    printJson({ ok: true, action: 'apply', ...(await applyAiPatchProposal(config, args.proposalId, { actorId: args.actorId, note: args.note })) });
    return;
  }
  if (args.command === 'reject') {
    if (!args.proposalId) throw new Error('Proposal id is required for reject.');
    printJson({ ok: true, action: 'reject', ...rejectAiPatchProposal(config, args.proposalId, { actorId: args.actorId, note: args.note }) });
    return;
  }
  if (args.command === 'rollback') {
    if (!args.proposalId) throw new Error('Proposal id is required for rollback.');
    printJson({ ok: true, action: 'rollback', ...(await rollbackAiPatchProposal(config, args.proposalId, { actorId: args.actorId, note: args.note })) });
    return;
  }
  throw new Error(`Unknown ai-patch command '${args.command}'. Supported commands: list, show, context, propose, apply, reject, rollback.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
