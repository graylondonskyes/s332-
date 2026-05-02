#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(runtimeRoot, '..');
const proofDir = path.join(runtimeRoot, '.skyequanta', 'proofs');
const outFile = path.join(proofDir, 'gateway-additive-routes-smoke.json');

const packSuffix = 'assets/Upgrades/SKyeverse-SkyeTokens-SkyeCOINS/Gate-Upgrades/GatewayUpgrades/GatewayUpgrades/sky-currency-additive-pack';
const directiveSuffix = 'assets/Upgrades/SKyeverse-SkyeTokens-SkyeCOINS/Gate-Upgrades/GatewayUpgrades/GatewayUpgrades/kaixu_multimodal_gateway_patch_build_directive.md';

const packs = [
  { platform: 'kAIxUGateway13', root: path.join(repoRoot, 'AbovetheSkye-Platforms', 'kAIxUGateway13', packSuffix), directive: path.join(repoRoot, 'AbovetheSkye-Platforms', 'kAIxUGateway13', directiveSuffix) },
  { platform: 'SkyeGateFS13', root: path.join(repoRoot, 'AbovetheSkye-Platforms', 'SkyeGateFS13', packSuffix), directive: path.join(repoRoot, 'AbovetheSkye-Platforms', 'SkyeGateFS13', directiveSuffix) },
];

const requiredRoutes = [
  { method: 'POST', path: '/v1/embeddings', handler: 'handleEmbeddings', importPath: './routes/embeddings', docNeedle: '`POST /v1/embeddings`' },
  { method: 'GET', path: '/v1/wallet', handler: 'handleWalletBalance', importPath: './routes/wallet-balance', docNeedle: '`GET /v1/wallet`' },
  { method: 'GET', path: '/v1/wallet/balance', handler: 'handleWalletBalance', importPath: './routes/wallet-balance', docNeedle: '`GET /v1/wallet/balance`' },
  { method: 'GET', path: '/admin/providers', handler: 'handleAdminProviders', importPath: './routes/admin-providers', docNeedle: '`GET /admin/providers`' },
  { method: 'GET', path: '/admin/aliases', handler: 'handleAdminAliases', importPath: './routes/admin-aliases', docNeedle: '`GET /admin/aliases`' },
  { method: 'GET', path: '/admin/routing', handler: 'handleAdminRouting', importPath: './routes/admin-routing', docNeedle: '`GET /admin/routing`' },
  { method: 'POST', path: '/admin/wallets', handler: 'handleAdminWallets', importPath: './routes/admin-wallets', docNeedle: '`POST /admin/wallets`' },
];

const requiredSourceFiles = [
  'src/routes/embeddings.ts',
  'src/routes/wallet-balance.ts',
  'src/routes/admin-providers.ts',
  'src/routes/admin-aliases.ts',
  'src/routes/admin-routing.ts',
  'src/routes/admin-wallets.ts',
];

