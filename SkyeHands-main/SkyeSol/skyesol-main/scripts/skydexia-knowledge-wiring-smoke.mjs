#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skyeSolRoot = path.resolve(__dirname, '..');
const skyeHandsRoot = path.resolve(skyeSolRoot, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(skyeHandsRoot, relativePath), 'utf8'));
}

function exists(relativePath) {
  return fs.existsSync(path.join(skyeHandsRoot, relativePath));
}

const requiredPaths = [
  'AGENTS.md',
  'design-vault/README.md',
  'design-vault/recipes/frontend-design-agent-contract.md',
  'design-vault/library/README.md',
  'design-vault/library/AUDIT.md',
  'design-vault/library/use-case-matrix.json',
  'design-vault/library/templates/template-catalog.json',
  'design-vault/library/recipes/import-recipes.md',
  'design-vault/library/catalog/source-index.json',
  'design-vault/library/catalog/SOURCE_INDEX.md',
  'design-vault/library/catalog/pattern-index.json',
  'design-vault/library/catalog/PATTERN_INDEX.md',
  'design-vault/sources/react-three-fiber',
  'design-vault/sources/drei',
  'design-vault/sources/triplex',
  'design-vault/sources/shadcn-ui',
  'design-vault/sources/tailgrids',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax/index.html',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax/SkyeWebCreatorMax_DIRECTIVE.md',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax/docs/ARCHITECTURE.md',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax/docs/PRODUCTION_READINESS.md',
  'AbovetheSkye-Platforms/SkyeWebCreatorMax/config/env.contract.json',
  'skyehands_runtime_control/core/webcreator/skyewebcreator-bridge.mjs',
  'SkyDexia-Additional-Knowledge/SKYDEXIA_ULTIMATE_KNOWLEDGE_ORCHESTRATOR.md',
  'SkyDexia-Additional-Knowledge/SKYDEXIA_SKYGATE_AGENT.md',
  'SkyDexia-Additional-Knowledge/design-agent/SKYDEXIA_DESIGN_AGENT.md',
  'SkyDexia-Additional-Knowledge/manifests/skydexia-knowledge-wiring.json',
  'SkyDexia-Additional-Knowledge/skydexia-ai-brain-drive-90gb-edition-v0.2.0-integrated-static-smoke/skydexia-ai-brain-drive-90gb-edition-v0.2.0-integrated/configs/skydexia/knowledge-links.json',
  'AbovetheSkye-Platforms/SkyDexia/capability-registry.json',
  'AbovetheSkye-Platforms/SkyDexia/knowledge-base/KNOWLEDGE_SKELETON_INDEX.json',
  'AbovetheSkye-Platforms/SkyDexia/knowledge-base/trusted-sources/skyehands-design-vault.source.json',
  'AbovetheSkye-Platforms/SkyDexia/orchestration/ae-brain-orchestrator.json',
  'AbovetheSkye-Platforms/SkyDexia/donors/normalized-index.json',
  'AbovetheSkye-Platforms/SkyDexia/generated-projects',
];

const missing = requiredPaths.filter((relativePath) => !exists(relativePath));

const registry = readJson('AbovetheSkye-Platforms/SkyDexia/capability-registry.json');
const registryIds = new Set((registry.capabilities || []).map((capability) => capability.id));
const requiredCapabilities = [
  'ae.brain.chat',
  'skydexia.project.autonomous_generation',
  'skydexia.design.vault',
  'skydexia.donor.enterprise_templates',
  'skydexia.knowledge.continuous_update',
  'skyewebcreator.website_ui_generation',
  'skyewebcreator.ae_delivery_handoff',
];
const missingCapabilities = requiredCapabilities.filter((id) => !registryIds.has(id));

const skeleton = readJson('AbovetheSkye-Platforms/SkyDexia/knowledge-base/KNOWLEDGE_SKELETON_INDEX.json');
const skeletonLanes = new Set(skeleton.lanes || []);
const requiredLanes = [
  'skydexia/knowledge-base/GiftsFromtheSkyes',
  'skydexia/knowledge-base/trusted-sources',
  'skydexia/knowledge-base/design-vault',
  'skydexia/knowledge-base/ae-orchestration',
  'skydexia/knowledge-base/enterprise-templates',
];
const missingLanes = requiredLanes.filter((lane) => !skeletonLanes.has(lane));

const wiring = readJson('SkyDexia-Additional-Knowledge/manifests/skydexia-knowledge-wiring.json');
const manifestReferencesMissing = (wiring.requiredKnowledgeFiles || []).filter((relativePath) => !exists(relativePath));

const sourceIndex = readJson('design-vault/library/catalog/source-index.json');
const indexedSourceIds = new Set((sourceIndex.sources || []).map((source) => source.id));
const requiredIndexedSources = ['react-three-fiber', 'drei', 'triplex', 'shadcn-ui', 'tailgrids'];
const missingIndexedSources = requiredIndexedSources.filter((sourceId) => !indexedSourceIds.has(sourceId));

const ok = missing.length === 0
  && missingCapabilities.length === 0
  && missingLanes.length === 0
  && manifestReferencesMissing.length === 0
  && missingIndexedSources.length === 0;

const result = {
  ok,
  checkedAt: new Date().toISOString(),
  skyeHandsRoot,
  missingPaths: missing,
  missingCapabilities,
  missingKnowledgeLanes: missingLanes,
  manifestReferencesMissing,
  missingIndexedSources,
};

console.log(JSON.stringify(result, null, 2));
process.exit(ok ? 0 : 1);
