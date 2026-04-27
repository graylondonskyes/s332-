const { spawnSync } = require('child_process');
const { repoPath, fail } = require('./lib');
const build = spawnSync('node',[repoPath('scripts','build-static.js')],{cwd:repoPath(),encoding:'utf8',stdio:'pipe'});
if (build.status !== 0) fail(build.stdout + build.stderr);
const result = spawnSync('python',[repoPath('scripts','run-ui-smoke.py')],{cwd:repoPath(),encoding:'utf8',stdio:'pipe'});
process.stdout.write(result.stdout||''); process.stderr.write(result.stderr||'');
if (result.status !== 0) fail(`[ui-smoke] FAIL\n${result.stdout}\n${result.stderr}`);
