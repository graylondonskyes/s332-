import subprocess, time, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

def run(cmd, timeout=300):
    started = time.time()
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return {
        'ok': p.returncode == 0,
        'exit_code': p.returncode,
        'duration_ms': int((time.time()-started)*1000),
        'stdout': p.stdout,
        'stderr': p.stderr,
    }

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')

def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))

contract_checks = [
('gateway_only',['node','scripts/check-gateway-only.js']),
('external_endpoints',['node','scripts/check-external-ai-endpoints.js']),
('provider_strings',['node','scripts/check-provider-strings.js']),
('secure_defaults',['node','scripts/check-secure-defaults.js']),
('protected_apps',['node','scripts/check-protected-apps.js']),
('skye_schema',['node','scripts/check-skye-schema.js']),
('publishing_packages',['node','scripts/test-publishing-packages.js']),
('publishing_binaries',['node','scripts/test-publishing-binaries.js']),
('retailer_package_emitters',['node','scripts/test-retailer-package-emitters.js']),
('retailer_validator',['node','scripts/validate-retailer-packages.js']),
('direct_sale_commerce',['node','scripts/test-direct-sale-commerce.js']),
('release_history',['node','scripts/test-release-history.js']),
('multi_title_catalog',['node','scripts/test-multi-title-catalog.js']),
('gateway_shape',['node','scripts/test-gateway-shape-fixtures.js']),
('auth_regression',['node','scripts/test-auth-regressions.js']),
('export_import_schema',['node','scripts/test-export-import-schema.js']),
('artifact_consistency',['node','scripts/test-artifact-consistency.js']),
('artifact_freshness',['node','scripts/test-artifact-freshness.js']),
('local_auth',['node','scripts/test-local-auth.js']),
('server_auth',['node','scripts/test-server-auth.js']),
('payment_gateway',['node','scripts/test-payment-gateway.js']),
('submission_adapters',['node','scripts/test-submission-adapters.js']),
('submission_contract_preview',['node','scripts/test-submission-contract-preview.js']),
('submission_job_routes',['node','scripts/test-submission-job-routes.js']),
('submission_state_persistence',['node','scripts/test-submission-state-persistence.js']),
('production_config',['node','scripts/test-production-config.js']),
('truth_boundaries',['node','scripts/test-truth-boundaries.js']),
('production_lanes',['node','scripts/smoke-production-lanes.js']),
('ui_server_bridge',['node','scripts/test-ui-server-bridge.js']),
('no_theater',['node','scripts/check-no-theater.js']),
('legacy_archives',['node','scripts/check-legacy-archives.js']),
('build',['node','scripts/build-static.js']),
]
contract_results=[]
for cid, cmd in contract_checks:
    r = run(cmd, timeout=300)
    contract_results.append({'id':cid, **r})
    if not r['ok']:
        break
write_json(ROOT/'artifacts/contract-proof.json', {
    'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'ok': all(r['ok'] for r in contract_results),
    'checks_total': len(contract_results),
    'checks_failed': sum(1 for r in contract_results if not r['ok']),
    'checks': contract_results,
})

