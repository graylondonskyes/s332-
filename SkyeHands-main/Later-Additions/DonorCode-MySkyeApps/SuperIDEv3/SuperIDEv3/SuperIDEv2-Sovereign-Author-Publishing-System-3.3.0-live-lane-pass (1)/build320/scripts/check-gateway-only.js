const { repoPath, readJson, fail, ok } = require('./lib');
const secureDefaults = readJson(repoPath('config','secure-defaults.json'));
if (secureDefaults.gatewayMode !== 'skye-gateway-only') fail('[gateway-check] FAIL: gatewayMode must stay skye-gateway-only.');
if (secureDefaults.allowExternalProviders !== false) fail('[gateway-check] FAIL: allowExternalProviders must remain false.');
if (secureDefaults.openGate !== false) fail('[gateway-check] FAIL: openGate must remain false.');
ok('[gateway-check] PASS: gateway-only policy enforced.');
