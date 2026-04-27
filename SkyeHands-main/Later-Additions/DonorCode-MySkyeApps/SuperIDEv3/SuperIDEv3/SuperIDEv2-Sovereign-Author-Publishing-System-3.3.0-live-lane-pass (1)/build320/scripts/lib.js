const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
function repoPath(...segments){ return path.join(root, ...segments); }
function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeJson(filePath, value){ fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function sha256File(filePath){ return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'); }
function walk(dirPath){ const out=[]; for(const entry of fs.readdirSync(dirPath,{withFileTypes:true})){ const full=path.join(dirPath,entry.name); if(entry.isDirectory()) out.push(...walk(full)); else out.push(full);} return out; }
function ensureCleanDir(dirPath){ fs.rmSync(dirPath,{recursive:true,force:true}); fs.mkdirSync(dirPath,{recursive:true}); }
function copyDir(source,target){ fs.mkdirSync(target,{recursive:true}); for(const entry of fs.readdirSync(source,{withFileTypes:true})){ const from=path.join(source,entry.name); const to=path.join(target,entry.name); if(entry.isDirectory()) copyDir(from,to); else fs.copyFileSync(from,to);} }
function loadManifest(){ return readJson(repoPath('config','release-manifest.json')); }
function canonicalFiles(){ const manifest=loadManifest(); const files=[]; for(const item of manifest.canonical_release_roots){ const full=repoPath(item); if(!fs.existsSync(full)) continue; const stat=fs.statSync(full); if(stat.isDirectory()) files.push(...walk(full)); else files.push(full);} return files.filter((file) => !manifest.excluded_roots.some((excluded)=>{ const ex=repoPath(excluded); return file===ex || file.startsWith(`${ex}${path.sep}`);})); }
function runNpmScript(label, scriptName){ const startedAt=Date.now(); const result=spawnSync('npm',['run',scriptName],{cwd:root,encoding:'utf8',stdio:'pipe'}); return { id:label, ok:result.status===0, exit_code:result.status ?? 1, duration_ms:Date.now()-startedAt, stdout:result.stdout||'', stderr:result.stderr||'' }; }
function fail(message){ console.error(message); process.exit(1); }
function ok(message){ console.log(message); }
module.exports = { root, repoPath, readJson, writeJson, sha256File, walk, ensureCleanDir, copyDir, loadManifest, canonicalFiles, runNpmScript, fail, ok };
