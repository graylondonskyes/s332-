const { repoPath, loadManifest, writeJson, sha256File, ok } = require('./lib');
const manifest = loadManifest();
writeJson(repoPath('artifacts','protected-app-manifest.json'), { generated_at:new Date().toISOString(), targets: manifest.protected_app_targets.map((relPath)=>({ path:relPath, sha256:sha256File(repoPath(relPath)) })) });
ok(`[protected-app-manifest] PASS (${manifest.protected_app_targets.length} targets)`);
