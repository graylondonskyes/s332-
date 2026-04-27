const { repoPath, readJson, writeJson, ok } = require('./lib');

const checklist = readJson(repoPath('artifacts','release-checklist.json'));
const smoke = readJson(repoPath('artifacts','ui-smoke','ui-smoke-summary.json'));
const binaryManifest = readJson(repoPath('artifacts','publishing-binaries','manifest.json'));
const retailerManifest = readJson(repoPath('artifacts','retailer-packages','manifest.json'));
const commerceManifest = readJson(repoPath('artifacts','direct-sale-commerce','manifest.json'));
const historyManifest = readJson(repoPath('artifacts','release-history','manifest.json'));
const catalogManifest = readJson(repoPath('artifacts','catalog-state','manifest.json'));
const localAuthManifest = readJson(repoPath('artifacts','local-auth','manifest.json'));
const truthBoundaryManifest = readJson(repoPath('artifacts','truth-boundaries','manifest.json'));
const productionLaneManifest = readJson(repoPath('artifacts','production-lanes','manifest.json'));

writeJson(repoPath('artifacts','release-artifacts.json'), {
  generated_at:new Date().toISOString(),
  branch:'',
  commit:'',
  checklist_ok:checklist.ok,
  checklist_checks:checklist.checks.map((item)=>({ id:item.id, ok:item.ok })),
  ui_smoke:{ ok:smoke.ok, run_id:smoke.run_id, screenshot_path:smoke.screenshot_path, dom_dump_path:smoke.dom_dump_path, checkout_present: smoke.verified?.checkout_present === true, library_present: smoke.verified?.library_present === true, catalog_present: smoke.verified?.catalog_present === true, release_history_present: smoke.verified?.release_history_present === true, truth_boundary_present: smoke.verified?.truth_boundary_present === true, export_verified: smoke.verified?.export_verified === true, import_restored: smoke.verified?.import_restored === true },
  publishing_binaries:{ ok:binaryManifest.ok, jobs:binaryManifest.jobs.map((job)=>({ mode:job.mode, slug:job.slug, docx_path:job.docx_path, pdf_path:job.pdf_path })) },
  retailer_packages:{ ok:retailerManifest.ok, jobs:retailerManifest.jobs.map((job)=>({ mode:job.mode, slug:job.slug, package_count:job.packages.length, package_channels:job.packages.map((pkg)=>pkg.channel || null) })) },
  direct_sale_commerce:{ ok:commerceManifest.ok, release_slug: commerceManifest.release_slug, orders_count: commerceManifest.summary.orders_count, entitlements_count: commerceManifest.summary.entitlements_count, library_count: commerceManifest.summary.library_count, gross_usd: commerceManifest.summary.gross_usd, verification_ok: commerceManifest.verification?.ok === true },
  local_auth:{ ok:localAuthManifest.ok, auth_mode: localAuthManifest.summary?.auth_mode || null, verification_ok: localAuthManifest.verification?.ok === true, issues: localAuthManifest.verification?.issues || [], expires_at: localAuthManifest.summary?.expires_at || null },
  truth_boundaries:{ ok:truthBoundaryManifest.ok, auth_mode: truthBoundaryManifest.boundaries?.auth?.mode || null, payment_mode: truthBoundaryManifest.boundaries?.payments?.mode || null, submission_mode: truthBoundaryManifest.boundaries?.submissions?.mode || null },
  production_lanes: productionLaneManifest,
  release_history:{ ok:historyManifest.ok, runs_count: historyManifest.summary.runs_count, titles_count: historyManifest.summary.titles_count, gross_usd: historyManifest.summary.gross_usd },
  multi_title_catalog:{ ok:catalogManifest.ok, titles_count: catalogManifest.summary.titles_count, active_title_id: catalogManifest.active_title_id, title_names: catalogManifest.title_names }
});
ok('[release-artifacts] Wrote artifacts/release-artifacts.json');
