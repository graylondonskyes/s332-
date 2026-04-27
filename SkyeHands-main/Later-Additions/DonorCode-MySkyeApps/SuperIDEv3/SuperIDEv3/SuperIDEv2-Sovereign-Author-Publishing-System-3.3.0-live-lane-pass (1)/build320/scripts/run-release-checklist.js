const { spawnSync } = require('child_process');
const { repoPath, writeJson } = require('./lib');

function runCommand(id, command, args, meta) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, { cwd: repoPath(), encoding: 'utf8', stdio: 'pipe', timeout: 300000 });
  return { ...meta, id, ok: result.status === 0, exit_code: result.status ?? 1, duration_ms: Date.now() - startedAt, stdout: result.stdout || '', stderr: result.stderr || '' };
}

const checks = [
  { id:'gateway_only', blocking:true, area:'security', contract:'gateway-only mode remains hard closed', command:'node', args:[repoPath('scripts','check-gateway-only.js')] },
  { id:'external_endpoints', blocking:true, area:'security', contract:'no external AI endpoints leak into shell', command:'node', args:[repoPath('scripts','check-external-ai-endpoints.js')] },
  { id:'provider_strings', blocking:true, area:'security', contract:'provider strings remain normalized', command:'node', args:[repoPath('scripts','check-provider-strings.js')] },
  { id:'secure_defaults', blocking:true, area:'security', contract:'secure defaults stay closed by default', command:'node', args:[repoPath('scripts','check-secure-defaults.js')] },
  { id:'protected_apps', blocking:true, area:'security', contract:'protected app manifest remains intact', command:'node', args:[repoPath('scripts','check-protected-apps.js')] },
  { id:'skye_schema', blocking:true, area:'data_integrity', contract:'skye schemas remain namespaced', command:'node', args:[repoPath('scripts','check-skye-schema.js')] },
  { id:'publishing_packages', blocking:true, area:'product_integrity', contract:'publishing package emitters stay executable', command:'node', args:[repoPath('scripts','test-publishing-packages.js')] },
  { id:'publishing_binaries', blocking:true, area:'product_integrity', contract:'binary publishing writers emit docx and pdf evidence', command:'node', args:[repoPath('scripts','test-publishing-binaries.js')] },
  { id:'retailer_package_emitters', blocking:true, area:'product_integrity', contract:'retailer package emitters create channel zips', command:'node', args:[repoPath('scripts','test-retailer-package-emitters.js')] },
  { id:'retailer_validator', blocking:true, area:'product_integrity', contract:'retailer package receipts validate required files', command:'node', args:[repoPath('scripts','validate-retailer-packages.js')] },
  { id:'direct_sale_commerce', blocking:true, area:'product_integrity', contract:'direct-sale checkout, ledger integrity, entitlement grant, and library persistence', command:'node', args:[repoPath('scripts','test-direct-sale-commerce.js')] },
  { id:'release_history', blocking:true, area:'product_integrity', contract:'release-history storage and operator analytics persistence', command:'node', args:[repoPath('scripts','test-release-history.js')] },
  { id:'multi_title_catalog', blocking:true, area:'product_integrity', contract:'multi-title catalog switching and snapshot persistence', command:'node', args:[repoPath('scripts','test-multi-title-catalog.js')] },
  { id:'server_auth', blocking:true, area:'product_integrity', contract:'server-backed auth tokens issue and verify against configured secrets', command:'node', args:[repoPath('scripts','test-server-auth.js')] },
  { id:'payment_gateway', blocking:true, area:'product_integrity', contract:'payment gateways create checkout sessions and verify webhook signatures', command:'node', args:[repoPath('scripts','test-payment-gateway.js')] },
  { id:'submission_adapters', blocking:true, area:'product_integrity', contract:'submission adapters sign and deliver package payloads to channel endpoints', command:'node', args:[repoPath('scripts','test-submission-adapters.js')] },
  { id:'submission_contract_preview', blocking:true, area:'product_integrity', contract:'submission workflow previews remain executable and channel-specific', command:'node', args:[repoPath('scripts','test-submission-contract-preview.js')] },
  { id:'submission_job_routes', blocking:true, area:'product_integrity', contract:'submission job routing persists create dispatch sync cancel receipts', command:'node', args:[repoPath('scripts','test-submission-job-routes.js')] },
  { id:'submission_state_persistence', blocking:true, area:'product_integrity', contract:'submission runtime state persists job and receipt history', command:'node', args:[repoPath('scripts','test-submission-state-persistence.js')] },
  { id:'production_config', blocking:true, area:'security', contract:'production mode rejects invalid payment and auth secrets', command:'node', args:[repoPath('scripts','test-production-config.js')] },
  { id:'gateway_shape', blocking:true, area:'data_integrity', contract:'gateway shape fixtures remain stable', command:'node', args:[repoPath('scripts','test-gateway-shape-fixtures.js')] },
  { id:'auth_regression', blocking:true, area:'reliability', contract:'auth boundary still rejects invalid sessions', command:'node', args:[repoPath('scripts','test-auth-regressions.js')] },
  { id:'export_import_schema', blocking:true, area:'data_integrity', contract:'signed export/import schema roundtrips and rejects tamper', command:'node', args:[repoPath('scripts','test-export-import-schema.js')] },
  { id:'artifact_consistency', blocking:true, area:'executive_readiness', contract:'package version and directive surfaces stay aligned', command:'node', args:[repoPath('scripts','test-artifact-consistency.js')] },
  { id:'local_auth', blocking:true, area:'security', contract:'browser fallback signed operator receipts reject tamper and expiry', command:'node', args:[repoPath('scripts','test-local-auth.js')] },
  { id:'truth_boundaries', blocking:true, area:'executive_readiness', contract:'auth, payments, and submission lanes report deployable capability states', command:'node', args:[repoPath('scripts','test-truth-boundaries.js')] },
  { id:'production_lanes', blocking:true, area:'reliability', contract:'server-backed auth, payment, and submission lanes survive end-to-end smoke', command:'node', args:[repoPath('scripts','smoke-production-lanes.js')] },
  { id:'ui_server_bridge', blocking:true, area:'reliability', contract:'browser shell bridges successfully into server-backed auth and payment lanes', command:'node', args:[repoPath('scripts','test-ui-server-bridge.js')] },
  { id:'artifact_freshness', blocking:true, area:'executive_readiness', contract:'release evidence carries current provider, version, and path data only', command:'node', args:[repoPath('scripts','test-artifact-freshness.js')] },
  { id:'no_theater', blocking:true, area:'executive_readiness', contract:'current release surfaces avoid the old local-only posture', command:'node', args:[repoPath('scripts','check-no-theater.js')] },
  { id:'legacy_archives', blocking:true, area:'security', contract:'legacy archives normalized and excluded', command:'node', args:[repoPath('scripts','check-legacy-archives.js')] },
  { id:'build', blocking:true, area:'reliability', contract:'static build emits dist manifest', command:'node', args:[repoPath('scripts','build-static.js')] },
  { id:'ui_smoke', blocking:true, area:'reliability', contract:'browser smoke proves live surface, export verify, import restore, checkout, catalog, and history', command:'node', args:[repoPath('scripts','run-ui-smoke.js')] },
  { id:'smoke_snapshot', blocking:true, area:'reliability', contract:'smoke summary contains verified evidence markers', command:'node', args:[repoPath('scripts','check-smoke-snapshot.js')] },
  { id:'hardening_todo', blocking:true, area:'security', contract:'hardening TODO stays explicit', command:'node', args:[repoPath('scripts','check-hardening-todo.js')] },
];

const results = checks.map((item) => runCommand(item.id, item.command, item.args, item));
const blockingFailures = results.filter((item) => item.blocking && !item.ok);
writeJson(repoPath('artifacts','release-checklist.json'), { generated_at: new Date().toISOString(), blocking_failures: blockingFailures.length, ok: blockingFailures.length === 0, checks: results });
if (blockingFailures.length) process.exit(1);
