import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runBrowserSmoke() {
  const output = execFileSync('python3', [path.join(__dirname, 'browser-smoke-real.py')], {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..')
  });
  return JSON.parse(output);
}

if (process.argv[1] === __filename) {
  runBrowserSmoke().then((result) => {
    console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
