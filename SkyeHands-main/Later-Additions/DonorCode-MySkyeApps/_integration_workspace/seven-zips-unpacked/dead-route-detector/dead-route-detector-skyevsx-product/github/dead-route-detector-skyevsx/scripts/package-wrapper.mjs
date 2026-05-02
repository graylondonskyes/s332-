import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const wrapperRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const distDir = path.join(wrapperRoot, 'dist');
fs.mkdirSync(distDir, { recursive: true });

const output = path.join(distDir, 'dead-route-detector-skyevsx-github-wrapper.zip');
try {
  fs.rmSync(output, { force: true });
} catch {}

execFileSync('zip', ['-qr', output, '.'], { cwd: wrapperRoot, stdio: 'inherit' });
console.log(output);
