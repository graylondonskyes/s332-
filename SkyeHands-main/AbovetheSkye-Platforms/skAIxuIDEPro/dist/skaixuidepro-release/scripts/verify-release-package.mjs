import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', 'skaixuidepro-release');

const requiredPaths = [
  'RELEASE_PACKAGE_MANIFEST.json',
  'package.json',
  'netlify.toml',
  'index.html',
  'skAIxuide/index.html',
  'skAIxuide/login.html',
  'skAIxuide/admin_panel.html',
  'skAIxuide/diagnostics.html',
  'netlify/functions/gateway-chat.js',
  'netlify/functions/gateway-stream.js',
  'netlify/functions/runtime-status.js',
  'netlify/functions/_lib/kaixu-openai.js',
  'netlify/functions/_lib/kaixu-platform.js',
  'vendor/three/three.min.js',
  'vendor/tailwind/tailwindcdn.js',
  'vendor/lucide/lucide.min.js',
  'vendor/netlify-identity/netlify-identity-widget.js',
  's0l26/runtime-guards.js',
  's0l26/shared-runtime.js',
  'scripts/release-readiness.mjs',
  'scripts/smoke-functions.mjs',
  'scripts/smoke-interactions-playwright.mjs',
  'scripts/verify-production-env.mjs'
];

function exists(relPath) {
  return fs.existsSync(path.join(outDir, relPath));
}

function walk(dir, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, found);
    else found.push(abs);
  }
  return found;
}

function htmlRefs(relPath) {
  const abs = path.join(outDir, relPath);
  const html = fs.readFileSync(abs, 'utf8');
  const refs = [];
  const regex = /<(a|script|link)\b[^>]*\b(href|src)="([^"]+)"/gi;
  let match;
  while ((match = regex.exec(html))) {
    const ref = match[3];
    if (!ref || /^(https?:|mailto:|tel:|#|javascript:|data:)/i.test(ref)) continue;
    const target = ref.startsWith('/')
      ? path.join(outDir, ref.replace(/^\/+/, ''))
      : path.resolve(path.dirname(abs), ref);
    refs.push({ ref, ok: fs.existsSync(target) });
  }
  return refs;
}

const missing = requiredPaths.filter((relPath) => !exists(relPath));
const nodeModules = walk(outDir).filter((abs) => abs.includes(`${path.sep}node_modules${path.sep}`));
const refs = [
  ...htmlRefs('index.html').map((item) => ({ page: 'index.html', ...item })),
  ...htmlRefs('skAIxuide/index.html').map((item) => ({ page: 'skAIxuide/index.html', ...item })),
  ...htmlRefs('skAIxuide/login.html').map((item) => ({ page: 'skAIxuide/login.html', ...item })),
  ...htmlRefs('skAIxuide/admin_panel.html').map((item) => ({ page: 'skAIxuide/admin_panel.html', ...item })),
  ...htmlRefs('skAIxuide/diagnostics.html').map((item) => ({ page: 'skAIxuide/diagnostics.html', ...item }))
];
const missingRefs = refs.filter((item) => !item.ok);

const manifest = exists('RELEASE_PACKAGE_MANIFEST.json')
  ? JSON.parse(fs.readFileSync(path.join(outDir, 'RELEASE_PACKAGE_MANIFEST.json'), 'utf8'))
  : null;

const result = {
  ok: missing.length === 0 && missingRefs.length === 0 && nodeModules.length === 0 && Boolean(manifest?.verification),
  output: path.relative(root, outDir),
  missing,
  missing_refs: missingRefs,
  node_modules_files: nodeModules.map((abs) => path.relative(outDir, abs)),
  manifest_verification: manifest?.verification || []
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) process.exit(1);
