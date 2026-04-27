const fs = require('fs');
const { repoPath, fail, ok } = require('./lib');
const todo = fs.readFileSync(repoPath('docs','HARDENING_TODO.md'),'utf8');
const openP0 = [...todo.matchAll(/^- \[ \] P0:/gm)];
if (openP0.length) fail(`[hardening-todo] FAIL: ${openP0.length} P0 items remain open.`);
ok('[hardening-todo] PASS: no open P0 hardening items remain.');
