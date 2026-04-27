const { exportWorkspace, importWorkspace, canonicalize, verifyWorkspaceBundle, summarizeBundlePayload } = require('../platform/export-import');
const { fail, ok } = require('./lib');

const passphrase = 'sovereign-build-passphrase';
const workspace = {
  mode: 'skydocx',
  files: { 'manuscript.md':'# hello', 'metadata.json':'{"title":"SuperIDEv2 Publishing"}' },
  publishing: { authorPackage: { schema:'skye.skydocx.package', slug:'superidev2-publishing' }, blogPackage: { schema:'skye.skyeblog.package', article_slug:'launch-post' } },
  commerce: { schema:'skye.directsale.state', orders:[{ order_id:'ord_1', amount_usd:49 }], entitlements:[{ entitlement_id:'ent_1' }], library:[{ library_id:'lib_1' }], analytics:{ orders_count:1, entitlements_count:1, library_count:1, gross_usd:49 } },
  checkoutSession: { schema:'skye.directsale.checkout.session', session_id:'chk_1' },
  catalog: { schema:'skye.catalog.state', active_title_id:'title_1', titles:[{ title_id:'title_1', title_name:'Launch Book' }] },
  releaseHistory: { schema:'skye.release.history', runs:[{ run_id:'release_1' }] },
  activeTitleId: 'title_1'
};

for(let index=0; index<12; index+=1){
  const bundle = exportWorkspace(workspace, passphrase);
  const imported = importWorkspace(JSON.parse(JSON.stringify(bundle)), passphrase);
  const expected = canonicalize({ mode: workspace.mode, files: workspace.files, publishing: workspace.publishing, commerce: workspace.commerce, checkoutSession: workspace.checkoutSession, catalog: workspace.catalog, releaseHistory: workspace.releaseHistory, activeTitleId: workspace.activeTitleId });
  if(JSON.stringify(canonicalize(imported)) !== JSON.stringify(expected)) fail(`[export-import-schema] FAIL: roundtrip-${index}`);
}

const bundle = exportWorkspace(workspace, passphrase);
const verification = verifyWorkspaceBundle(bundle, passphrase);
if (!verification.signature_valid) fail('[export-import-schema] FAIL: verification');
if (verification.summary.file_count !== 2 || verification.summary.catalog_titles !== 1 || verification.summary.release_runs !== 1) fail('[export-import-schema] FAIL: summary');
if (summarizeBundlePayload(bundle).workspace_mode !== 'skydocx') fail('[export-import-schema] FAIL: summary-payload');

let passphraseRejected=false; try{ exportWorkspace(workspace,'short'); }catch{ passphraseRejected=true; }
if(!passphraseRejected) fail('[export-import-schema] FAIL: short passphrase should be rejected');

let tamperRejected=false; try{ const bad=exportWorkspace(workspace, passphrase); bad.workspace['metadata.json']='{"title":"tampered"}'; importWorkspace(bad, passphrase); }catch{ tamperRejected=true; }
if(!tamperRejected) fail('[export-import-schema] FAIL: tampered bundle should be rejected');

ok('[export-import-schema] PASS (17 vectors)');
