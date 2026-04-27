const { createSubmissionJob, previewSubmissionContract } = require('../platform/submission-adapters');
const { fail, ok, repoPath } = require('./lib');

try {
  const packagePath = repoPath('artifacts','retailer-packages','skydocx','sovereign-author-publishing-os-apple-ready.zip');
  const job = createSubmissionJob({ channel:'apple_books', package_path:packagePath, title:'Sovereign Author Publishing OS', slug:'sovereign-author-publishing-os' });
  const preview = previewSubmissionContract(job, { endpoint:'https://submit.example.com/apple', auth:{ apple_books:{ scheme:'bearer', token:'apple-token', partner_id:'partner-001' } }, strictAuth:true, deliveryModes:{ apple_books:'portal' } });
  if (!preview.stages.length || preview.stages[0].name !== 'bootstrap_portal_session' || preview.delivery_mode !== 'portal') fail('[submission-contract-preview] FAIL :: workflow');
  if (!preview.header_names.includes('x-apple-partner-id') || preview.status_method !== 'POST' || preview.cancel_method !== 'POST') fail('[submission-contract-preview] FAIL :: headers/status');
  ok('[submission-contract-preview] PASS');
} catch (error) {
  fail(error.stack || error.message);
}
