const fs = require('fs');
const path = require('path');
const { fail, ok, repoPath, readJson } = require('./lib');

const releaseArtifacts = readJson(repoPath('artifacts','release-artifacts.json'));
const contractProof = readJson(repoPath('artifacts','contract-proof.json'));
const issues = [];
const txt = JSON.stringify(releaseArtifacts);
if ((releaseArtifacts.production_lanes?.checkout?.provider || '').includes('mock')) issues.push('production-lanes-mock-provider');
if (txt.includes('/tmp/super250') || txt.includes('/tmp/super260') || txt.includes('/tmp/super250/')) issues.push('stale-temp-path');
if (txt.includes('mock-stripe')) issues.push('stale-mock-stripe');
if (txt.includes('"version": "2.4.3"') || txt.includes('"version": "2.6.0"') || txt.includes('"version": "3.0.0"') || txt.includes('"version": "3.1.0"')) issues.push('stale-version-residue');
if (contractProof.ok !== true) issues.push('contract-proof-not-ok');
if ((contractProof.checks_failed || 0) !== 0) issues.push('contract-proof-failures');
if (issues.length) fail(`[artifact-freshness] FAIL :: ${issues.join(', ')}`);
ok('[artifact-freshness] PASS');
