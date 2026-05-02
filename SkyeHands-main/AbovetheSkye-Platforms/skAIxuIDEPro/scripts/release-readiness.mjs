import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const failures = [];
const checked = [];

function record(ok, message) {
  checked.push({ ok, message });
  if (!ok) failures.push(message);
}

function exists(relPath) {
  const abs = path.join(root, relPath);
  const ok = fs.existsSync(abs);
  record(ok, `${ok ? 'OK' : 'MISSING'} ${relPath}`);
  return ok;
}

function htmlRefs(relPath) {
  const abs = path.join(root, relPath);
  const html = fs.readFileSync(abs, 'utf8');
  const refs = [];
  const regex = /<(a|script|link)\b[^>]*\b(href|src)="([^"]+)"/gi;
  let match;
  while ((match = regex.exec(html))) {
    const url = match[3];
    if (!url || /^(https?:|mailto:|tel:|#|javascript:|data:)/i.test(url)) continue;
    refs.push(url);
  }

  for (const ref of refs) {
    const target = ref.startsWith('/')
      ? path.join(root, ref.replace(/^\/+/, ''))
      : path.resolve(path.dirname(abs), ref);
    record(fs.existsSync(target), `${relPath} -> ${ref}`);
  }
}

function contains(relPath, needle) {
  const abs = path.join(root, relPath);
  const text = fs.readFileSync(abs, 'utf8');
  record(text.includes(needle), `${relPath} contains ${needle}`);
}

async function importModule(relPath) {
  try {
    await import(pathToFileURL(path.join(root, relPath)).href);
    record(true, `IMPORT ${relPath}`);
  } catch (error) {
    record(false, `IMPORT ${relPath}: ${error.message}`);
  }
}

exists('index.html');
exists('manifest.json');
exists('sw.js');
exists('Images/icon-192.png');
exists('Images/icon-512.png');
exists('skAIxuide/index.html');
exists('skAIxuide/manifest.json');
exists('skAIxuide/sw.js');
exists('s0l26/catalog.html');
exists('s0l26/catalog.json');
exists('s0l26/runtime-guards.js');
exists('s0l26/shared-runtime.js');
exists('scripts/smoke-functions.mjs');
exists('scripts/smoke-server.mjs');
exists('scripts/build-release-package.mjs');
exists('scripts/verify-production-env.mjs');
exists('scripts/verify-release-package.mjs');
exists('vendor/three/three.min.js');
exists('vendor/marked/marked.min.js');
exists('vendor/dompurify/purify.min.js');
exists('vendor/jszip/jszip.min.js');
exists('vendor/tailwind/tailwindcdn.js');
exists('vendor/lucide/lucide.min.js');
exists('vendor/mermaid/mermaid.min.js');
exists('vendor/netlify-identity/netlify-identity-widget.js');
exists('SkyesOverLondon.html');
exists('skyesoverlondon.html');
exists('skaixuide/index.html');
exists('GotSOLE/index.html');

htmlRefs('index.html');
htmlRefs('skAIxuide/index.html');
htmlRefs('skAIxuide/login.html');
htmlRefs('skAIxuide/admin_panel.html');
htmlRefs('skAIxuide/diagnostics.html');
htmlRefs('skAIxuide/SmartIDE.html');
htmlRefs('skAIxuide/SkyesOverLondon.html');
htmlRefs('skAIxuide/Features&Specs.html');
htmlRefs('skAIxuide/tutorial.html');
htmlRefs('skAIxuide/CODEPULSE.html');

contains('index.html', 'dataset.smokeSurface');
contains('index.html', 'setLauncherSmokeState');
contains('skAIxuide/index.html', 'data-smoke-ready="booting"');
contains('skAIxuide/index.html', 'setIdeSmokeState');
contains('scripts/smoke-interactions-playwright.mjs', 'launcher-degraded');
contains('scripts/smoke-interactions-playwright.mjs', 'skaixuide-degraded');
contains('netlify/functions/_lib/kaixu-openai.js', 'callFailoverGateway');
contains('netlify/functions/runtime-status.js', 'missing_env');
contains('.env.example', 'KAIXU_FAILOVER_GATEWAY_URL');
contains('package.json', 'verify:prod-env');
contains('package.json', 'verify:release-package');
contains('package.json', 'verify:server');
contains('scripts/smoke-server.mjs', 'workspace-projects-contract');
contains('scripts/smoke-server.mjs', 'static-path-traversal-blocked');
contains('netlify/functions/_lib/kaixu-platform.js', 'App state exceeds');
contains('netlify/functions/_lib/kaixu-platform.js', 'normalizeAppStateKey');

await importModule('netlify/functions/logs.js');
await importModule('netlify/functions/identity-login.js');
await importModule('netlify/functions/identity-signup.js');
await importModule('server.js');

for (const item of checked) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.message}`);
}

if (failures.length) {
  console.error(`\nRelease readiness failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nRelease readiness checks passed.');
