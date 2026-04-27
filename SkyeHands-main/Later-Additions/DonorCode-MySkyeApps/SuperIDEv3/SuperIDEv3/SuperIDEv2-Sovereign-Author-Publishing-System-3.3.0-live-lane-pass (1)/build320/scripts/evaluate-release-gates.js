const { repoPath, readJson, writeJson, fail, ok } = require('./lib');

const checklist = readJson(repoPath('artifacts','release-checklist.json'));
const status = new Map(checklist.checks.map((item)=>[item.id, item.ok]));
const required = {
  security:{ required:['gateway_only','provider_strings','secure_defaults','external_endpoints','protected_apps','local_auth','legacy_archives','hardening_todo','production_config'] },
  reliability:{ required:['build','ui_smoke','smoke_snapshot','auth_regression','production_lanes','ui_server_bridge'] },
  data_integrity:{ required:['skye_schema','gateway_shape','export_import_schema'] },
  product_integrity:{ required:['publishing_packages','publishing_binaries','retailer_package_emitters','retailer_validator','direct_sale_commerce','release_history','multi_title_catalog','server_auth','payment_gateway','submission_adapters','submission_contract_preview','submission_job_routes','submission_state_persistence'] },
  executive_readiness:{ required:['artifact_consistency','artifact_freshness','truth_boundaries','no_theater'] }
};
const gates = Object.fromEntries(Object.entries(required).map(([gate, info])=>[gate, info.required.every((id)=>status.get(id)===true)]));
const payload = { generated_at:new Date().toISOString(), gates, required, ok:Object.values(gates).every(Boolean) };
writeJson(repoPath('artifacts','release-gates.json'), payload);
if (!payload.ok) fail('[release-gates] FAIL');
ok('[release-gates] PASS');
