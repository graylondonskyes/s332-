import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];
const checked = [];

function record(ok, message) {
  checked.push({ ok, message });
  if (!ok) failures.push(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath) {
  const ok = fs.existsSync(path.join(root, relPath));
  record(ok, `${ok ? 'OK' : 'MISSING'} ${relPath}`);
  return ok;
}

const manifestPath = 'assets/skins/skins.json';
exists('index.html');
exists('assets/style.css');
exists('assets/skins/skins.css');
exists('assets/skins/skin-loader.js');
exists('docs/SKIN_SYSTEM.md');
exists(manifestPath);

const manifest = JSON.parse(read(manifestPath));
record(manifest.storage_key === 'SKYEGATEFS13_SKIN', 'manifest storage key is stable');
record(manifest.default === 'classic', 'classic is default skin');

const html = read('index.html');
record(html.includes('assets/skins/skins.css'), 'index loads shared skin CSS');
record(html.includes('assets/skins/skin-loader.js'), 'index loads skin loader');
record(html.includes('id="skinSelect"'), 'index includes skin selector');
record(html.includes("dataset.skyeSkin"), 'index applies skin before render');

const loader = read('assets/skins/skin-loader.js');
record(loader.includes('window.SkyeGateSkins'), 'loader exposes SkyeGateSkins API');
record(loader.includes(manifest.storage_key), 'loader uses manifest storage key');

const skinSelectHtml = html.match(/<select id="skinSelect"[\s\S]*?<\/select>/)?.[0] || '';
const optionIds = Array.from(skinSelectHtml.matchAll(/<option value="([^"]+)"/g)).map((match) => match[1]);
const manifestIds = manifest.skins.map((skin) => skin.id);
record(JSON.stringify(optionIds) === JSON.stringify(manifestIds), 'selector options match manifest order');

for (const skin of manifest.skins) {
  exists(skin.file);
  if (skin.id === 'classic') continue;
  const css = read(skin.file);
  record(css.includes(`html[data-skye-skin="${skin.id}"]`), `${skin.id} CSS is scoped`);
  record(!/^body\s*\{/m.test(css), `${skin.id} CSS does not override global body unscoped`);
}

for (const item of checked) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.message}`);
}

if (failures.length) {
  console.error(`\nSkin verification failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nSkin verification passed.');
