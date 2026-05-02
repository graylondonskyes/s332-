import fs from 'fs';
import path from 'path';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });

const dynastyRoot = path.resolve(root, '..', '..', 'Dynasty-Versions');
const registryPath = path.join(dynastyRoot, 'platform', 'user-platforms', 'REGISTRY.json');
const manifestPath = path.join(dynastyRoot, 'platform', 'user-platforms', 'skyeroutex-workforce-command', 'skyehands.platform.json');
const slug = 'skyeroutex-workforce-command';

function assert(condition, message, data) {
  if (!condition) {
    const error = new Error(message);
    error.data = data;
    throw error;
  }
}

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

try {
  assert(fs.existsSync(registryPath), 'SkyeHands registry missing', { registryPath });
  assert(fs.existsSync(manifestPath), 'SkyeHands platform manifest missing', { manifestPath });
  pass('registry_and_manifest_files_exist', { registryPath, manifestPath });

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const row = registry.platforms.find(platform => platform.slug === slug);
  assert(row, 'Registry row missing for workforce command', registry.platforms.map(platform => platform.slug));
  assert(row.manifestPath === 'platform/user-platforms/skyeroutex-workforce-command/skyehands.platform.json', 'Registry manifest path mismatch', row);
  pass('registry_row_points_to_workforce_manifest', row);

  assert(manifest.slug === slug && manifest.displayName === 'SkyeRoutex Workforce Command', 'Manifest identity mismatch', manifest);
  assert(manifest.sourceRoot === '../AbovetheSkye-Platforms/skyeroutex-workforce-command-v0.4.0', 'Manifest sourceRoot mismatch', manifest);
  pass('manifest_identity_and_source_root_are_correct');

  const sourceRoot = path.resolve(dynastyRoot, manifest.sourceRoot);
  assert(sourceRoot === root && fs.existsSync(path.join(sourceRoot, 'package.json')), 'Manifest sourceRoot does not resolve to app package', { sourceRoot, root });
  pass('manifest_source_root_resolves_to_this_app', { sourceRoot });

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const smokeScripts = manifest.smokeProfiles.map(profile => profile.scriptName);
  assert(smokeScripts.every(script => pkg.scripts[script]), 'Manifest smoke profile script missing from package.json', { smokeScripts, scripts: Object.keys(pkg.scripts) });
  assert(manifest.launchProfiles.every(profile => profile.ready) && manifest.smokeProfiles.every(profile => profile.ready), 'Manifest has non-ready profiles', manifest.summary);
  pass('manifest_launch_and_smoke_profiles_are_ready', { launchProfiles: manifest.launchProfiles.length, smokeProfiles: manifest.smokeProfiles.length });

  proof.completed_at = new Date().toISOString();
  proof.status = 'PASS';
} catch (error) {
  proof.failed_at = new Date().toISOString();
  proof.status = 'FAIL';
  proof.failure = error.message;
  proof.data = error.data || null;
  console.error(error);
  process.exitCode = 1;
} finally {
  const out = path.join(proofDir, `SMOKE_SKYEHANDS_MOUNT_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`SkyeHands mount proof written: ${out}`);
  process.exit(process.exitCode || 0);
}
