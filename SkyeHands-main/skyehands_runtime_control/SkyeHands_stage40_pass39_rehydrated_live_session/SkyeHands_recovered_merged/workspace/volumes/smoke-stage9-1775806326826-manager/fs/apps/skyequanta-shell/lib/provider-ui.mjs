function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildPageShell(title, body, extraData = {}) {
  const boot = escapeHtml(JSON.stringify(extraData));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:Arial,sans-serif;background:#09111d;color:#eef4ff;padding:24px;margin:0}
.hero,.panel{background:#101a2f;border:1px solid #233653;border-radius:18px;padding:18px;margin-bottom:18px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.stat{background:#16233a;border-radius:14px;padding:12px;border:1px solid #27405f}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
label{display:block;font-size:13px;color:#bcd2ff;margin-bottom:6px}
input,select,textarea,button{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid #294261;background:#0a1321;color:#eef4ff;padding:10px;font:inherit}
textarea{min-height:120px;resize:vertical}
button{cursor:pointer;background:#193252}
button.secondary{background:#13253d}
button.warn{background:#4d1e2d}
code,pre{background:#0a1321;border:1px solid #24344f;border-radius:14px;padding:14px;display:block;white-space:pre-wrap;word-break:break-word}
pre{max-height:320px;overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #24344f;text-align:left;vertical-align:top}
a{color:#cce2ff}.muted{color:#a9bddf}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions button{width:auto;padding:8px 10px}.pill{display:inline-block;padding:4px 8px;border-radius:999px;border:1px solid #2b4667;background:#12233b;margin:0 6px 6px 0;font-size:12px}.hidden{display:none}
</style>
</head>
<body data-provider-ui="${boot}">
${body}
</body>
</html>`;
}

function statsGrid(items) {
  return `<div class="stats">${items.map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>`;
}

function providerRows(profiles = [], bindings = []) {
  const bindingCounts = bindings.reduce((acc, item) => {
    acc[item.profileId] = (acc[item.profileId] || 0) + 1;
    return acc;
  }, {});
  return profiles.map(profile => `
<tr data-profile-id="${escapeHtml(profile.profileId)}">
<td><strong>${escapeHtml(profile.alias)}</strong><br><span class="muted">${escapeHtml(profile.profileId)}</span></td>
<td>${escapeHtml(profile.provider)}</td>
<td>${(profile.capabilities || []).map(item => `<span class="pill">${escapeHtml(item)}</span>`).join('')}</td>
<td>${escapeHtml(JSON.stringify(profile.accountHints || {}))}</td>
<td>${escapeHtml(String(bindingCounts[profile.profileId] || 0))}</td>
<td>${profile.lastVerifiedAt ? escapeHtml(profile.lastVerifiedAt) : '<span class="muted">not yet</span>'}</td>
<td class="actions">
<button type="button" class="secondary" data-action="load">Load</button>
<button type="button" class="secondary" data-action="test">Test</button>
<button type="button" class="secondary" data-action="discovery">Discover</button>
<button type="button" class="secondary" data-action="bootstrap">Discover + bind</button>
<button type="button" class="secondary" data-action="unlock">Unlock</button>
<button type="button" class="secondary" data-action="lock">Lock</button>
<button type="button" class="warn" data-action="delete">Delete</button>
</td>
</tr>`).join('') || '<tr><td colspan="7">No provider profiles yet.</td></tr>';
}

function bindingRows(bindings = []) {
  return bindings.map(binding => `
<tr data-binding-id="${escapeHtml(binding.bindingId)}">
<td><strong>${escapeHtml(binding.alias || '')}</strong><br><span class="muted">${escapeHtml(binding.bindingId)}</span></td>
<td>${escapeHtml(binding.provider)}</td>
<td>${escapeHtml(binding.bindingRole || '')}</td>
<td>${escapeHtml(binding.capability || '')}</td>
<td>${escapeHtml(binding.envTarget || '')}</td>
<td>${escapeHtml((binding.allowedActions || []).join(', '))}</td>
<td class="actions"><button type="button" class="warn" data-binding-action="delete">Delete</button></td>
</tr>`).join('') || '<tr><td colspan="7">No workspace bindings yet.</td></tr>';
}

function buildSharedUiScript() {
  return `<script>
(() => {
  const boot = JSON.parse(document.body.dataset.providerUi || '{}');
  const state = { profiles: boot.profiles || [], bindings: boot.bindings || [], catalog: boot.catalog || { providers: [] }, roles: boot.roleCatalog?.roles || [] };
  const el = id => document.getElementById(id);
  const result = el('provider-result');
  const tokenInput = el('auth-token');
  const providerSelect = el('provider-kind');
  const providerFields = el('provider-fields');
  const profilesTable = el('provider-profiles-body');
  const bindingsTable = el('provider-bindings-body');
  const profileIdInput = el('profile-id');
  const profileActionSelect = el('profile-action-target');
  const bindProfileSelect = el('bind-profile-id');
  const runtimeProfileSelect = el('runtime-profile-id');
  const roleSelect = el('binding-role');
  const capabilityInput = el('binding-capability');
  function headers(){ const token = tokenInput?.value?.trim(); return { 'content-type':'application/json', 'x-skyequanta-tenant-id': boot.tenantId || 'local', ...(token ? { authorization: 'Bearer ' + token } : {}) }; }
  function writeResult(payload){ if(result) result.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2); }
  function providerDefinition(kind){ return (state.catalog.providers || []).find(item => item.provider === kind) || null; }
  function renderProviderFields(){ if(!providerFields || !providerSelect) return; const definition = providerDefinition(providerSelect.value); if(!definition){ providerFields.innerHTML = ''; return; }
    providerFields.innerHTML = definition.fields.map(field => {
      const valueId = 'field-' + field.key;
      if(field.multiline){ return '<label for="'+valueId+'">'+field.label+'</label><textarea id="'+valueId+'" data-provider-field="'+field.key+'" placeholder="'+(field.placeholder || '')+'"></textarea>'; }
      return '<label for="'+valueId+'">'+field.label+'</label><input id="'+valueId+'" data-provider-field="'+field.key+'" placeholder="'+(field.placeholder || '')+'" type="'+(field.secret ? 'password' : 'text')+'">';
    }).join('');
    const role = definition.defaultBindingRoles?.[0] || 'runtime_env';
    if(roleSelect) roleSelect.value = role;
    if(capabilityInput) capabilityInput.value = definition.defaultCapabilities?.[0] || 'runtime';
  }
  function collectSecretPayload(){ const kind = providerSelect?.value; const definition = providerDefinition(kind); const payload = {}; if(!definition) return payload; definition.fields.forEach(field => { const node = document.querySelector('[data-provider-field="'+field.key+'"]'); if(!node) return; const value = node.value || ''; if(field.key === 'env'){ try { payload.env = value.trim() ? JSON.parse(value) : {}; } catch { throw new Error('Env JSON is invalid.'); } } else if(value.trim()) { payload[field.key] = value.trim(); } }); return payload; }
  async function fetchJson(url, options={}){ const response = await fetch(url, options); const text = await response.text(); let json = null; try { json = JSON.parse(text); } catch {} if(!response.ok){ throw new Error((json && (json.detail || json.error)) || text || 'Request failed'); } return json; }
  function syncSelectors(){ const options = ['<option value="">Select profile</option>'].concat(state.profiles.map(profile => '<option value="'+profile.profileId+'">'+profile.alias+' · '+profile.provider+'</option>')); if(bindProfileSelect) bindProfileSelect.innerHTML = options.join(''); if(runtimeProfileSelect) runtimeProfileSelect.innerHTML = options.join(''); if(profileActionSelect) profileActionSelect.innerHTML = options.join(''); }
  function renderTables(){ if(profilesTable){ profilesTable.innerHTML = (state.profiles || []).map(profile => { const bindingCount = (state.bindings || []).filter(binding => binding.profileId === profile.profileId).length; return '<tr data-profile-id="'+profile.profileId+'"><td><strong>'+profile.alias+'</strong><br><span class="muted">'+profile.profileId+'</span></td><td>'+profile.provider+'</td><td>'+(profile.capabilities || []).join(', ')+'</td><td>'+JSON.stringify(profile.accountHints || {})+'</td><td>'+bindingCount+'</td><td>'+(profile.lastVerifiedAt || 'not yet')+'</td><td class="actions"><button type="button" class="secondary" data-action="load">Load</button><button type="button" class="secondary" data-action="test">Test</button><button type="button" class="secondary" data-action="discovery">Discover</button><button type="button" class="secondary" data-action="bootstrap">Discover + bind</button><button type="button" class="secondary" data-action="unlock">Unlock</button><button type="button" class="secondary" data-action="lock">Lock</button><button type="button" class="warn" data-action="delete">Delete</button></td></tr>'; }).join('') || '<tr><td colspan="7">No provider profiles yet.</td></tr>'; }
    if(bindingsTable){ bindingsTable.innerHTML = (state.bindings || []).map(binding => '<tr data-binding-id="'+binding.bindingId+'"><td><strong>'+(binding.alias || '')+'</strong><br><span class="muted">'+binding.bindingId+'</span></td><td>'+binding.provider+'</td><td>'+(binding.bindingRole || '')+'</td><td>'+(binding.capability || '')+'</td><td>'+(binding.envTarget || '')+'</td><td>'+((binding.allowedActions || []).join(', '))+'</td><td class="actions"><button type="button" class="warn" data-binding-action="delete">Delete</button></td></tr>').join('') || '<tr><td colspan="7">No workspace bindings yet.</td></tr>'; }
    syncSelectors();
  }
  async function refresh(){ const [profiles, bindings] = await Promise.all([
    fetchJson('/api/providers?tenantId=' + encodeURIComponent(boot.tenantId || 'local'), { headers: headers() }),
    fetchJson('/api/workspaces/' + encodeURIComponent(boot.workspaceId || 'local-default') + '/provider-bindings', { headers: headers() })
  ]); state.profiles = profiles.profiles || []; state.bindings = bindings.bindings || []; renderTables(); return { profiles, bindings }; }
  async function saveProfile(bindAfter=false){ const payload = { provider: providerSelect.value, alias: el('provider-alias').value.trim(), description: el('provider-description').value.trim(), unlockSecret: el('provider-unlock-secret').value.trim(), secretPayload: collectSecretPayload(), scopesSummary: (el('provider-scopes').value || '').split(',').map(v => v.trim()).filter(Boolean), capabilities: (el('provider-capabilities').value || '').split(',').map(v => v.trim()).filter(Boolean), workspaceId: boot.workspaceId || 'local-default' };
    const profileId = profileIdInput?.value?.trim();
    const url = profileId ? '/api/providers/' + encodeURIComponent(profileId) : '/api/providers';
    const method = profileId ? 'PUT' : 'POST';
    const json = await fetchJson(url, { method, headers: headers(), body: JSON.stringify(payload) });
    await refresh();
    if(bindAfter){ bindProfileSelect.value = json.profile.profileId; await bindProfile(); }
    writeResult(json);
  }
  async function bindProfile(){ const payload = { profileId: bindProfileSelect.value, bindingRole: roleSelect.value, capability: capabilityInput.value.trim(), envTarget: el('binding-env-target').value.trim(), projectionMode: el('binding-projection-mode').value.trim(), allowedActions: (el('binding-allowed-actions').value || '').split(',').map(v => v.trim()).filter(Boolean), notes: el('binding-notes').value.trim() };
    const json = await fetchJson('/api/workspaces/' + encodeURIComponent(boot.workspaceId || 'local-default') + '/provider-bindings', { method:'POST', headers: headers(), body: JSON.stringify(payload) });
    await refresh(); writeResult(json);
  }
  async function runtimePlan(run=false){ const payload = { profileId: runtimeProfileSelect.value || null, action: el('runtime-action').value, bindingRole: el('runtime-binding-role').value.trim() || null, capability: el('runtime-capability').value.trim() || null, unlockSecret: el('runtime-unlock-secret').value.trim() || null };
    const endpoint = '/api/workspaces/' + encodeURIComponent(boot.workspaceId || 'local-default') + '/' + (run ? 'provider-runtime-execution' : 'provider-runtime-plan');
    const json = await fetchJson(endpoint, { method:'POST', headers: headers(), body: JSON.stringify(payload) });
    writeResult(json);
  }
  async function performProfileAction(profileId, action){ const unlockSecret = (el('provider-unlock-secret').value || el('runtime-unlock-secret').value || '').trim(); const payload = { workspaceId: boot.workspaceId || 'local-default', unlockSecret, capability: capabilityInput?.value?.trim() || null, action: el('runtime-action')?.value || 'provider_test' };
    if(action === 'delete'){ const json = await fetchJson('/api/providers/' + encodeURIComponent(profileId), { method:'DELETE', headers: headers() }); await refresh(); writeResult(json); return; }
    if(action === 'load'){ const profile = state.profiles.find(item => item.profileId === profileId); if(profile){ profileIdInput.value = profile.profileId; providerSelect.value = profile.provider; renderProviderFields(); el('provider-alias').value = profile.alias || ''; el('provider-description').value = profile.description || ''; el('provider-capabilities').value = (profile.capabilities || []).join(', '); el('provider-scopes').value = (profile.scopesSummary || []).join(', '); writeResult({ ok:true, loadedProfile: profile }); } return; }
    if(action === 'bootstrap'){ const json = await fetchJson('/api/workspaces/' + encodeURIComponent(boot.workspaceId || 'local-default') + '/provider-bootstrap', { method:'POST', headers: headers(), body: JSON.stringify({ profileId, unlockSecret, replaceExisting: false }) }); await refresh(); writeResult(json); return; }
    const endpoint = action === 'discovery' ? '/api/providers/' + encodeURIComponent(profileId) + '/discovery' : '/api/providers/' + encodeURIComponent(profileId) + '/' + action;
    const json = await fetchJson(endpoint, { method:'POST', headers: headers(), body: JSON.stringify(payload) });
    await refresh(); writeResult(json);
  }
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if(!target) return;
    try {
      if(target.id === 'provider-save'){ await saveProfile(false); }
      else if(target.id === 'provider-save-bind'){ await saveProfile(true); }
      else if(target.id === 'provider-bind'){ await bindProfile(); }
      else if(target.id === 'runtime-plan'){ await runtimePlan(false); }
      else if(target.id === 'runtime-run'){ await runtimePlan(true); }
      else if(target.dataset.action){ await performProfileAction(target.closest('tr').dataset.profileId, target.dataset.action); }
      else if(target.dataset.bindingAction === 'delete'){ const bindingId = target.closest('tr').dataset.bindingId; const json = await fetchJson('/api/workspaces/' + encodeURIComponent(boot.workspaceId || 'local-default') + '/provider-bindings/' + encodeURIComponent(bindingId), { method:'DELETE', headers: headers() }); await refresh(); writeResult(json); }
    } catch (error) { writeResult({ ok:false, error: error.message || String(error) }); }
  });
  if(providerSelect){ providerSelect.addEventListener('change', renderProviderFields); }
  renderProviderFields();
  renderTables();
})();
</script>`;
}

export function buildProviderCenterHtml(config, options = {}) {
  const { workspaceId = 'local-default', tenantId = 'local', profiles = [], bindings = [], unlockState = { unlockCount: 0 }, catalog = { providers: [] }, roleCatalog = { roles: [] } } = options;
  const body = `
<section class="hero">
  <h1>${escapeHtml(config.productName)} Provider Center</h1>
  <p>User-owned provider vault, credential rotation, workspace bindings, runtime-plan brokerage, and lock posture under the sovereign control plane.</p>
  ${statsGrid([['Tenant', tenantId], ['Workspace', workspaceId], ['Profiles', String(profiles.length)], ['Bindings', String(bindings.length)], ['Unlocked', String(unlockState.unlockCount || 0)]])}
  <p><a href="/api/providers/catalog">Catalog API</a> · <a href="/api/providers?tenantId=${encodeURIComponent(tenantId)}">Profiles API</a> · <a href="/api/workspaces/${encodeURIComponent(workspaceId)}/provider-bindings">Bindings API</a> · <a href="/api/governance-secret-migration/candidates?tenantId=${encodeURIComponent(tenantId)}">Migration candidates API</a> · <a href="/api/founder-lanes?tenantId=${encodeURIComponent(tenantId)}&workspaceId=${encodeURIComponent(workspaceId)}">Founder lane API</a> · <a href="/storage-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(tenantId)}">Storage center</a> · <a href="/deployment-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(tenantId)}">Deployment center</a></p>
</section>
<section class="panel"><h2>Founder lane separation</h2><p class="muted">Legacy governance-broker credentials remain in a declared founder-only lane and do not silently mix into the user-owned provider path. Use the migration candidates API to inspect legacy secrets that can be re-saved into the encrypted provider vault.</p></section>
<section class="panel">
  <div class="grid">
    <div>
      <h2>Session / tenant context</h2>
      <label for="auth-token">Session or admin token</label>
      <input id="auth-token" type="password" placeholder="Paste workspace session or admin token for menu actions">
      <label for="profile-id">Editing profile id</label>
      <input id="profile-id" type="text" placeholder="Blank = create new profile">
      <p class="muted">The page never reads back old plaintext credentials. To rotate secrets, load metadata, re-enter the secret fields, and save again.</p>
    </div>
    <div>
      <h2>Create / update provider</h2>
      <label for="provider-kind">Provider</label>
      <select id="provider-kind">${catalog.providers.map(item => `<option value="${escapeHtml(item.provider)}">${escapeHtml(item.label)}</option>`).join('')}</select>
      <label for="provider-alias">Alias</label><input id="provider-alias" type="text" placeholder="My provider alias">
      <label for="provider-description">Description</label><input id="provider-description" type="text" placeholder="Optional description">
      <label for="provider-unlock-secret">Unlock secret</label><input id="provider-unlock-secret" type="password" placeholder="User-held unlock secret">
      <label for="provider-scopes">Scopes summary</label><input id="provider-scopes" type="text" placeholder="deploy, preview, database">
      <label for="provider-capabilities">Capabilities override</label><input id="provider-capabilities" type="text" placeholder="Leave blank to infer from provider payload">
      <div id="provider-fields"></div>
      <div class="actions" style="margin-top:12px"><button id="provider-save" type="button">Save provider profile</button><button id="provider-save-bind" type="button" class="secondary">Save and bind to workspace</button></div>
    </div>
  </div>
</section>
<section class="panel">
  <div class="grid">
    <div>
      <h2>Workspace binding menu</h2>
      <label for="bind-profile-id">Profile</label><select id="bind-profile-id"></select>
      <label for="binding-role">Binding role</label><select id="binding-role">${roleCatalog.roles.map(item => `<option value="${escapeHtml(item.role)}">${escapeHtml(item.label)}</option>`).join('')}</select>
      <label for="binding-capability">Capability</label><input id="binding-capability" type="text" placeholder="database / deploy / scm / runtime">
      <label for="binding-env-target">Env target</label><input id="binding-env-target" type="text" value="workspace_runtime">
      <label for="binding-projection-mode">Projection mode</label><input id="binding-projection-mode" type="text" value="minimum">
      <label for="binding-allowed-actions">Allowed actions</label><input id="binding-allowed-actions" type="text" placeholder="db_connect, site_deploy, scm_sync">
      <label for="binding-notes">Notes</label><input id="binding-notes" type="text" placeholder="Optional binding notes">
      <div class="actions" style="margin-top:12px"><button id="provider-bind" type="button">Bind provider to workspace</button></div>
    </div>
    <div>
      <h2>Runtime / plan brokerage</h2>
      <label for="runtime-profile-id">Specific profile (optional)</label><select id="runtime-profile-id"></select>
      <label for="runtime-action">Action</label>
      <select id="runtime-action"><option value="provider_runtime_execution">Generic runtime execution</option><option value="db_connect">Database connect</option><option value="worker_deploy">Worker deploy</option><option value="site_deploy">Site deploy</option><option value="preview_deploy">Preview deploy</option><option value="scm_sync">SCM sync</option><option value="object_storage">Object storage</option></select>
      <label for="runtime-binding-role">Binding role override</label><input id="runtime-binding-role" type="text" placeholder="Optional role override">
      <label for="runtime-capability">Capability override</label><input id="runtime-capability" type="text" placeholder="Optional capability override">
      <label for="runtime-unlock-secret">One-off unlock secret</label><input id="runtime-unlock-secret" type="password" placeholder="Optional one-off unlock secret">
      <div class="actions" style="margin-top:12px"><button id="runtime-plan" type="button" class="secondary">Preview runtime plan</button><button id="runtime-run" type="button">Run runtime brokerage</button></div>
    </div>
  </div>
</section>
<section class="panel"><h2>Discovery and bootstrap</h2><p class="muted">Use Discover to inspect a provider with redacted resource posture. Use Discover + bind to apply recommended workspace binding roles without exposing plaintext secrets.</p></section>
<section class="panel"><h2>Provider profiles</h2><table><thead><tr><th>Alias</th><th>Provider</th><th>Capabilities</th><th>Account hints</th><th>Bindings</th><th>Verified</th><th>Actions</th></tr></thead><tbody id="provider-profiles-body">${providerRows(profiles, bindings)}</tbody></table></section>
<section class="panel"><h2>Workspace bindings</h2><table><thead><tr><th>Alias</th><th>Provider</th><th>Binding role</th><th>Capability</th><th>Target</th><th>Allowed actions</th><th>Actions</th></tr></thead><tbody id="provider-bindings-body">${bindingRows(bindings)}</tbody></table></section>
<section class="panel"><h2>Result</h2><pre id="provider-result">Ready.</pre></section>
${buildSharedUiScript()}`;
  return buildPageShell(`${config.productName} Provider Center`, body, { workspaceId, tenantId, profiles, bindings, catalog, roleCatalog });
}

export function buildStorageCenterHtml(config, options = {}) {
  const { workspaceId = 'local-default', tenantId = 'local', profiles = [] } = options;
  const filtered = profiles.filter(profile => (profile.capabilities || []).includes('database') || (profile.capabilities || []).includes('storage') || profile.provider === 'neon');
  const rows = filtered.map(profile => `<tr><td>${escapeHtml(profile.alias)}</td><td>${escapeHtml(profile.provider)}</td><td>${escapeHtml((profile.capabilities || []).join(', '))}</td><td>${escapeHtml(JSON.stringify(profile.accountHints || {}))}</td></tr>`).join('') || '<tr><td colspan="4">No storage-capable providers yet.</td></tr>';
  const body = `<section class="hero"><h1>${escapeHtml(config.productName)} Storage Center</h1><p>Database and storage posture for workspace <strong>${escapeHtml(workspaceId)}</strong>. Use Provider Center to rotate secrets and bind roles, then use the runtime-plan menu for DB connectivity brokerage.</p>${statsGrid([['Tenant', tenantId], ['Workspace', workspaceId], ['Storage profiles', String(filtered.length)]])}<p><a href="/provider-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(tenantId)}">Provider center</a></p></section><section class="panel"><h2>Storage-capable providers</h2><table><thead><tr><th>Alias</th><th>Provider</th><th>Capabilities</th><th>Account hints</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  return buildPageShell(`${config.productName} Storage Center`, body, { workspaceId, tenantId, profiles: filtered, bindings: [] });
}

export function buildDeploymentCenterHtml(config, options = {}) {
  const { workspaceId = 'local-default', tenantId = 'local', profiles = [] } = options;
  const filtered = profiles.filter(profile => (profile.capabilities || []).some(item => ['deploy', 'preview', 'site_runtime', 'worker_runtime', 'scm'].includes(item)) || ['cloudflare', 'netlify', 'github'].includes(profile.provider));
  const rows = filtered.map(profile => `<tr><td>${escapeHtml(profile.alias)}</td><td>${escapeHtml(profile.provider)}</td><td>${escapeHtml((profile.capabilities || []).join(', '))}</td><td>${escapeHtml(JSON.stringify(profile.accountHints || {}))}</td></tr>`).join('') || '<tr><td colspan="4">No deploy-capable providers yet.</td></tr>';
  const body = `<section class="hero"><h1>${escapeHtml(config.productName)} Deployment Center</h1><p>Deploy, preview, worker, and source-control posture for workspace <strong>${escapeHtml(workspaceId)}</strong>. Use Provider Center to bind worker deploy, site deploy, preview deploy, and SCM origin roles.</p>${statsGrid([['Tenant', tenantId], ['Workspace', workspaceId], ['Deployment profiles', String(filtered.length)]])}<p><a href="/provider-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(tenantId)}">Provider center</a></p></section><section class="panel"><h2>Deployment-capable providers</h2><table><thead><tr><th>Alias</th><th>Provider</th><th>Capabilities</th><th>Account hints</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  return buildPageShell(`${config.productName} Deployment Center`, body, { workspaceId, tenantId, profiles: filtered, bindings: [] });
}
