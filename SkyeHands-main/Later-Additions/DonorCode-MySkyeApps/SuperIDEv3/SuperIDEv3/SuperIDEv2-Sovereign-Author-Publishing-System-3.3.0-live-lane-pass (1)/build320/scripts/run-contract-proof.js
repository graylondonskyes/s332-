const { spawnSync } = require('child_process');
const { repoPath, writeJson } = require('./lib');

function runCommand(id, command, args) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, { cwd: repoPath(), encoding: 'utf8', stdio: 'pipe', timeout: 300000 });
  return { id, ok: result.status === 0, exit_code: result.status ?? 1, duration_ms: Date.now() - startedAt, stdout: result.stdout || '', stderr: result.stderr || '' };
}

const checks = [
  ['gateway_only', 'node', [repoPath('scripts','check-gateway-only.js')]],
  ['external_endpoints', 'node', [repoPath('scripts','check-external-ai-endpoints.js')]],
  ['provider_strings', 'node', [repoPath('scripts','check-provider-strings.js')]],
  ['secure_defaults', 'node', [repoPath('scripts','check-secure-defaults.js')]],
  ['protected_apps', 'node', [repoPath('scripts','check-protected-apps.js')]],
  ['skye_schema', 'node', [repoPath('scripts','check-skye-schema.js')]],
  ['publishing_packages', 'node', [repoPath('scripts','test-publishing-packages.js')]],
  ['publishing_binaries', 'node', [repoPath('scripts','test-publishing-binaries.js')]],
  ['retailer_package_emitters', 'node', [repoPath('scripts','test-retailer-package-emitters.js')]],
  ['retailer_validator', 'node', [repoPath('scripts','validate-retailer-packages.js')]],
  ['direct_sale_commerce', 'node', [repoPath('scripts','test-direct-sale-commerce.js')]],
  ['release_history', 'node', [repoPath('scripts','test-release-history.js')]],
  ['multi_title_catalog', 'node', [repoPath('scripts','test-multi-title-catalog.js')]],
  ['gateway_shape', 'node', [repoPath('scripts','test-gateway-shape-fixtures.js')]],
  ['auth_regression', 'node', [repoPath('scripts','test-auth-regressions.js')]],
  ['export_import_schema', 'node', [repoPath('scripts','test-export-import-schema.js')]],
  ['artifact_consistency', 'node', [repoPath('scripts','test-artifact-consistency.js')]],
  ['local_auth', 'node', [repoPath('scripts','test-local-auth.js')]],
  ['server_auth', 'node', [repoPath('scripts','test-server-auth.js')]],
  ['payment_gateway', 'node', [repoPath('scripts','test-payment-gateway.js')]],
  ['submission_adapters', 'node', [repoPath('scripts','test-submission-adapters.js')]],
  ['truth_boundaries', 'node', [repoPath('scripts','test-truth-boundaries.js')]],
  ['production_lanes', 'node', [repoPath('scripts','smoke-production-lanes.js')]],
  ['ui_server_bridge', 'node', [repoPath('scripts','test-ui-server-bridge.js')]],
  ['production_config', 'node', [repoPath('scripts','test-production-config.js')]],
  ['submission_contract_preview', 'node', [repoPath('scripts','test-submission-contract-preview.js')]],
  ['submission_job_routes', 'node', [repoPath('scripts','test-submission-job-routes.js')]],
  ['submission_state_persistence', 'node', [repoPath('scripts','test-submission-state-persistence.js')]],
  ['artifact_freshness', 'node', [repoPath('scripts','test-artifact-freshness.js')]],
  ['no_theater', 'node', [repoPath('scripts','check-no-theater.js')]],
  ['legacy_archives', 'node', [repoPath('scripts','check-legacy-archives.js')]],
  ['build', 'node', [repoPath('scripts','build-static.js')]],
];

const results = checks.map(([id, command, args]) => runCommand(id, command, args));
const failed = results.filter((item) => !item.ok);
writeJson(repoPath('artifacts','contract-proof.json'), { generated_at: new Date().toISOString(), ok: failed.length === 0, checks_total: results.length, checks_failed: failed.length, checks: results });
if (failed.length) process.exit(1);