function readText(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

function routeIsMounted(routerText, route) {
  return routerText.includes(route.importPath)
    && routerText.includes(route.handler)
    && routerText.includes(`path === '${route.path}'`)
    && routerText.includes(`method === '${route.method}'`);
}

function docHasRoute(apiContract, acceptanceChecklist, route) {
  return apiContract.includes(route.docNeedle) && acceptanceChecklist.includes(route.docNeedle);
}

const packResults = packs.map((pack) => {
  const routerFile = path.join(pack.root, 'src', 'router.ts');
  const apiContractFile = path.join(pack.root, 'docs', 'api-contract.md');
  const acceptanceFile = path.join(pack.root, 'docs', 'acceptance-checklist.md');
  const healthFile = path.join(pack.root, 'src/routes/health.ts');
  const chatFile = path.join(pack.root, 'src/routes/chat.ts');
  const embeddingsFile = path.join(pack.root, 'src/routes/embeddings.ts');
  const wranglerFile = path.join(pack.root, 'wrangler.jsonc');
  const readmeFile = path.join(pack.root, 'README.md');
  const lockFile = path.join(pack.root, 'package-lock.json');

  const routerText = readText(routerFile);
  const apiContract = readText(apiContractFile);
  const acceptanceChecklist = readText(acceptanceFile);
  const directive = readText(pack.directive);
  const healthText = readText(healthFile);
  const chatText = readText(chatFile);
  const embeddingsText = readText(embeddingsFile);
  const wranglerText = readText(wranglerFile);
  const readmeText = readText(readmeFile);
  const lockText = readText(lockFile);

  const missingSourceFiles = requiredSourceFiles
    .filter((relativePath) => !fs.existsSync(path.join(pack.root, relativePath)));
  const missingMountedRoutes = requiredRoutes
    .filter((route) => !routeIsMounted(routerText, route))
    .map((route) => `${route.method} ${route.path}`);
  const missingDocumentedRoutes = requiredRoutes
    .filter((route) => !docHasRoute(apiContract, acceptanceChecklist, route))
    .map((route) => `${route.method} ${route.path}`);
  const staleUnwiredClaims = [
    ...routerText.matchAll(/\bnot wired\b|\bstarter pack\b|\bnot exposed\b/gi),
    ...apiContract.matchAll(/\bnot wired\b|\bstarter pack\b|\bnot exposed\b/gi),
    ...acceptanceChecklist.matchAll(/\bnot wired\b|\bstarter pack\b|\bnot exposed\b/gi),
    ...directive.matchAll(/\bnot wired\b|\bstarter pack\b|\bnot exposed\b/gi),
  ].map((match) => match[0]);

  const checks = {
    packRootPresent: fs.existsSync(pack.root),
    routerPresent: fs.existsSync(routerFile),
    sourceFilesPresent: missingSourceFiles.length === 0,
    routesMounted: missingMountedRoutes.length === 0,
    routesDocumented: missingDocumentedRoutes.length === 0,
    noStaleUnwiredClaims: staleUnwiredClaims.length === 0,
    healthReportsEmbeddingsLane: healthText.includes("isLaneEnabled(env, 'embeddings')") && healthText.includes("getLaneKey(env, 'embeddings')"),
    chatRejectsNonChatAliases: chatText.includes('laneForAlias(alias)') && chatText.includes("!== 'chat'"),
    embeddingsNormalizesAndGuardsLane: embeddingsText.includes("normalizeAlias(body.alias, 'embeddings')")
      && embeddingsText.includes('laneForAlias(alias)')
      && embeddingsText.includes("isLaneEnabled(env, 'embeddings')"),
    wranglerUsesPackMigrationsDir: wranglerText.includes('"migrations_dir": "src/db/migrations"'),
    lockfileUsesPortableRegistry: !lockText.includes('packages.applied-caas-gateway1.internal.api.openai.org'),
    typecheckFallbackDocumented: readmeText.includes('shared SuperIDEv3.8 compiler'),
  };

  return {
    platform: pack.platform,
    root: path.relative(repoRoot, pack.root),
    checks,
    missingSourceFiles,
    missingMountedRoutes,
    missingDocumentedRoutes,
    staleUnwiredClaims,
  };
});

const checks = {
  bothGatewayPacksPresent: packResults.every((pack) => pack.checks.packRootPresent),
  routersPresent: packResults.every((pack) => pack.checks.routerPresent),
  additiveRouteSourcesPresent: packResults.every((pack) => pack.checks.sourceFilesPresent),
  additiveRoutesMounted: packResults.every((pack) => pack.checks.routesMounted),
  additiveRoutesDocumented: packResults.every((pack) => pack.checks.routesDocumented),
  staleUnwiredClaimsRemoved: packResults.every((pack) => pack.checks.noStaleUnwiredClaims),
  embeddingsLaneHealthCovered: packResults.every((pack) => pack.checks.healthReportsEmbeddingsLane),
  chatRouteRejectsEmbeddingAlias: packResults.every((pack) => pack.checks.chatRejectsNonChatAliases),
  embeddingsRouteRejectsChatAlias: packResults.every((pack) => pack.checks.embeddingsNormalizesAndGuardsLane),
  gatewayMigrationsDirConfigured: packResults.every((pack) => pack.checks.wranglerUsesPackMigrationsDir),
  gatewayLockfilesPortable: packResults.every((pack) => pack.checks.lockfileUsesPortableRegistry),
  gatewayTypecheckFallbackDocumented: packResults.every((pack) => pack.checks.typecheckFallbackDocumented),
};

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'gateway-additive-routes',
  packResults,
  checks,
  passed: Object.values(checks).every(Boolean),
};

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ...result, proof: path.relative(runtimeRoot, outFile) }, null, 2));

if (!result.passed) process.exit(1);
