import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { createWorkspace, deleteWorkspace, getWorkspace, startWorkspace } from '../lib/workspace-manager.mjs';
import { getWorkspaceSandboxPaths } from '../lib/workspace-runtime.mjs';
import { createAiPatchProposal, inspectAiPatchContext } from '../lib/ai-patch-manager.mjs';

function assertCheck(pass, message, detail = null) { return { pass: Boolean(pass), message, detail }; }

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig();
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section27-ai-bounded-context.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_27_AI_BOUNDED_CONTEXT.json');
  const workspaceId = 'section27-ai-context';

  if (getWorkspace(config, workspaceId)) {
    await deleteWorkspace(config, workspaceId, { deletedBy: 'section27-proof-reset' });
  }
  createWorkspace(config, workspaceId, { name: 'Section 27 AI Context', source: 'section27-proof', force: true });
  await startWorkspace(config, workspaceId, 'section27-proof-start');
  const paths = getWorkspaceSandboxPaths(config, workspaceId);
  const projectDir = fs.existsSync(path.join(paths.fsDir, 'project')) ? path.join(paths.fsDir, 'project') : paths.fsDir;
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'src', 'runtime.js'), 'export const runtimeHealth = () => ({ ok: true, mode: "local" });\n', 'utf8');
  fs.writeFileSync(path.join(projectDir, 'README.md'), '# AI context lane\nThis workspace proves bounded inspection for runtime patches.\n', 'utf8');
  fs.writeFileSync(path.join(projectDir, 'config.json'), JSON.stringify({ runtime: { mode: 'local', bridge: true } }, null, 2), 'utf8');
  fs.writeFileSync(path.join(projectDir, 'src', 'runtime.js'), 'export const runtimeHealth = () => ({ ok: false, mode: "local" });\n', 'utf8');

  const inspected = inspectAiPatchContext(config, workspaceId, {
    query: 'runtime',
    requestedPaths: ['README.md', 'src/runtime.js'],
    includeChanged: true,
    maxFiles: 6,
    maxChars: 1200,
    note: 'section27 proof'
  });

  const proposal = createAiPatchProposal(config, {
    workspaceId,
    title: 'Section 27 AI bounded context proposal',
    summary: 'Prove proposal stores bounded context.',
    requestedBy: 'section27-proof',
    context: {
      query: 'runtime',
      requestedPaths: ['README.md', 'src/runtime.js'],
      includeChanged: true,
      maxFiles: 6,
      maxChars: 1200,
      note: 'section27 proposal context'
    },
    operations: [
      {
        op: 'replace',
        path: 'src/runtime.js',
        find: 'ok: false',
        replace: 'ok: true'
      }
    ]
  });

  const checks = [
    assertCheck(inspected.context.summary?.bounded === true, 'AI patch context inspection is explicitly bounded instead of unscoped repo ingestion', inspected.context.summary),
    assertCheck((inspected.context.files || []).some(item => item.path === 'src/runtime.js'), 'requested context paths are materialized in the inspection payload', inspected.context.files),
    assertCheck((inspected.context.changedFiles || []).some(item => item.path === 'src/runtime.js'), 'changed-file awareness can be folded into the bounded context lane', inspected.context.changedFiles),
    assertCheck((proposal.proposal.context?.summary?.fileCount || 0) >= 2, 'AI patch proposals persist the bounded context summary alongside operations', proposal.proposal.context),
    assertCheck((proposal.proposal.preview || []).length === 1 && String(proposal.proposal.preview?.[0]?.diff || '').includes('ok: true'), 'proposal preview still shows the patch diff while context is attached', proposal.proposal.preview)
  ];

  let payload = {
    section: 27,
    label: 'section-27-ai-bounded-context',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section27-ai-bounded-context.mjs --strict',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      inspectedContext: inspected.context,
      proposal: proposal.proposal
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section27-ai-bounded-context.mjs');
  if (strict && !payload.pass) throw new Error('Section 27 AI bounded context proof failed in strict mode.');
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