checklist_defs = [
('gateway_only',True,'security','gateway-only mode remains hard closed',['node','scripts/check-gateway-only.js'],60),
('external_endpoints',True,'security','no external AI endpoints leak into shell',['node','scripts/check-external-ai-endpoints.js'],60),
('provider_strings',True,'security','provider strings remain normalized',['node','scripts/check-provider-strings.js'],60),
('secure_defaults',True,'security','secure defaults stay closed by default',['node','scripts/check-secure-defaults.js'],60),
('protected_apps',True,'security','protected app manifest remains intact',['node','scripts/check-protected-apps.js'],60),
('skye_schema',True,'data_integrity','skye schemas remain namespaced',['node','scripts/check-skye-schema.js'],60),
('publishing_packages',True,'product_integrity','publishing package emitters stay executable',['node','scripts/test-publishing-packages.js'],60),
('publishing_binaries',True,'product_integrity','binary publishing writers emit docx and pdf evidence',['node','scripts/test-publishing-binaries.js'],120),
('retailer_package_emitters',True,'product_integrity','retailer package emitters create channel zips',['node','scripts/test-retailer-package-emitters.js'],120),
('retailer_validator',True,'product_integrity','retailer package receipts validate required files',['node','scripts/validate-retailer-packages.js'],120),
('direct_sale_commerce',True,'product_integrity','direct-sale checkout, ledger integrity, entitlement grant, and library persistence',['node','scripts/test-direct-sale-commerce.js'],60),
('release_history',True,'product_integrity','release-history storage and operator analytics persistence',['node','scripts/test-release-history.js'],60),
('multi_title_catalog',True,'product_integrity','multi-title catalog switching and snapshot persistence',['node','scripts/test-multi-title-catalog.js'],60),
('server_auth',True,'product_integrity','server-backed auth tokens issue and verify against configured secrets',['node','scripts/test-server-auth.js'],60),
('payment_gateway',True,'product_integrity','payment gateways create checkout sessions and verify webhook signatures',['node','scripts/test-payment-gateway.js'],60),
('submission_adapters',True,'product_integrity','submission adapters sign and deliver vendor portal workflow payloads to channel endpoints',['node','scripts/test-submission-adapters.js'],120),
('submission_contract_preview',True,'product_integrity','submission workflow previews remain executable and channel-specific',['node','scripts/test-submission-contract-preview.js'],60),
('submission_job_routes',True,'product_integrity','submission job routing persists create dispatch sync cancel receipts',['node','scripts/test-submission-job-routes.js'],120),
('submission_state_persistence',True,'product_integrity','submission runtime state persists job and receipt history',['node','scripts/test-submission-state-persistence.js'],60),
('gateway_shape',True,'data_integrity','gateway shape fixtures remain stable',['node','scripts/test-gateway-shape-fixtures.js'],60),
('auth_regression',True,'reliability','auth boundary still rejects invalid sessions',['node','scripts/test-auth-regressions.js'],60),
('export_import_schema',True,'data_integrity','signed export/import schema roundtrips and rejects tamper',['node','scripts/test-export-import-schema.js'],60),
('artifact_consistency',True,'executive_readiness','package version and directive surfaces stay aligned',['node','scripts/test-artifact-consistency.js'],60),
('artifact_freshness',True,'executive_readiness','release evidence carries current provider, version, and path data only',['node','scripts/test-artifact-freshness.js'],60),
('local_auth',True,'security','browser fallback signed operator receipts reject tamper and expiry',['node','scripts/test-local-auth.js'],60),
('production_config',True,'security','production mode rejects invalid payment and auth secrets',['node','scripts/test-production-config.js'],60),
('truth_boundaries',True,'executive_readiness','auth, payments, and submission lanes report deployable capability states',['node','scripts/test-truth-boundaries.js'],60),
('production_lanes',True,'reliability','server-backed auth, payment, and submission lanes survive end-to-end smoke',['node','scripts/smoke-production-lanes.js'],120),
('ui_server_bridge',True,'reliability','browser shell bridges successfully into server-backed auth and payment lanes',['node','scripts/test-ui-server-bridge.js'],120),
('no_theater',True,'executive_readiness','current release surfaces avoid stale overstatement and stale local-only language',['node','scripts/check-no-theater.js'],60),
('legacy_archives',True,'security','legacy archives normalized and excluded',['node','scripts/check-legacy-archives.js'],60),
('build',True,'reliability','static build emits dist manifest',['node','scripts/build-static.js'],60),
('ui_smoke',True,'reliability','browser smoke proves live surface, export verify, import restore, checkout, catalog, and history',['python3','scripts/run-ui-smoke.py'],180),
('smoke_snapshot',True,'reliability','smoke summary contains verified evidence markers',['node','scripts/check-smoke-snapshot.js'],60),
('hardening_todo',True,'security','hardening TODO stays explicit',['node','scripts/check-hardening-todo.js'],60),
]
check_results=[]
for cid, blocking, area, contract, cmd, tout in checklist_defs:
    r = run(cmd, timeout=tout)
    check_results.append({'id':cid,'blocking':blocking,'area':area,'contract':contract, **r})
    if blocking and not r['ok']:
        break
write_json(ROOT/'artifacts/release-checklist.json', {
    'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'blocking_failures': sum(1 for r in check_results if r['blocking'] and not r['ok']),
    'ok': all((not r['blocking']) or r['ok'] for r in check_results),
    'checks': check_results,
})

