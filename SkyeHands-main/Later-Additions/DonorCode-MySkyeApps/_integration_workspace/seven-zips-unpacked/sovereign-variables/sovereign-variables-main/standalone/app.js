
(function(){
  'use strict';

  const APP_ID = 'SovereignVariables';
  const STORAGE_KEY = 'sovereign.variables.v2';
  const LEGACY_STORAGE_KEY = 'sovereign.variables.v1';
  const INBOX_KEY = 'sovereign.variables.inbox.v1';
  const QUEUE_POLL_MS = 1500;
  const qs = new URLSearchParams(window.location.search);
  const wsId = qs.get('ws_id') || 'primary-workspace';
  const APP_PARTIAL_PATH = './partials/app-ui.html';
  const INTRO_DURATION = 4300;

  const FALLBACK_PARTIAL = document.currentScript && document.currentScript.dataset.fallback || null;

  let toastTimer = null;

  const vscodeHost = window.__SVS_VSCODE__ || null;
  const extensionHost = !!window.__SVS_EXTENSION_HOST__;

  function postToHost(message){
    if (!vscodeHost || typeof vscodeHost.postMessage !== 'function') return false;
    vscodeHost.postMessage(message);
    return true;
  }

  async function importNamedPayload(name, arrayBuffer){
    const lowerName = String(name || '').toLowerCase();
    if (lowerName.endsWith('.env') || lowerName.endsWith('.txt')) {
      const variables = parseEnvText(new TextDecoder().decode(new Uint8Array(arrayBuffer)));
      importVariableSnapshot({ projectName:String(name).replace(/\.[^.]+$/, '').replace(/[_-]+/g,' '), envName:'Imported Sheet', notes:`Imported from ${name}`, variables });
      enterApp();
      showToast('Imported env sheet.');
      return;
    }
    if (lowerName.endsWith('.json')) {
      const payload = JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer)));
      if (!Array.isArray(payload?.state?.projects)) throw new Error('Invalid JSON export.');
      appState = payload.state;
      saveState();
      enterApp();
      renderAll();
      showToast('Imported JSON package.');
      return;
    }
    if (!lowerName.endsWith('.skye')) throw new Error('Use .env, .txt, .json, or .skye imports only.');
    const bytes = new Uint8Array(arrayBuffer);
    const marker = new TextEncoder().encode('SKYESEC1');
    const hasMarker = bytes.length > marker.length + 1 && marker.every((v, i) => bytes[i] === v) && bytes[marker.length] === 0;
    if (!hasMarker) throw new Error('Invalid .skye package marker.');
    const envelope = JSON.parse(new TextDecoder().decode(bytes.slice(marker.length + 1)));
    if (!envelope?.payload?.primary) throw new Error('Invalid encrypted .skye payload.');
    const passphrase = prompt(`Passphrase for .skye import${envelope?.hint ? ` (hint: ${envelope.hint})` : ''}:`, '');
    if (!passphrase) throw new Error('Passphrase required.');
    const plain = await decryptText(envelope.payload.primary, passphrase.trim());
    const payload = JSON.parse(plain);
    if (!Array.isArray(payload?.state?.projects)) throw new Error('Invalid .skye state payload.');
    appState = payload.state;
    saveState();
    enterApp();
    renderAll();
    showToast('Imported encrypted .skye package.');
  }

  let queueTimer = null;
  let lastInboxFingerprint = '';
  let appState = {
    projects: [
      {
        id: 'proj_foundation',
        name: 'Foundation Vessel',
        environments: [
          { id: 'env_dev', name: 'Development', notes: 'Local-first operator surface.', variables: [{k:'APP_MODE', v:'local-first'}, {k:'WORKSPACE_ID', v: wsId}] },
          { id: 'env_prod', name: 'Production', notes: 'Populate your real shipping values when ready.', variables: [{k:'APP_MODE', v:'production'}] }
        ]
      }
    ],
    activeProjectId: 'proj_foundation',
    activeEnvId: 'env_dev'
  };

  function uid(prefix){
    if (window.crypto && crypto.randomUUID) return `${prefix}_${crypto.randomUUID().slice(0,8)}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }

  function safeText(value){
    return String(value || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s] || s));
  }

  function toastEl(){ return document.getElementById('toast'); }

  function showToast(message){
    const el = toastEl();
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.projects) && parsed.projects.length) {
        appState = {
          projects: parsed.projects,
          activeProjectId: parsed.activeProjectId || parsed.projects[0].id,
          activeEnvId: parsed.activeEnvId || parsed.projects[0].environments?.[0]?.id || ''
        };
      }
    } catch (err) {
      console.warn('Failed to load state', err);
    }
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  }

  function activeProject(){
    return appState.projects.find(p => p.id === appState.activeProjectId) || appState.projects[0] || null;
  }

  function activeEnv(){
    const project = activeProject();
    if (!project) return null;
    return project.environments.find(e => e.id === appState.activeEnvId) || project.environments[0] || null;
  }

  function stripWrappingQuotes(value){
    const trimmed = String(value || '').trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1,-1);
    }
    return trimmed;
  }

  function parseEnvText(text){
    return String(text || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('//'))
      .map(line => line.startsWith('export ') ? line.slice(7).trim() : line)
      .map(line => {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.+)$/);
        if (!match) return null;
        return { k: match[1].trim(), v: stripWrappingQuotes(match[2]) };
      })
      .filter(Boolean);
  }

  function readQueuedImports(){
    try {
      const raw = localStorage.getItem(INBOX_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Failed to read queued imports', err);
      return [];
    }
  }

  function writeQueuedImports(entries){
    if (!Array.isArray(entries) || !entries.length) {
      localStorage.removeItem(INBOX_KEY);
      return;
    }
    localStorage.setItem(INBOX_KEY, JSON.stringify(entries));
  }

  function queuedImportsFingerprint(entries){
    return JSON.stringify((entries || []).map(entry => `${entry?.id || ''}:${entry?.created_at || ''}:${entry?.title || ''}:${entry?.content || ''}`));
  }

  function queuedImportLabel(entry){
    return String(entry?.project_name || entry?.title || entry?.source || 'Queued Template').trim() || 'Queued Template';
  }

  function renderQueuedInbox(entries = readQueuedImports()){
    const queueCount = document.getElementById('queue-count');
    const queueStatus = document.getElementById('queue-status');
    const queueList = document.getElementById('queue-list');
    if (!queueCount || !queueStatus || !queueList) return;

    queueCount.textContent = String(entries.length);
    if (!entries.length) {
      queueStatus.textContent = 'Inbox clear. Shell handoffs auto-import here when the surface is open.';
      queueList.innerHTML = '';
      return;
    }

    queueStatus.textContent = `${entries.length} queued template${entries.length === 1 ? '' : 's'} ready for direct SovereignVariables ingest.`;
    queueList.innerHTML = entries.slice(0,4).map(entry => {
      const variableCount = parseEnvText(entry?.content || '').length;
      return `<div class="queue-item"><strong>${safeText(queuedImportLabel(entry))}</strong><span>${safeText(entry?.environment_name || entry?.source || 'Queued import')}</span><span>${variableCount} vars ready</span></div>`;
    }).join('');
  }

  function importVariableSnapshot(options){
    const projectName = String(options?.projectName || 'Imported Config').trim() || 'Imported Config';
    const envName = String(options?.envName || 'Imported').trim() || 'Imported';
    const notes = String(options?.notes || '').trim();
    const variables = Array.isArray(options?.variables) ? options.variables.filter(item => item?.k) : [];
    if (!variables.length) throw new Error('No variable entries found to import.');

    const envId = uid('env');
    const project = {
      id: uid('proj'),
      name: projectName,
      environments: [{ id: envId, name: envName, notes, variables }]
    };
    appState.projects.unshift(project);
    appState.activeProjectId = project.id;
    appState.activeEnvId = envId;
    saveState();
    renderAll();
    return project;
  }

  function consumeQueuedImports(options={}){
    try {
      const queued = readQueuedImports();
      if (!queued.length) {
        renderQueuedInbox([]);
        return 0;
      }
      const targetIds = Array.isArray(options?.ids) && options.ids.length ? new Set(options.ids) : null;
      const remaining = [];
      let imported = 0;

      for (const entry of queued) {
        if (targetIds && !targetIds.has(entry?.id)) { remaining.push(entry); continue; }
        const variables = parseEnvText(entry?.content || '');
        if (!variables.length) { remaining.push(entry); continue; }
        importVariableSnapshot({
          projectName: entry?.project_name || entry?.title || 'Queued Template',
          envName: entry?.environment_name || 'Draft Import',
          notes: `Queued from ${entry?.source || 'shell'} at ${entry?.created_at || new Date().toISOString()}`,
          variables
        });
        imported += 1;
      }

      writeQueuedImports(remaining);
      renderQueuedInbox(remaining);
      if (imported) showToast(`${options?.auto ? 'Auto-imported' : 'Imported'} ${imported} queued template${imported===1?'':'s'}.`);
      return imported;
    } catch (err) {
      console.warn('Failed to consume queued imports', err);
      return 0;
    }
  }

  function importQueuedNow(){
    const imported = consumeQueuedImports({ auto:false });
    if (!imported) showToast('No queued templates ready to import.');
  }

  function clearQueuedImports(){
    writeQueuedImports([]);
    renderQueuedInbox([]);
    showToast('Cleared queued intake.');
  }

  function syncQueuedImports(options={}){
    const queued = readQueuedImports();
    const fingerprint = queuedImportsFingerprint(queued);
    if (!options.force && fingerprint === lastInboxFingerprint) return;
    lastInboxFingerprint = fingerprint;
    renderQueuedInbox(queued);
    if (queued.length && options.auto) {
      consumeQueuedImports({ auto:true });
      const after = readQueuedImports();
      lastInboxFingerprint = queuedImportsFingerprint(after);
      renderQueuedInbox(after);
    }
  }

  function renderProjects(){
    const list = document.getElementById('project-list');
    if (!list) return;
    list.innerHTML = appState.projects.map(p => {
      const active = appState.activeProjectId === p.id;
      return `<div class="project-card ${active ? 'active' : ''}" onclick="selectProject('${p.id}')"><div class="project-name">${safeText(p.name)}</div><div class="project-meta">${p.environments.length} env${p.environments.length===1?'':'s'} · local vessel</div></div>`;
    }).join('');
  }

  function renderTabs(){
    const container = document.getElementById('env-tabs');
    const project = activeProject();
    if (!container || !project) return;
    container.innerHTML = project.environments.map(e => `<div class="env-tab ${appState.activeEnvId===e.id ? 'active' : ''}" onclick="selectEnv('${e.id}')">${safeText(e.name)}</div>`).join('');
  }

  function updateOutput(env){
    const out = env.variables.map(v => `${v.k}=${v.v}`).join('\n');
    const el = document.getElementById('raw-output');
    if (el) el.textContent = out || '# No variables defined';
  }

  function renderVariables(){
    const list = document.getElementById('variable-list');
    const env = activeEnv();
    if (!list || !env) return;

    const title = document.getElementById('env-title');
    const notes = document.getElementById('env-notes');
    if (title) title.textContent = env.name;
    if (notes) {
      notes.value = env.notes || '';
      notes.oninput = () => {
        const current = activeEnv();
        if (!current) return;
        current.notes = notes.value;
        saveState();
      };
    }

    if (!env.variables.length) {
      list.innerHTML = `<div class="empty-vars">No variables in this environment yet. Add keys, import a sheet, or route queued intake into the surface.</div>`;
      updateOutput(env);
      return;
    }

    list.innerHTML = env.variables.map((v,i) => `
      <div class="var-row">
        <input type="text" value="${safeText(v.k)}" oninput="updateVar(${i}, 'k', this.value)" placeholder="KEY" />
        <input type="text" value="${safeText(v.v)}" oninput="updateVar(${i}, 'v', this.value)" placeholder="VALUE" />
        <button class="danger-btn var-remove" type="button" onclick="removeVar(${i})">Remove</button>
      </div>
    `).join('');
    updateOutput(env);
  }

  function renderAll(){
    renderProjects();
    renderTabs();
    renderVariables();
    renderQueuedInbox();
    updateNetworkPill();
  }

  function selectProject(id){
    appState.activeProjectId = id;
    const project = appState.projects.find(p => p.id === id);
    appState.activeEnvId = project?.environments?.[0]?.id || '';
    saveState();
    renderAll();
  }

  function selectEnv(id){
    appState.activeEnvId = id;
    saveState();
    renderAll();
  }

  function addVariable(){
    const env = activeEnv();
    if (!env) return;
    env.variables.push({k:'', v:''});
    saveState();
    renderVariables();
  }

  function updateVar(index, field, value){
    const env = activeEnv();
    if (!env || !env.variables[index]) return;
    env.variables[index][field] = value;
    saveState();
    updateOutput(env);
  }

  function removeVar(index){
    const env = activeEnv();
    if (!env) return;
    env.variables.splice(index,1);
    saveState();
    renderVariables();
  }

  function clearCurrentEnv(){
    const env = activeEnv();
    if (!env) return;
    if (!confirm(`Clear all variables from ${env.name}?`)) return;
    env.variables = [];
    saveState();
    renderVariables();
    showToast('Environment cleared.');
  }

  function createNewProject(){
    const name = prompt('Project name?', `Vessel ${appState.projects.length + 1}`);
    if (!name || !name.trim()) return;
    const envId = uid('env');
    const project = { id: uid('proj'), name: name.trim(), environments: [{ id: envId, name: 'Development', notes: '', variables: [] }] };
    appState.projects.unshift(project);
    appState.activeProjectId = project.id;
    appState.activeEnvId = envId;
    saveState();
    enterApp();
    renderAll();
    showToast('Vessel created.');
  }

  function createNewEnv(){
    const project = activeProject();
    if (!project) return;
    const name = prompt('Environment name?', `Env ${project.environments.length + 1}`);
    if (!name || !name.trim()) return;
    const env = { id: uid('env'), name: name.trim(), notes:'', variables:[] };
    project.environments.push(env);
    appState.activeEnvId = env.id;
    saveState();
    renderAll();
    showToast('Environment created.');
  }

  function renameActiveProject(){
    const project = activeProject();
    if (!project) return;
    const next = prompt('Rename vessel?', project.name);
    if (!next || !next.trim()) return;
    project.name = next.trim();
    saveState();
    renderProjects();
    showToast('Vessel renamed.');
  }

  function renameActiveEnv(){
    const env = activeEnv();
    if (!env) return;
    const next = prompt('Rename environment?', env.name);
    if (!next || !next.trim()) return;
    env.name = next.trim();
    saveState();
    renderTabs();
    renderVariables();
    showToast('Environment renamed.');
  }

  function bytesToBase64(bytes){
    let bin = '';
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function base64ToBytes(value){
    const bin = atob(value);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deriveKey(passphrase, saltBytes){
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'PBKDF2', salt:saltBytes, iterations:120000, hash:'SHA-256' }, material, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
  }

  async function encryptText(plainText, passphrase){
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const cipherBuffer = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(plainText));
    return { salt: bytesToBase64(salt), iv: bytesToBase64(iv), cipher: bytesToBase64(new Uint8Array(cipherBuffer)), alg:'AES-GCM', kdf:'PBKDF2-SHA256', iterations:120000 };
  }

  async function decryptText(payload, passphrase){
    const salt = base64ToBytes(payload.salt);
    const iv = base64ToBytes(payload.iv);
    const cipherBytes = base64ToBytes(payload.cipher);
    const key = await deriveKey(passphrase, salt);
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, cipherBytes);
    return new TextDecoder().decode(plain);
  }

  function skyeEnvelope(payload, hint){
    return { version:1, hint: hint || '', payload: { primary: payload } };
  }


  async function downloadBlob(blob, name){
    if (extensionHost) {
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
      if (postToHost({ type:'saveFile', name, mime: blob.type || 'application/octet-stream', bytes })) {
        showToast(`Save requested for ${name}.`);
        return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function getAuthHeaders(){ return { 'Content-Type':'application/json' }; }

  async function callApi(path, body){
    if (!navigator.onLine) throw new Error('You are offline. This routing lane only works when online.');
    const res = await fetch(path, { method:'POST', headers:getAuthHeaders(), body: JSON.stringify(body) });
    if (!res.ok) {
      const message = await res.text().catch(() => 'Request failed.');
      throw new Error(message || `Request failed (${res.status}).`);
    }
    const text = await res.text();
    try { return text ? JSON.parse(text) : {}; } catch { return text; }
  }

  async function recordSuiteIntent(){ return null; }

  function updateNetworkPill(){
    const el = document.getElementById('network-pill');
    if (!el) return;
    const online = navigator.onLine;
    el.className = `pill ${online ? 'online' : 'offline'}`;
    el.textContent = online ? 'Online lanes available' : 'Offline-first';
  }

  function enterApp(){
    const landing = document.getElementById('landing-view');
    const app = document.getElementById('app-view');
    if (landing) landing.classList.add('hidden');
    if (app) app.classList.remove('hidden');
    document.body.classList.add('app-ready');
  }

  function exitApp(){
    const landing = document.getElementById('landing-view');
    const app = document.getElementById('app-view');
    if (landing) landing.classList.remove('hidden');
    if (app) app.classList.add('hidden');
  }

  async function exportData(){
    const project = activeProject();
    const env = activeEnv();
    if (!project || !env) return;
    const mode = (prompt('Export format: env, json, skye', 'skye') || 'skye').trim().toLowerCase();
    const base = `${project.name}-${env.name}`.replace(/\s+/g,'_');
    if (mode === 'env') {
      const text = env.variables.map(v => `${v.k}=${v.v}`).join('\n');
      downloadBlob(new Blob([text], {type:'text/plain;charset=utf-8'}), `${base}.env`);
      showToast('Exported .env file.');
      return;
    }
    const payload = { meta:{ app_id:APP_ID, workspace_id:wsId, exported_at:new Date().toISOString() }, state:{ projects:appState.projects, activeProjectId:appState.activeProjectId, activeEnvId:appState.activeEnvId } };
    if (mode === 'json') {
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'}), `${base}.json`);
      showToast('Exported JSON package.');
      return;
    }
    const passphrase = prompt('Passphrase for encrypted .skye export (min 6 chars):','');
    if (!passphrase || passphrase.trim().length < 6) { showToast('Passphrase required for .skye export.'); return; }
    const hint = prompt('Passphrase hint (optional):','') || '';
    const encrypted = await encryptText(JSON.stringify(payload), passphrase.trim());
    const envelope = skyeEnvelope(encrypted, hint.trim());
    const marker = new TextEncoder().encode('SKYESEC1');
    const body = new TextEncoder().encode(JSON.stringify(envelope));
    const blob = new Blob([marker, new Uint8Array([0]), body], { type:'application/octet-stream' });
    downloadBlob(blob, `${base}.skye`);
    showToast('Exported encrypted .skye package.');
  }


  function importData(){
    if (extensionHost && postToHost({ type:'openFile' })) {
      showToast('Choose a file to import.');
      return;
    }
    const input = document.getElementById('import-file');
    if (input) input.click();
  }


  async function handleImportFile(event){
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await importNamedPayload(file.name, await file.arrayBuffer());
    } catch (err) {
      alert(err?.message || String(err));
    }
  }

  async function pushToSkyeChat(){
    const project = activeProject();
    const env = activeEnv();
    if (!project || !env) return;
    const channel = prompt('SkyeChat channel?', 'community');
    if (!channel || !channel.trim()) return;
    const body = env.variables.map(v => `${v.k}=${v.v}`).join('\n').slice(0, 1600);
    try {
      await callApi('/api/skychat-notify', { ws_id:wsId, channel:channel.trim(), topic:'variables', source:'SovereignVariables', message:`[SovereignVariables] ${project.name}/${env.name}\n\n${body || '(no variables)'}` });
      await recordSuiteIntent('open-thread','completed',{});
      showToast('Pushed to SkyeChat.');
    } catch (err) {
      alert(err?.message || String(err));
    }
  }

  async function pushToSkyeMail(){
    const project = activeProject();
    const env = activeEnv();
    if (!project || !env) return;
    const to = prompt('Recipient email?', '');
    if (!to || !to.trim()) return;
    const subject = `[SovereignVariables] ${project.name} / ${env.name}`;
    const text = env.variables.map(v => `${v.k}=${v.v}`).join('\n') || '(no variables)';
    try {
      await callApi('/api/skymail-send', { ws_id:wsId, to:to.trim().toLowerCase(), subject, text });
      await recordSuiteIntent('compose-mail','completed',{});
      showToast('Pushed to SkyeMail.');
    } catch (err) {
      alert(err?.message || String(err));
    }
  }

  async function mountUiPartial(){
    const host = document.getElementById('ui-host');
    if (!host) return;
    try {
      const res = await fetch(APP_PARTIAL_PATH, { cache:'no-cache' });
      if (!res.ok) throw new Error(`Partial load failed (${res.status})`);
      host.innerHTML = await res.text();
    } catch (err) {
      console.warn('Falling back to inline partial', err);
      host.innerHTML = `<div class="shell">
  <header class="surface-header">
    <div class="brand-wrap">
      <img class="brand-logo" src="./SKYESOVERLONDONDIETYLOGO.png" alt="Skyes Over London logo" />
      <div class="brand-copy">
        <div class="eyebrow">Skyes Over London LC</div>
        <div class="brand-title">Sovereign Variables</div>
        <div class="brand-sub">Offline-first environment vessel + encrypted config packaging</div>
      </div>
    </div>
    <div class="header-actions">
      <div id="network-pill" class="pill offline">Offline-first</div>
      <button class="ghost-btn" type="button" onclick="exitApp()">Home</button>
      <button class="primary-btn" type="button" onclick="enterApp()">Open Surface</button>
    </div>
  </header>

  <main id="landing-view" class="view">
    <section class="surface-hero">
      <article class="hero-copy">
        <div class="eyebrow">Branded spectacle · local-first</div>
        <h1 class="hero-title">Vault your <em>variables</em>.</h1>
        <p class="hero-body">Sovereign Variables is now structured as a modular Skyes Over London surface. The live background runs from its own <code>background.html</code> lane, the app UI is injected as a partial, and the working surface stays focused on encrypted exports, clean environment sets, and fast local packaging.</p>
        <div class="hero-badges">
          <span class="badge">Offline-capable</span>
          <span class="badge">Encrypted .skye export</span>
          <span class="badge">Background lane separated</span>
          <span class="badge">PWA installable</span>
        </div>
        <div class="hero-actions">
          <button class="primary-btn" type="button" onclick="enterApp()">Enter Surface</button>
          <button class="ghost-btn" type="button" onclick="createNewProject()">New Vessel</button>
          <button class="ghost-btn" type="button" onclick="importData()">Import Package</button>
        </div>
      </article>
      <aside class="hero-card">
        <div>
          <div class="hero-kicker">Skyes Over London spectacle layer</div>
          <img class="hero-logo" src="./SKYESOVERLONDONDIETYLOGO.png" alt="Skyes Over London logo" />
        </div>
        <p class="hero-note">This refit keeps the app local-first and avoids forcing extra plumbing. Online push lanes remain optional, but the core vessel builder, notes, encrypted export flow, and package import flow live entirely on-device.</p>
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-label">Primary mode</div>
            <div class="stat-value">Local</div>
            <div class="stat-copy">Runs without Neon or server wiring.</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Export lane</div>
            <div class="stat-value">.skye</div>
            <div class="stat-copy">AES-GCM encrypted package support.</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Surface pattern</div>
            <div class="stat-value">Modular</div>
            <div class="stat-copy">Background and UI are cleanly separated.</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Branding</div>
            <div class="stat-value">SVS</div>
            <div class="stat-copy">Logo, spectacle, and source-doc intro language preserved.</div>
          </div>
        </div>
      </aside>
    </section>
  </main>

  <main id="app-view" class="view hidden">
    <section class="workspace-grid">
      <aside class="panel sidebar-stack">
        <div class="queue-card">
          <div class="queue-top">
            <strong class="panel-title">Queued Intake</strong>
            <span id="queue-count" class="queue-count">0</span>
          </div>
          <div id="queue-status" class="panel-sub">Inbox clear. Shell handoffs auto-import here when the surface is open.</div>
          <div id="queue-list"></div>
          <div class="toolbar">
            <button class="primary-btn" type="button" onclick="importQueuedNow()">Import Queued</button>
            <button class="ghost-btn" type="button" onclick="clearQueuedImports()">Clear</button>
          </div>
        </div>

        <div class="panel surface-block" style="padding:0; background:transparent; border:0; box-shadow:none; backdrop-filter:none;">
          <div class="panel" style="padding:18px; flex:1; display:flex; flex-direction:column; min-height:0;">
            <div class="panel-head">
              <div>
                <div class="panel-title">Vessels</div>
                <div class="panel-sub">Projects stay local unless you explicitly export or route them out.</div>
              </div>
            </div>
            <div id="project-list" class="scroll"></div>
            <button class="ghost-btn" type="button" onclick="createNewProject()" style="margin-top:14px; width:100%; justify-content:center;">New Vessel</button>
          </div>
        </div>
      </aside>

      <section class="main-stack">
        <div class="panel env-strip">
          <div id="env-tabs" style="display:flex; gap:8px;"></div>
          <button class="ghost-btn" type="button" onclick="createNewEnv()">+ Env</button>
        </div>

        <div class="editor-grid">
          <section class="panel surface-block">
            <div class="editor-head">
              <div>
                <h2 id="env-title" class="editor-title">Environment</h2>
                <div class="editor-status">Autosaved locally</div>
              </div>
              <div class="toolbar">
                <button class="primary-btn" type="button" onclick="addVariable()">+ Variable</button>
                <button class="ghost-btn" type="button" onclick="renameActiveProject()">Rename Vessel</button>
                <button class="ghost-btn" type="button" onclick="renameActiveEnv()">Rename Env</button>
              </div>
            </div>
            <div class="vars-head">
              <div>Key</div>
              <div>Value</div>
              <div>Remove</div>
            </div>
            <div id="variable-list" class="scroll"></div>
          </section>

          <aside class="meta-stack">
            <section class="panel surface-block">
              <div class="panel-head">
                <div>
                  <div class="panel-title">Meta Notes</div>
                  <div class="panel-sub">Store handoff notes, links, and operator context per environment.</div>
                </div>
              </div>
              <textarea id="env-notes" class="notes-area" placeholder="Environment descriptions, service links, operator notes..."></textarea>
            </section>

            <section class="panel surface-block">
              <div class="panel-head">
                <div>
                  <div class="panel-title">Quick Copy (.env)</div>
                  <div class="panel-sub">Tap the panel to copy the active environment.</div>
                </div>
              </div>
              <pre id="raw-output" class="copy-output"># No variables defined</pre>
            </section>

            <section class="panel surface-block">
              <div class="panel-head">
                <div>
                  <div class="panel-title">Export + Route</div>
                  <div class="panel-sub">Core packaging stays local. External routing is optional.</div>
                </div>
              </div>
              <div class="toolbar">
                <button class="primary-btn" type="button" onclick="exportData()">Export</button>
                <button class="ghost-btn" type="button" onclick="importData()">Import</button>
                <button class="ghost-btn" type="button" onclick="pushToSkyeChat()">Push Chat</button>
                <button class="ghost-btn" type="button" onclick="pushToSkyeMail()">Push Email</button>
                <button class="danger-btn" type="button" onclick="clearCurrentEnv()">Clear Env</button>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </section>
  </main>

  <input id="import-file" type="file" accept=".json,.skye,.env,.txt" class="hidden" onchange="handleImportFile(event)" />
  <div id="toast" class="toast"></div>
</div>`;
    }
  }

  function initIntro(){
    const intro = document.getElementById('s0l26-intro');
    const canvas = document.getElementById('s0l-intro-canvas');
    if (!intro || !canvas) return;
    const ctx = canvas.getContext('2d');
    let w=0,h=0,dpr=1,stars=[];
    function resize(){
      dpr = Math.min(window.devicePixelRatio||1,2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w*dpr; canvas.height = h*dpr;
      canvas.style.width = w+'px'; canvas.style.height = h+'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
      stars = Array.from({length:Math.max(140, Math.floor(w/9))}, () => ({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.5+.25,a:Math.random()*.8+.08,s:Math.random()*.16+.03,p:Math.random()*Math.PI*2}));
    }
    function frame(t){
      ctx.clearRect(0,0,w,h);
      const bg = ctx.createLinearGradient(0,0,0,h);
      bg.addColorStop(0,'#03030a'); bg.addColorStop(1,'#070712');
      ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
      [['141,88,255',w*.22,h*.22,w*.28,.18],['49,231,255',w*.82,h*.18,w*.22,.12],['255,211,106',w*.5,h*.88,w*.3,.08]].forEach(([c,x,y,r,a]) => {
        const g = ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,`rgba(${c},${a})`); g.addColorStop(.5,`rgba(${c},${a*.35})`); g.addColorStop(1,`rgba(${c},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      });
      stars.forEach(s=>{
        s.y += s.s; if(s.y>h+2) s.y=-2;
        ctx.fillStyle = `rgba(255,255,255,${s.a*(.55+.45*Math.sin((t||0)*.0015+s.p))})`;
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
      });
      if (!intro.classList.contains('exit')) requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
    setTimeout(() => intro.classList.add('exit'), INTRO_DURATION);
    setTimeout(() => intro.remove(), INTRO_DURATION + 850);
  }

  async function setup(){
    await mountUiPartial();
    loadState();
    syncQueuedImports({ auto:true, force:true });
    renderAll();
    initIntro();

    const out = document.getElementById('raw-output');
    if (out) {
      out.addEventListener('click', async () => {
        const env = activeEnv();
        const text = env ? env.variables.map(v => `${v.k}=${v.v}`).join('\n') : '';
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          showToast('Copied .env output.');
        } catch (err) {
          console.warn(err);
        }
      });
    }

    window.addEventListener('storage', (event) => { if (event.key === INBOX_KEY) syncQueuedImports({ auto:true, force:true }); });
    window.addEventListener('focus', () => syncQueuedImports({ auto:true, force:true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncQueuedImports({ auto:true, force:true }); });

    queueTimer = window.setInterval(() => syncQueuedImports({ auto:true }), QUEUE_POLL_MS);
    window.addEventListener('message', async (event) => {
      const msg = event?.data || {};
      try {
        if (msg.type === 'openedFile' && Array.isArray(msg.bytes)) {
          await importNamedPayload(msg.name || 'imported-file', Uint8Array.from(msg.bytes).buffer);
          return;
        }
        if (msg.type === 'savedFile') {
          showToast(msg.path ? `Saved to ${msg.path}` : 'File saved.');
          return;
        }
        if (msg.type === 'hostError') {
          alert(msg.message || 'Host operation failed.');
        }
      } catch (err) {
        alert(err?.message || String(err));
      }
    });
    window.addEventListener('online', updateNetworkPill);
    window.addEventListener('offline', updateNetworkPill);
    updateNetworkPill();

    if ('serviceWorker' in navigator && !extensionHost) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW failure', err));
      }, { once:true });
    }
  }

  Object.assign(window, {
    enterApp, exitApp, renderAll, renderProjects, renderTabs, renderVariables,
    selectProject, selectEnv, addVariable, updateVar, removeVar, clearCurrentEnv,
    createNewProject, createNewEnv, renameActiveProject, renameActiveEnv,
    exportData, importData, handleImportFile, pushToSkyeChat, pushToSkyeMail,
    importQueuedNow, clearQueuedImports
  });

  document.addEventListener('DOMContentLoaded', setup);
})();
