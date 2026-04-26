import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { createAiPatchProposal, applyAiPatchProposal, getAiPatchProposal, rejectAiPatchProposal, rollbackAiPatchProposal } from '../lib/ai-patch-manager.mjs';
import { createWorkspace, getWorkspace, startWorkspace } from '../lib/workspace-manager.mjs';
import { getWorkspaceSandboxPaths } from '../lib/workspace-runtime.mjs';

function assertCheck(pass, message, detail = null) {
  return { pass: Boolean(pass), message, detail };
}

async function main() {
  const strict = process.argv.includes('--strict');
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section22-ai-patch.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_22_AI_PATCH_REVIEW_ROLLBACK.json');

  const workspaceId = 'section22-ai-patch';
  createWorkspace(config, workspaceId, { name: 'Section 22 AI Patch', source: 'section22-proof', force: true });
  await startWorkspace(config, workspaceId, 'section22-proof-start');
  const workspace = getWorkspace(config, workspaceId);
  const paths = getWorkspaceSandboxPaths(config, workspace.id);
  const rootDir = fs.existsSync(path.join(paths.fsDir, 'project')) ? path.join(paths.fsDir, 'project') : paths.fsDir;
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  const appPath = path.join(rootDir, 'src', 'app.js');
  fs.writeFileSync(appPath, 'export const greeting = "hello";\nconsole.log(greeting);\n', 'utf8');

  const created = createAiPatchProposal(config, {
    workspaceId,
    title: 'Section 22 AI patch',
    summary: 'Update greeting and add exported status.',
    requestedBy: 'section22-proof',
    operations: [
      { op: 'replace', path: 'src/app.js', find: 'hello', replace: 'hello from AI patch', required: true },
      { op: 'append', path: 'src/app.js', content: 'export const patchStatus = "reviewed";' }
    ]
  });

  const proposed = getAiPatchProposal(config, created.proposal.proposalId);
  const applyResult = await applyAiPatchProposal(config, proposed.proposalId, { actorId: 'section22-approver', note: 'apply for proof' });
  const appliedContent = fs.readFileSync(appPath, 'utf8');
  const rollbackResult = await rollbackAiPatchProposal(config, proposed.proposalId, { actorId: 'section22-rollback', note: 'rollback for proof' });
  const rolledBackContent = fs.readFileSync(appPath, 'utf8');

  const rejectedSeed = createAiPatchProposal(config, {
    workspaceId,
    title: 'Section 22 rejected patch',
    summary: 'Proposal for rejection flow.',
    requestedBy: 'section22-proof',
    operations: [{ op: 'write', path: 'src/rejected.js', content: 'export const rejected = true;\n' }]
  });
  const rejectResult = rejectAiPatchProposal(config, rejectedSeed.proposal.proposalId, { actorId: 'section22-reviewer', note: 'rejected for proof' });

  const checks = [
    assertCheck(Array.isArray(proposed.preview) && proposed.preview.length === 2 && String(proposed.diffSummary || '').includes('replace:src/app.js:changed'), 'AI patch proposal builds preview and diff summary before apply', proposed),
    assertCheck(applyResult.proposal.status === 'applied' && Boolean(applyResult.proposal.snapshotId), 'AI patch apply creates a review decision and snapshot baseline before writing files', applyResult.proposal),
    assertCheck(appliedContent.includes('hello from AI patch') && appliedContent.includes('patchStatus'), 'AI patch apply mutates workspace files under proposal control', appliedContent),
    assertCheck(rollbackResult.proposal.status === 'rolled_back' && !rolledBackContent.includes('patchStatus') && rolledBackContent.includes('"hello";'), 'AI patch rollback restores the pre-apply snapshot state', { proposal: rollbackResult.proposal, rolledBackContent }),
    assertCheck(rejectResult.proposal.status === 'rejected' && !fs.existsSync(path.join(rootDir, 'src', 'rejected.js')), 'AI patch rejection preserves a reviewable proposal without mutating the workspace', rejectResult.proposal)
  ];

  let payload = {
    section: 22,
    label: 'section-22-ai-patch-review-rollback',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section22-ai-patch.mjs --strict',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      proposal: proposed,
      applyResult: applyResult.proposal,
      rollbackResult: rollbackResult.proposal,
      rejectResult: rejectResult.proposal,
      appliedContent,
      rolledBackContent
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section22-ai-patch.mjs');
  if (strict && !payload.pass) throw new Error('Section 22 AI patch review/rollback proof failed in strict mode.');
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