# compose release artifacts from current manifests
checklist = read_json(ROOT/'artifacts/release-checklist.json')
smoke = read_json(ROOT/'artifacts/ui-smoke/ui-smoke-summary.json')
binary_manifest = read_json(ROOT/'artifacts/publishing-binaries/manifest.json')
retailer_manifest = read_json(ROOT/'artifacts/retailer-packages/manifest.json')
commerce_manifest = read_json(ROOT/'artifacts/direct-sale-commerce/manifest.json')
history_manifest = read_json(ROOT/'artifacts/release-history/manifest.json')
catalog_manifest = read_json(ROOT/'artifacts/catalog-state/manifest.json')
local_auth_manifest = read_json(ROOT/'artifacts/local-auth/manifest.json')
truth_manifest = read_json(ROOT/'artifacts/truth-boundaries/manifest.json')
production_manifest = read_json(ROOT/'artifacts/production-lanes/manifest.json')
payment_gateway = read_json(ROOT/'artifacts/production-lanes/payment-gateway.json')
server_auth = read_json(ROOT/'artifacts/production-lanes/server-auth.json')
release_artifacts = {
  'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
  'branch': '',
  'commit': '',
  'checklist_ok': checklist['ok'],
  'checklist_checks': [{'id': item['id'], 'ok': item['ok']} for item in checklist['checks']],
  'ui_smoke': {
    'ok': smoke['ok'], 'run_id': smoke['run_id'], 'screenshot_path': smoke['screenshot_path'], 'dom_dump_path': smoke['dom_dump_path'],
    'checkout_present': smoke.get('verified',{}).get('checkout_present') is True,
    'library_present': smoke.get('verified',{}).get('library_present') is True,
    'catalog_present': smoke.get('verified',{}).get('catalog_present') is True,
    'release_history_present': smoke.get('verified',{}).get('release_history_present') is True,
    'truth_boundary_present': smoke.get('verified',{}).get('truth_boundary_present') is True,
    'export_verified': smoke.get('verified',{}).get('export_verified') is True,
    'import_restored': smoke.get('verified',{}).get('import_restored') is True,
  },
  'publishing_binaries': {'ok': binary_manifest['ok'], 'jobs': [{'mode': j['mode'], 'slug': j['slug'], 'docx_path': j['docx_path'], 'pdf_path': j['pdf_path']} for j in binary_manifest['jobs']]},
  'retailer_packages': {'ok': retailer_manifest['ok'], 'jobs': [{'mode': j['mode'], 'slug': j['slug'], 'package_count': len(j['packages']), 'package_channels': [p['channel'] for p in j['packages']]} for j in retailer_manifest['jobs']]},
  'direct_sale_commerce': {'ok': commerce_manifest['ok'], 'release_slug': commerce_manifest['release_slug'], 'orders_count': commerce_manifest['summary']['orders_count'], 'entitlements_count': commerce_manifest['summary']['entitlements_count'], 'library_count': commerce_manifest['summary']['library_count'], 'gross_usd': commerce_manifest['summary']['gross_usd'], 'verification_ok': commerce_manifest.get('verification',{}).get('ok') is True},
  'local_auth': {'ok': local_auth_manifest['ok'], 'auth_mode': local_auth_manifest.get('summary',{}).get('auth_mode'), 'verification_ok': local_auth_manifest.get('verification',{}).get('ok') is True, 'issues': local_auth_manifest.get('verification',{}).get('issues',[])},
  'truth_boundaries': {'ok': truth_manifest['ok'], 'auth_mode': truth_manifest['boundaries']['auth']['mode'], 'payment_mode': truth_manifest['boundaries']['payments']['mode'], 'submission_mode': truth_manifest['boundaries']['submissions']['mode']},
  'production_lanes': production_manifest,
  'payment_gateway': payment_gateway,
  'server_auth': server_auth,
  'release_history': {'ok': history_manifest['ok'], 'runs_count': history_manifest['summary']['runs_count'], 'titles_count': history_manifest['summary']['titles_count'], 'gross_usd': history_manifest['summary']['gross_usd']},
  'multi_title_catalog': {'ok': catalog_manifest['ok'], 'titles_count': catalog_manifest['summary']['titles_count'], 'active_title_id': catalog_manifest['active_title_id'], 'title_names': catalog_manifest['title_names']},
}
write_json(ROOT/'artifacts/release-artifacts.json', release_artifacts)

status = {item['id']: item['ok'] for item in checklist['checks']}
required = {
  'security': {'required':['gateway_only','provider_strings','secure_defaults','external_endpoints','protected_apps','local_auth','legacy_archives','hardening_todo','production_config']},
  'reliability': {'required':['build','ui_smoke','smoke_snapshot','auth_regression','production_lanes','ui_server_bridge']},
  'data_integrity': {'required':['skye_schema','gateway_shape','export_import_schema']},
  'product_integrity': {'required':['publishing_packages','publishing_binaries','retailer_package_emitters','retailer_validator','direct_sale_commerce','release_history','multi_title_catalog','server_auth','payment_gateway','submission_adapters','submission_contract_preview','submission_job_routes','submission_state_persistence']},
  'executive_readiness': {'required':['artifact_consistency','artifact_freshness','truth_boundaries','no_theater']},
}
gates = {gate: all(status.get(cid) is True for cid in info['required']) for gate, info in required.items()}
write_json(ROOT/'artifacts/release-gates.json', {'generated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'gates': gates, 'required': required, 'ok': all(gates.values())})

print('manual refresh complete')
