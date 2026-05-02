import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'skaixuidepro-release');

const releasePaths = [
  '.env.example',
  'DEPLOY_NETLIFY_MANUAL_CLI.md',
  'DIAGNOSTICS_AUTH.md',
  'AI-Directives',
  'AI-Visual-Guides',
  'Code Genie',
  'Data Forge',
  'DebugPro',
  'DevProof Lab',
  'GodCode',
  'GodKode',
  'GodNodes',
  'GotSOLE',
  'Images',
  'KaiPrompt',
  'NEWNEW',
  'Neural-Space-Pro',
  'Nexus Forge Studio',
  'Nexus-Pro',
  'NexusConnectHomepage',
  'NexusDBExplorer',
  'PlanItPro',
  'RegexGen',
  'SERVER_SIDE_AI_HARDENING.md',
  'SHIP_REMEDIATION_TRACKER.md',
  'ULTIMATE_SHIP_DIRECTIVE.md',
  'SkyesOverLondon.html',
  'SkyeBox',
  'SkyeDocx',
  'SkyeKnife',
  'SkyeVault',
  'SovereignVariables',
  'WebPilePro',
  'Webby',
  'index.html',
  'kaixumagic',
  'manifest.json',
  'netlify',
  'netlify.toml',
  'package-lock.json',
  'package.json',
  's0l26',
  'scripts',
  'server.js',
  'skAIxuide',
  'skaixuide',
  'skriptx',
  'skriptxdataalchemist',
  'skyehawk.js',
  'skyeofferforge',
  'skyeportal',
  'skyesoverlondon.html',
  'skyeuipro',
  'sw.js',
  'vendor',
  'projectaegis-skyex',
  'reactforge'
];

async function exists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function copyRel(relPath) {
  const from = path.join(root, relPath);
  const to = path.join(outDir, relPath);
  if (!(await exists(from))) {
    throw new Error(`Release path missing: ${relPath}`);
  }
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.cp(from, to, {
    recursive: true,
    force: true,
    filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`) && !src.includes(`${path.sep}.netlify${path.sep}`)
  });
}

async function validateHtmlRefs(relPath) {
  const abs = path.join(outDir, relPath);
  const html = await fs.readFile(abs, 'utf8');
  const regex = /<(a|script|link)\b[^>]*\b(href|src)="([^"]+)"/gi;
  const missing = [];
  let match;
  while ((match = regex.exec(html))) {
    const ref = match[3];
    if (!ref || /^(https?:|mailto:|tel:|#|javascript:|data:)/i.test(ref)) continue;
    const target = ref.startsWith('/')
      ? path.join(outDir, ref.replace(/^\/+/, ''))
      : path.resolve(path.dirname(abs), ref);
    if (!(await exists(target))) missing.push(`${relPath} -> ${ref}`);
  }
  return missing;
}

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

for (const relPath of releasePaths) {
  await copyRel(relPath);
}

const manifest = {
  name: 'skAIxuIDEpro release package',
  created_at: new Date().toISOString(),
  source_root: root,
  included_paths: releasePaths,
  excluded_by_default: [
    'archive sibling app folders not promoted into the release lane',
    'node_modules',
    '.netlify local state'
  ],
  verification: [
    'npm run verify:release',
    'npm run verify:functions',
    'npm run verify:browser-smoke',
    'npm run verify:prod-env',
    'npm run verify:release-package',
    'npm run package:release'
  ]
};

await fs.writeFile(path.join(outDir, 'RELEASE_PACKAGE_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const missingRefs = [
  ...(await validateHtmlRefs('index.html')),
  ...(await validateHtmlRefs('skAIxuide/index.html')),
  ...(await validateHtmlRefs('skAIxuide/login.html')),
  ...(await validateHtmlRefs('skAIxuide/admin_panel.html')),
  ...(await validateHtmlRefs('skAIxuide/diagnostics.html')),
  ...(await validateHtmlRefs('skAIxuide/SmartIDE.html')),
  ...(await validateHtmlRefs('skAIxuide/Features&Specs.html')),
  ...(await validateHtmlRefs('skAIxuide/tutorial.html')),
  ...(await validateHtmlRefs('skAIxuide/CODEPULSE.html'))
];

if (missingRefs.length) {
  console.error(JSON.stringify({
    ok: false,
    output: path.relative(root, outDir),
    missing_refs: missingRefs
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  output: path.relative(root, outDir),
  included_paths: releasePaths.length,
  checked_refs: true
}, null, 2));
