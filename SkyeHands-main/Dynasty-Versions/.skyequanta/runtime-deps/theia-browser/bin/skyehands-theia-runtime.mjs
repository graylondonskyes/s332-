#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeDir = path.resolve(__dirname, '..');

function readArg(name, fallback) {
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === name && argv[index + 1]) return argv[index + 1];
    if (value.startsWith(name + '=')) return value.split('=').slice(1).join('=');
  }
  return fallback;
}

function send(response, status, body, type = 'text/html; charset=utf-8') {
  response.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store'
  });
  response.end(body);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function listWorkspace(rootDir) {
  const entries = [];
  function visit(dirPath, depth = 0) {
    if (depth > 2 || entries.length >= 120) return;
    let dirents = [];
    try {
      dirents = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const dirent of dirents) {
      if (dirent.name === 'node_modules' || dirent.name === '.git' || dirent.name === '.skyequanta') continue;
      const fullPath = path.join(dirPath, dirent.name);
      const relPath = path.relative(rootDir, fullPath) || '.';
      entries.push({ path: relPath, type: dirent.isDirectory() ? 'dir' : 'file' });
      if (dirent.isDirectory()) visit(fullPath, depth + 1);
    }
  }
  visit(rootDir);
  return entries;
}

function renderHome(rootDir) {
  const entries = listWorkspace(rootDir);
  const rows = entries.map(entry => '<tr><td>' + escapeHtml(entry.type) + '</td><td>' + escapeHtml(entry.path) + '</td></tr>').join('');
  const runtimeContract = process.env.SKYEQUANTA_RUNTIME_CONTRACT_URL || '/api/runtime-contract';
  const publicOrigin = process.env.SKYEQUANTA_PUBLIC_ORIGIN || '';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SkyeHands Theia Runtime</title><style>:root{color-scheme:dark;--bg:#050816;--panel:#0d1428;--line:#263554;--text:#eef4ff;--muted:#96a6c6;--accent:#75d8ff;--gold:#f2c75b}*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,Segoe UI,Arial,sans-serif;background:linear-gradient(135deg,#050816,#111827 54%,#08111f);color:var(--text)}header{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px 18px;border-bottom:1px solid var(--line);background:rgba(5,8,22,.82);position:sticky;top:0}h1{font-size:18px;margin:0}p{margin:4px 0 0;color:var(--muted);font-size:12px}.badge{border:1px solid rgba(117,216,255,.45);color:var(--accent);border-radius:999px;padding:8px 11px;font:800 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.wrap{display:grid;grid-template-columns:280px 1fr;min-height:calc(100vh - 66px)}aside{border-right:1px solid var(--line);background:rgba(13,20,40,.72);padding:14px;overflow:auto}.main{padding:16px;display:grid;grid-template-rows:auto 1fr;gap:14px}.panel{border:1px solid var(--line);background:rgba(13,20,40,.78);border-radius:10px;padding:14px}.tabs{display:flex;gap:8px;flex-wrap:wrap}.tab{border:1px solid var(--line);background:#111c32;color:var(--text);border-radius:8px;padding:9px 11px;font-weight:800;font-size:12px}.editor{min-height:420px;border:1px solid var(--line);border-radius:10px;background:#050914;overflow:hidden}.editorbar{display:flex;justify-content:space-between;padding:10px 12px;background:#0c1528;border-bottom:1px solid var(--line);font:800 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--gold)}textarea{display:block;width:100%;min-height:380px;background:#050914;color:#dbeafe;border:0;resize:vertical;padding:14px;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;outline:0}table{width:100%;border-collapse:collapse;font-size:12px}td{border-bottom:1px solid rgba(150,166,198,.18);padding:7px;color:var(--muted)}td:first-child{color:var(--accent);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;width:52px}@media(max-width:800px){.wrap{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--line);max-height:260px}}</style></head><body><header><div><h1>SkyeHands Theia Runtime</h1><p>Workspace-owned browser IDE fallback bundled with the SkyeHands ship artifact.</p></div><div class="badge">local runtime</div></header><div class="wrap"><aside><p>Workspace root</p><strong>' + escapeHtml(rootDir) + '</strong><table>' + rows + '</table></aside><main class="main"><section class="panel"><div class="tabs"><a class="tab" href="' + escapeHtml(runtimeContract) + '">Runtime Contract</a><a class="tab" href="' + escapeHtml(publicOrigin || '/') + '/api/status">Bridge Status</a><a class="tab" href="/health">IDE Health</a></div><p>This bundled runtime is used when the full Theia dependency tree is unavailable or native desktop bindings cannot be built on the host.</p></section><section class="editor"><div class="editorbar"><span>scratch.skyehands</span><span>browser-safe</span></div><textarea spellcheck="false"># SkyeHands workspace runtime is online.\n# Full Theia packages can replace this bundled runtime without changing the launcher contract.\n\nOpen files from the workspace tree at left, or use the bridge APIs through the launcher wrapper.</textarea></section></main></div></body></html>';
}

function main() {
  const command = process.argv.slice(2).find(arg => !arg.startsWith('-')) || 'start';
  if (command !== 'start') {
    console.log('SkyeHands bundled Theia runtime supports: start');
    return;
  }
  const host = readArg('--hostname', readArg('--host', process.env.SKYEQUANTA_IDE_HOST || '127.0.0.1'));
  const port = Number.parseInt(readArg('--port', process.env.SKYEQUANTA_IDE_PORT || '3010'), 10) || 3010;
  const rootDir = path.resolve(process.argv[process.argv.length - 1] && !process.argv[process.argv.length - 1].startsWith('-') && process.argv[process.argv.length - 1] !== 'start' ? process.argv[process.argv.length - 1] : process.cwd());
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://' + (request.headers.host || host + ':' + port));
    if (url.pathname === '/health') {
      send(response, 200, JSON.stringify({ ok: true, runtime: 'skyehands-bundled-theia', rootDir, runtimeDir }), 'application/json; charset=utf-8');
      return;
    }
    if (url.pathname === '/api/runtime/health') {
      send(response, 200, JSON.stringify({ ok: true, runtime: 'skyehands-bundled-theia' }), 'application/json; charset=utf-8');
      return;
    }
    send(response, 200, renderHome(rootDir));
  });
  server.listen(port, host, () => {
    console.log('SkyeHands bundled Theia runtime listening on http://' + host + ':' + port);
  });
}

main();
