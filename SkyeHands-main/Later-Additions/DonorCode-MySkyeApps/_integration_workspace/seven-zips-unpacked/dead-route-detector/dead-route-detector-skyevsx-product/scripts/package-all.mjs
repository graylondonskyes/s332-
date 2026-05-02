import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const productRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const distDir = path.join(productRoot, 'dist');
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const zipFolder = (sourcePath, targetFile) => {
  try {
    fs.rmSync(targetFile, { force: true });
  } catch {}
  execFileSync('zip', ['-qr', targetFile, path.basename(sourcePath)], {
    cwd: path.dirname(sourcePath),
    stdio: 'inherit'
  });
};

const run = (file, args = []) => {
  execFileSync('node', [file, ...args], { cwd: productRoot, stdio: 'inherit' });
};

const zipAsFolderName = (sourcePath, folderName, targetFile) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-route-detector-pack-'));
  const stagingRoot = path.join(tmpDir, folderName);
  fs.cpSync(sourcePath, stagingRoot, { recursive: true });
  try {
    fs.rmSync(targetFile, { force: true });
  } catch {}
  execFileSync('zip', ['-qr', targetFile, folderName], {
    cwd: tmpDir,
    stdio: 'inherit'
  });
};

run(path.join(productRoot, 'scripts', 'sync-browser-assets.mjs'));
run(path.join(productRoot, 'scripts', 'build-vsix.mjs'));
run(path.join(productRoot, 'scripts', 'smoke.mjs'), ['--skip-dist-checks']);

zipFolder(path.join(productRoot, 'extensions', 'dead-route-detector-skyevsx'), path.join(distDir, 'dead-route-detector-skyevsx-extension-source.zip'));
zipFolder(path.join(productRoot, 'webapp', 'dead-route-detector-skyevsx'), path.join(distDir, 'dead-route-detector-skyevsx-webapp.zip'));
zipFolder(path.join(productRoot, 'github', 'dead-route-detector-skyevsx'), path.join(distDir, 'dead-route-detector-skyevsx-github-wrapper.zip'));
zipAsFolderName(productRoot, 'dead-route-detector-skyevsx-product', path.join(distDir, 'dead-route-detector-skyevsx-product-full.zip'));

run(path.join(productRoot, 'scripts', 'smoke.mjs'));

console.log('Artifacts packaged in', distDir);
