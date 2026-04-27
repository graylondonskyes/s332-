const fs = require('fs');
const path = require('path');
const { fail, ok, repoPath, writeJson } = require('./lib');
const { generateSkyeDocxPackage } = require('../platform/publishing');
const { exportWorkspace, importWorkspace, verifyWorkspaceBundle } = require('../platform/export-import');
const { createCheckoutSession, emptyCommerceState, appendPurchase, summarizeCommerceState, verifyCommerceState } = require('../platform/commerce');

const fixture = JSON.parse(fs.readFileSync(repoPath('fixtures','publishing','skydocx-workspace.json'), 'utf8'));
const authorPackage = generateSkyeDocxPackage(fixture, { runId:'commerce-proof' });

let state = emptyCommerceState();
const sessions = [];
for (let index = 0; index < 2; index += 1) {
  const session = createCheckoutSession(authorPackage, { name:`Buyer ${index+1}`, email:`buyer${index+1}@local.invalid` }, { runId:`commerce-${index}`, sessionId:`chk_${index}` });
  if (session.schema !== 'skye.directsale.checkout.session') fail(`[direct-sale-commerce] FAIL :: session-schema-${index}`);
  if (session.release_slug !== authorPackage.slug) fail(`[direct-sale-commerce] FAIL :: session-slug-${index}`);
  if (!session.integrity_hash) fail(`[direct-sale-commerce] FAIL :: session-integrity-${index}`);
  state = appendPurchase(state, session, { orderId:`ord_${index}`, entitlementId:`ent_${index}`, libraryId:`lib_${index}` });
  sessions.push(session);
}
if (state.orders.length !== 2) fail('[direct-sale-commerce] FAIL :: order-count');
if (state.entitlements.length !== 2) fail('[direct-sale-commerce] FAIL :: entitlement-count');
if (state.library.length !== 2) fail('[direct-sale-commerce] FAIL :: library-count');
if (state.analytics.gross_usd !== authorPackage.direct_sale.price_usd * 2) fail('[direct-sale-commerce] FAIL :: gross-usd');
if (!state.analytics.latest_ledger_hash) fail('[direct-sale-commerce] FAIL :: latest-ledger-hash');

const verification = verifyCommerceState(state);
if (!verification.ok) fail(`[direct-sale-commerce] FAIL :: verification ${verification.issues.join(',')}`);

const summary = summarizeCommerceState(state);
if (summary.library_count !== 2) fail('[direct-sale-commerce] FAIL :: summary-library-count');
if (summary.latest_release_slug !== authorPackage.slug) fail('[direct-sale-commerce] FAIL :: summary-latest-slug');

const exportBundle = exportWorkspace({ mode: 'skydocx', files: fixture.files, publishing: { authorPackage }, commerce: state }, 'sovereign-build-passphrase');
const bundleCheck = verifyWorkspaceBundle(exportBundle, 'sovereign-build-passphrase');
if (!bundleCheck.signature_valid) fail('[direct-sale-commerce] FAIL :: bundle-verification');

const imported = importWorkspace(exportBundle, 'sovereign-build-passphrase');
if (!imported.commerce || imported.commerce.library.length !== 2) fail('[direct-sale-commerce] FAIL :: export-import-commerce');

const artifactDir = repoPath('artifacts','direct-sale-commerce');
fs.mkdirSync(artifactDir, { recursive: true });
writeJson(path.join(artifactDir, 'manifest.json'), { generated_at: new Date().toISOString(), ok: true, release_slug: authorPackage.slug, sessions, summary, verification });

ok('[direct-sale-commerce] PASS (14 vectors)');
