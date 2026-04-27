const { spawnSync } = require('child_process');
const { repoPath, fail, ok } = require('./lib');
const commands = [
  ['node', [repoPath('scripts','build-static.js')]],
  ['node', [repoPath('scripts','update-protected-app-manifest.js')]],
  ['node', [repoPath('scripts','emit-retailer-packages.js')]],
  ['node', [repoPath('scripts','test-publishing-packages.js')]],
  ['node', [repoPath('scripts','test-publishing-binaries.js')]],
  ['node', [repoPath('scripts','validate-retailer-packages.js')]],
  ['node', [repoPath('scripts','test-direct-sale-commerce.js')]],
  ['node', [repoPath('scripts','test-release-history.js')]],
  ['node', [repoPath('scripts','test-multi-title-catalog.js')]],
  ['node', [repoPath('scripts','test-export-import-schema.js')]],
  ['node', [repoPath('scripts','test-local-auth.js')]],
  ['node', [repoPath('scripts','test-server-auth.js')]],
  ['node', [repoPath('scripts','test-payment-gateway.js')]],
  ['node', [repoPath('scripts','test-submission-adapters.js')]],
  ['node', [repoPath('scripts','test-submission-contract-preview.js')]],
  ['node', [repoPath('scripts','test-submission-job-routes.js')]],
  ['node', [repoPath('scripts','test-submission-state-persistence.js')]],
  ['node', [repoPath('scripts','test-production-config.js')]],
  ['node', [repoPath('scripts','test-truth-boundaries.js')]],
  ['node', [repoPath('scripts','smoke-production-lanes.js')]],
  ['node', [repoPath('scripts','test-ui-server-bridge.js')]],
  ['python3', [repoPath('scripts','run-ui-smoke.py')]],
  ['node', [repoPath('scripts','check-smoke-snapshot.js')]],
  ['node', [repoPath('scripts','check-no-theater.js')]],
  ['node', [repoPath('scripts','check-gateway-only.js')]],
  ['node', [repoPath('scripts','check-external-ai-endpoints.js')]],
  ['node', [repoPath('scripts','check-provider-strings.js')]],
  ['node', [repoPath('scripts','check-secure-defaults.js')]],
  ['node', [repoPath('scripts','check-protected-apps.js')]],
  ['node', [repoPath('scripts','check-skye-schema.js')]],
  ['node', [repoPath('scripts','test-gateway-shape-fixtures.js')]],
  ['node', [repoPath('scripts','test-auth-regressions.js')]],
  ['node', [repoPath('scripts','check-legacy-archives.js')]],
  ['node', [repoPath('scripts','check-hardening-todo.js')]],
  ['node', [repoPath('scripts','run-contract-proof.js')]],
  ['node', [repoPath('scripts','run-release-checklist.js')]],
  ['node', [repoPath('scripts','generate-release-artifacts.js')]],
  ['node', [repoPath('scripts','evaluate-release-gates.js')]],
  ['node', [repoPath('scripts','test-artifact-consistency.js')]],
  ['node', [repoPath('scripts','test-artifact-freshness.js')]],
];
for (const [cmd, args] of commands) {
  const result = spawnSync(cmd, args, { cwd: repoPath(), encoding:'utf8', stdio:'pipe', timeout: 900000 });
  if (result.status !== 0) fail(`${cmd} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
}
ok('[rebuild-evidence] PASS');
