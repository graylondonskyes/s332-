#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const required = [
  'index.html',
  'landing.html',
  'homepage.html',
  'offline.html',
  'manifest.json',
  'manifest.webmanifest',
  'service-worker.js',
  'sw.js',
  'js/landing-scene.js',
  'js/donor-template-library.js',
  'js/webcreator.js',
  'js/skygate-client.js',
  'api/README.md',
  'docs/ARCHITECTURE.md',
  'docs/API_BRIDGE.md',
  'docs/PERSISTENCE.md',
  'docs/AE_DELIVERY_FLOW.md',
  'docs/SKYGATEFS13_INTEGRATION.md',
  'docs/PRODUCTION_READINESS.md',
  'config/env.contract.json',
  '.env.example',
  'SkyeWebCreatorMax_DIRECTIVE.md',
  'RELEASE_MANIFEST.json',
  'smoke/smoke-browser.mjs',
  'smoke/smoke-donor-templates.mjs',
  'smoke/smoke-landing.mjs',
  'smoke/smoke-sole-grade-export.mjs',
  'smoke/smoke-production-readiness.mjs',
];

const missing = required.filter((file) => !fs.existsSync(path.join(ROOT, file)));
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const landing = fs.readFileSync(path.join(ROOT, 'landing.html'), 'utf8');
const landingScene = fs.readFileSync(path.join(ROOT, 'js/landing-scene.js'), 'utf8');
const donorLibrary = fs.readFileSync(path.join(ROOT, 'js/donor-template-library.js'), 'utf8');
const runtime = fs.readFileSync(path.join(ROOT, 'js/webcreator.js'), 'utf8');
const gateClient = fs.readFileSync(path.join(ROOT, 'js/skygate-client.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));

const checks = {
  noMissingFiles: missing.length === 0,
  indexNamesProduct: index.includes('SkyeWebCreatorMax'),
  landingNamesProduct: landing.includes('SkyeWebCreatorMax') && landing.includes('./index.html'),
  landingLoadsThreeScene: landing.includes('./js/landing-scene.js') && landingScene.includes('three.module.js'),
  indexLoadsRuntime: index.includes('./js/webcreator.js'),
  indexLoadsDonorTemplates: index.includes('./js/donor-template-library.js') && runtime.includes('SkyeWebCreatorTemplates'),
  indexLoadsGateClient: index.includes('./js/skygate-client.js'),
  donorLibraryReferencesImports: donorLibrary.includes('design-vault/sources/shadcn-ui') && donorLibrary.includes('design-vault/sources/tailgrids') && donorLibrary.includes('design-vault/sources/react-three-fiber') && donorLibrary.includes('design-vault/sources/drei') && donorLibrary.includes('design-vault/sources/triplex'),
  runtimePersistsProjects: runtime.includes('skyewebcreatormax.projects.v1'),
  runtimeHasSourceEditor: runtime.includes('applyEditor') && index.includes('codeEditor'),
  runtimeHasLivePreview: runtime.includes('preview.srcdoc') && index.includes('previewFrame'),
  runtimeQueuesAeDelivery: runtime.includes('queued-for-ae-delivery'),
  gateClientTargetsSkyeGate: gateClient.includes('platform-event-ingest') && gateClient.includes('gateway-chat'),
  manifestReferencesBridge: manifest.connectedBridge === 'skyehands_runtime_control/core/webcreator/skyewebcreator-bridge.mjs',
  manifestReferencesDesignVault: manifest.designVault === 'design-vault/library',
  manifestReferencesGateway: manifest.gateway?.canonical === 'AbovetheSkye-Platforms/SkyeGateFS13',
  manifestReferencesProductionSmoke: manifest.smoke.includes('smoke/smoke-production-readiness.mjs'),
};

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'skyewebcreator-release-checks',
  missing,
  checks,
  passed: Object.values(checks).every(Boolean),
};

console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exit(1);
