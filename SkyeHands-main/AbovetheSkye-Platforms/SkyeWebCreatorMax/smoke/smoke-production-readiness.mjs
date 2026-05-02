#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EVENT_TYPES,
  REGISTERED_PLATFORMS,
} from '../../../skyehands_runtime_control/core/platform-bus/skyehands-platform-bus.mjs';
import {
  getWebCreatorProductionReadiness,
  validateWebCreatorSpec,
} from '../../../skyehands_runtime_control/core/webcreator/skyewebcreator-bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCT_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PRODUCT_ROOT, '../..');
const envContract = JSON.parse(fs.readFileSync(path.join(PRODUCT_ROOT, 'config/env.contract.json'), 'utf8'));

const requiredFiles = [
  'index.html',
  'landing.html',
  'homepage.html',
  'offline.html',
  'manifest.json',
  'manifest.webmanifest',
  'service-worker.js',
  'sw.js',
  'js/webcreator.js',
  'js/skygate-client.js',
  'api/README.md',
  'docs/ARCHITECTURE.md',
  'docs/API_BRIDGE.md',
  'docs/PERSISTENCE.md',
  'docs/AE_DELIVERY_FLOW.md',
  'docs/PRODUCTION_READINESS.md',
  'config/env.contract.json',
  '.env.example',
  'SkyeWebCreatorMax_DIRECTIVE.md',
  'RELEASE_MANIFEST.json',
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(PRODUCT_ROOT, file)));
const readiness = getWebCreatorProductionReadiness({ repoRoot: REPO_ROOT });
const invalidSpecErrors = validateWebCreatorSpec({});
const validSpecErrors = validateWebCreatorSpec({
  name: 'Production Readiness Site',
  brief: 'Create a production readiness website package.',
  pages: ['home'],
  features: ['handoff'],
});

const productionRequiredNames = envContract.productionRequired.map((entry) => entry.name);
const readinessMissingNames = readiness.allowedProductionBlockers.map((entry) => entry.name);
const missingOnlyContractVars = readinessMissingNames.every((name) => productionRequiredNames.includes(name));

const checks = {
  noMissingProductFiles: missingFiles.length === 0,
  eventTypesRegistered: [
    'webcreator.project.requested',
    'webcreator.project.generated',
    'webcreator.asset.persisted',
    'webcreator.delivery.queued',
    'app.generated',
    'ae.requested',
  ].every((eventType) => EVENT_TYPES.includes(eventType)),
  skyeGateClientPresent: fs.readFileSync(path.join(PRODUCT_ROOT, 'js/skygate-client.js'), 'utf8').includes('platform-event-ingest'),
  platformsRegistered: ['skyewebcreator-max', 'skydexia', 'ae-commandhub'].every((platform) => REGISTERED_PLATFORMS.includes(platform)),
  bridgeLocalReady: readiness.localReady === true,
  invalidSpecRejected: invalidSpecErrors.includes('name is required') && invalidSpecErrors.includes('brief is required'),
  validSpecAccepted: validSpecErrors.length === 0,
  productionVarsContracted: productionRequiredNames.length >= 7,
  missingProductionBlockersOnlyVars: missingOnlyContractVars,
};

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'skyewebcreator-production-readiness',
  localReady: Object.entries(checks)
    .filter(([key]) => key !== 'missingProductionBlockersOnlyVars')
    .every(([, ok]) => ok),
  productionReady: Object.values(checks).every(Boolean) && readiness.productionReady,
  checks,
  missingFiles,
  allowedProductionBlockers: readiness.allowedProductionBlockers,
  requiredProductionEnvVars: productionRequiredNames,
};

result.passed = result.localReady && result.missingFiles.length === 0 && result.checks.missingProductionBlockersOnlyVars;

console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exit(1);
