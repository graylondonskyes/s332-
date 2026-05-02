(function () {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname) || location.hostname.includes('github.dev') || location.hostname.includes('codespaces');
  const state = {
    widgetReady: false,
    token: null,
    user: null,
    member: null,
    month: null,
    runtime: null,
    config: { footer_collapsed: true },
    saveTimer: null,
    saving: false,
    pendingSave: false,
    workspaceLoaded: false
  };

  const styles = `
    .skaixu-auth-overlay{position:fixed;inset:0;z-index:500;background:radial-gradient(circle at top,#22103e 0%,#09060f 40%,#020203 100%);display:flex;align-items:center;justify-content:center;padding:24px}
    .skaixu-auth-card{width:min(980px,100%);display:grid;grid-template-columns:1.1fr .9fr;gap:22px;background:rgba(7,9,14,.82);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(20px);border-radius:28px;box-shadow:0 30px 120px rgba(0,0,0,.65);overflow:hidden}
    .skaixu-auth-pane{padding:28px 28px 24px 28px}
    .skaixu-auth-pane h1{margin:0 0 12px;font-size:34px;line-height:1;font-weight:900;letter-spacing:.04em;text-transform:uppercase;color:#f5f7ff}
    .skaixu-auth-pane p{margin:0 0 14px;color:#94a3b8;line-height:1.55;font-size:13px}
    .skaixu-chip{display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;border:1px solid rgba(99,102,241,.35);background:rgba(99,102,241,.12);font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#c7d2fe}
    .skaixu-actions{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0 16px}
    .skaixu-btn{appearance:none;border:none;border-radius:16px;padding:13px 16px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;font-size:11px;cursor:pointer;transition:.18s ease all}
    .skaixu-btn.primary{background:linear-gradient(135deg,#6d28d9,#3b82f6);color:#fff;box-shadow:0 0 30px rgba(99,102,241,.34)}
    .skaixu-btn.secondary{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#cbd5e1}
    .skaixu-btn:hover{transform:translateY(-1px);filter:brightness(1.08)}
    .skaixu-auth-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}
    .skaixu-metric{padding:14px 14px 12px;border-radius:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}
    .skaixu-metric label{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;margin-bottom:8px;font-weight:800}
    .skaixu-metric strong{display:block;color:#f8fafc;font-size:16px}
    .skaixu-form{display:grid;gap:12px}
    .skaixu-form input,.skaixu-form textarea{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#fff;border-radius:14px;padding:12px 14px;font-size:13px;outline:none}
    .skaixu-form textarea{min-height:120px;resize:vertical}
    .skaixu-status{margin-top:12px;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);font-size:12px;color:#cbd5e1;line-height:1.5}
    .skaixu-hidden{display:none!important}
    .skaixu-cloud-chip{display:inline-flex;align-items:center;gap:8px;padding:5px 10px;border-radius:999px;border:1px solid rgba(16,185,129,.3);background:rgba(16,185,129,.1);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#6ee7b7}
    .skaixu-cloud-chip.warn{border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.1);color:#fbbf24}
    .skaixu-cloud-chip.fail{border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.1);color:#fca5a5}
    .skaixu-mini-toggle{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);padding:6px 10px;border-radius:999px;color:#a5b4fc;font-size:9px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;cursor:pointer}
    @media (max-width: 900px){.skaixu-auth-card{grid-template-columns:1fr}.skaixu-auth-grid{grid-template-columns:1fr}}
  `;

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = styles;
    document.head.appendChild(style);
  }

  function accessFormSubmit(payload) {
    const body = new URLSearchParams();
    body.set('form-name', 'skaixuide-access');
    Object.entries(payload || {}).forEach(([k, v]) => body.set(k, String(v || '')));
    return fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  }

  function authOverlay() {
    let overlay = document.getElementById('skaixu-auth-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'skaixu-auth-overlay';
    overlay.className = 'skaixu-auth-overlay skaixu-hidden';
    overlay.innerHTML = `
      <div class="skaixu-auth-card">
        <section class="skaixu-auth-pane">
          <span class="skaixu-chip">s0l26 0s · secure operator lane</span>
          <h1>skAIxuIDEpro</h1>
          <p>Sign up before use. The AI lane is server-side, metered, and governed under <strong>Skyes Over London</strong> with the public AI identity <strong>kAIxU</strong>. This build belongs to the <strong>s0l26 0s Creative Environment Eco-System</strong>.</p>
          <form id="skaixu-auth-form" class="skaixu-form">
            <input name="full_name" type="text" placeholder="Full name">
            <input name="email" type="email" placeholder="Email" required>
            <input name="password" type="password" placeholder="Password" required>
            <div class="skaixu-actions">
              <button class="skaixu-btn primary" type="submit" data-mode="login">Login / Resume</button>
              <button class="skaixu-btn secondary" type="button" data-mode="signup">Create account</button>
              <button class="skaixu-btn secondary" type="button" data-mode="logout">Logout</button>
            </div>
          </form>
          <div class="skaixu-auth-grid">
            <div class="skaixu-metric"><label>Brain</label><strong>kAIxU</strong></div>
            <div class="skaixu-metric"><label>Provider</label><strong>Skyes Over London</strong></div>
            <div class="skaixu-metric"><label>Persistence</label><strong>Neon + Blobs</strong></div>
            <div class="skaixu-metric"><label>Access</label><strong>Identity-gated</strong></div>
          </div>
          <div id="skaixu-auth-status" class="skaixu-status">Checking site runtime…</div>
        </section>
        <section class="skaixu-auth-pane" style="background:linear-gradient(180deg,rgba(99,102,241,.08),rgba(255,255,255,.02))">
          <h1 style="font-size:22px">Access / support form</h1>
          <p>Netlify Forms is wired for access requests, intake, support notes, and callback handoff. This lets you capture demand without exposing AI to anonymous drive-by chaos gremlins.</p>
          <form id="skaixu-access-form" class="skaixu-form">
            <input name="email" type="email" placeholder="Email" required>
            <input name="company" type="text" placeholder="Company / team">
            <input name="phone" type="text" placeholder="Phone">
            <textarea name="notes" placeholder="What are you trying to build or run?"></textarea>
            <button class="skaixu-btn primary" type="submit">Submit access note</button>
          </form>
          <div id="skaixu-access-result" class="skaixu-status">Support email: SkyesOverLondonLC@SOLEnterprises.org · Phone: (480) 469-5416</div>
        </section>
      </div>`;
    document.body.appendChild(overlay);

    const authForm = overlay.querySelector('#skaixu-auth-form');
    authForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitIdentityCredentials('login', event.currentTarget);
    });
    overlay.querySelector('[data-mode="signup"]').addEventListener('click', async () => {
      await submitIdentityCredentials('signup', authForm);
    });
    overlay.querySelector('[data-mode="logout"]').addEventListener('click', async () => {
      try { window.netlifyIdentity && window.netlifyIdentity.logout(); } catch {}
      state.user = null; state.token = null; state.member = null; state.month = null;
      showOverlay();
    });
    overlay.querySelector('#skaixu-access-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const payload = Object.fromEntries(fd.entries());
      payload.ts = new Date().toISOString();
      payload.route = 'skAIxuIDEpro-access';
      try {
        await accessFormSubmit(payload);
        event.currentTarget.reset();
        overlay.querySelector('#skaixu-access-result').textContent = 'Access note submitted. Skyes Over London now has the trail.';
      } catch (error) {
        overlay.querySelector('#skaixu-access-result').textContent = `Access note failed: ${error.message}`;
      }
    });
    return overlay;
  }

  function showOverlay() {
    authOverlay().classList.remove('skaixu-hidden');
    document.body.style.overflow = 'hidden';
  }

  function hideOverlay() {
    const overlay = authOverlay();
    overlay.classList.add('skaixu-hidden');
    document.body.style.overflow = '';
  }

  function setAuthStatus(text, tone) {
    const status = authOverlay().querySelector('#skaixu-auth-status');
    status.textContent = text;
    status.style.borderColor = tone === 'fail' ? 'rgba(239,68,68,.35)' : tone === 'ok' ? 'rgba(16,185,129,.35)' : 'rgba(255,255,255,.06)';
    status.style.background = tone === 'fail' ? 'rgba(239,68,68,.08)' : tone === 'ok' ? 'rgba(16,185,129,.08)' : 'rgba(255,255,255,.04)';
    status.style.color = tone === 'fail' ? '#fecaca' : tone === 'ok' ? '#bbf7d0' : '#cbd5e1';
  }

  function readIdentityCredentials(root) {
    const scope = root || document;
    return {
      full_name: String(scope.querySelector('[name="full_name"]')?.value || '').trim(),
      email: String(scope.querySelector('[name="email"]')?.value || '').trim(),
      password: String(scope.querySelector('[name="password"]')?.value || '')
    };
  }

  async function submitIdentityCredentials(mode, root) {
    try {
      const identity = window.netlifyIdentity;
      const creds = readIdentityCredentials(root);
      if (!identity) {
        setAuthStatus('Netlify Identity widget did not load. Enable Identity on the site, then refresh.', 'fail');
        return;
      }
      if (!creds.email || !creds.password) {
        setAuthStatus('Email and password are required.', 'fail');
        return;
      }
      if (mode === 'signup') {
        setAuthStatus('Creating account…', 'warn');
        if (typeof identity.signup === 'function') {
          await identity.signup(creds.email, creds.password, creds.full_name ? { full_name: creds.full_name, name: creds.full_name } : {});
        } else {
          identity.open && identity.open('signup');
          setAuthStatus('Identity popup opened for signup.', 'warn');
          return;
        }
        try {
          const user = typeof identity.login === 'function' ? await identity.login(creds.email, creds.password, true) : null;
          if (user) await syncIdentitySession(user);
          setAuthStatus(`Account created. Signed in as ${creds.email}.`, 'ok');
        } catch (error) {
          setAuthStatus('Account created. If confirmation is enabled, verify the inbox email and then sign in.', 'ok');
        }
      } else {
        setAuthStatus('Signing in…', 'warn');
        if (typeof identity.login === 'function') {
          const user = await identity.login(creds.email, creds.password, true);
          if (user) await syncIdentitySession(user);
          setAuthStatus(`Signed in as ${creds.email}.`, 'ok');
        } else {
          identity.open && identity.open('login');
          setAuthStatus('Identity popup opened for login.', 'warn');
        }
      }
    } catch (error) {
      setAuthStatus(`${mode === 'signup' ? 'Account setup failed' : 'Login failed'}: ${error.message || 'Unknown identity error'}`, 'fail');
    }
  }

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (state.user && !isLocal) {
      try { state.token = await state.user.jwt(); } catch {}
    }
    if (state.token) headers.set('Authorization', `Bearer ${state.token}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, { ...options, headers });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) {
      const err = new Error(data?.error || text || `HTTP ${response.status}`);
      err.statusCode = response.status;
      throw err;
    }
    return data;
  }

  async function refreshRuntimeStatus() {
    try {
      state.runtime = await apiFetch('/.netlify/functions/runtime-status', { method: 'GET' });
    } catch (error) {
      state.runtime = { ok: false, error: error.message };
    }
    try {
      const configResp = await fetch('/.netlify/functions/site-config');
      const configData = await configResp.json();
      if (configData?.config) state.config = configData.config;
    } catch {}
    applyFooterCollapse(true);
  }

  function updateBudgetChip(month) {
    state.month = month || state.month;
    const target = document.getElementById('telemetry-budget');
    if (!target || !state.member || !state.month) return;
    const reqLeft = Math.max(0, Number(state.member.monthly_request_cap || 0) - Number(state.month.request_count || 0));
    const tokLeft = Math.max(0, Number(state.member.monthly_token_cap || 0) - Number(state.month.total_tokens || 0));
    target.textContent = `Req ${reqLeft} · Tok ${tokLeft.toLocaleString()}`;
  }

  function ensureIdentitySummary() {
    let chip = document.getElementById('skaixu-cloud-chip');
    if (!chip) {
      chip = document.createElement('span');
      chip.id = 'skaixu-cloud-chip';
      chip.className = 'skaixu-cloud-chip';
      const host = document.querySelector('footer .flex.flex-wrap.gap-4.items-center');
      if (host) host.prepend(chip);
    }
    const name = state.user?.email || 'Guest';
    const saved = state.workspaceLoaded ? 'Cloud synced' : 'Local only';
    chip.className = `skaixu-cloud-chip ${state.workspaceLoaded ? '' : 'warn'}`.trim();
    chip.textContent = `${name} · ${saved}`;
  }

  function captureWorkspace() {
    return {
      fileSystem,
      activeProject,
      activeFilePath,
      currentCode,
      originalCode,
      viewMode,
      activeModel,
      conversation: Array.isArray(conversation) ? conversation.slice(-12) : []
    };
  }

  function applyWorkspace(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    if (snapshot.fileSystem && typeof snapshot.fileSystem === 'object') fileSystem = snapshot.fileSystem;
    if (snapshot.activeProject) activeProject = snapshot.activeProject;
    if (snapshot.activeFilePath) activeFilePath = snapshot.activeFilePath;
    if (snapshot.currentCode) currentCode = snapshot.currentCode;
    if (snapshot.originalCode) originalCode = snapshot.originalCode;
    if (snapshot.viewMode) viewMode = snapshot.viewMode;
    if (snapshot.activeModel) activeModel = snapshot.activeModel;
    if (Array.isArray(snapshot.conversation)) conversation = snapshot.conversation;
    localStorage.setItem('sk_active_project', activeProject);
    localStorage.setItem('sk_active_filepath', activeFilePath);
    if (typeof renderFileExplorer === 'function') renderFileExplorer();
    if (typeof loadActiveFile === 'function') loadActiveFile();
    if (typeof updateBrainUI === 'function') updateBrainUI();
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) modelSelect.value = activeModel || 'kAIxU';
  }

  async function loadCloudWorkspace() {
    if (isLocal || !state.token) return;
    const data = await apiFetch('/.netlify/functions/workspace-sync', { method: 'GET' });
    if (data.workspace) {
      applyWorkspace(data.workspace);
      state.workspaceLoaded = true;
      ensureIdentitySummary();
      updateBudgetChip();
      if (typeof broadcastLog === 'function') broadcastLog('Cloud workspace restored from Neon', 'success');
    } else {
      state.workspaceLoaded = true;
      ensureIdentitySummary();
      scheduleCloudSave(true);
    }
  }

  function scheduleCloudSave(immediate) {
    if (isLocal || !state.token) return;
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => void saveCloudWorkspace(), immediate ? 10 : 1200);
  }

  async function saveCloudWorkspace() {
    if (isLocal || !state.token) return;
    if (state.saving) {
      state.pendingSave = true;
      return;
    }
    state.saving = true;
    try {
      await apiFetch('/.netlify/functions/workspace-sync', {
        method: 'POST',
        body: JSON.stringify({ workspace: captureWorkspace() })
      });
      state.workspaceLoaded = true;
      ensureIdentitySummary();
    } catch (error) {
      console.warn('[s0l26 cloud save]', error.message);
      ensureIdentitySummary();
    } finally {
      state.saving = false;
      if (state.pendingSave) {
        state.pendingSave = false;
        scheduleCloudSave(true);
      }
    }
  }

  async function syncIdentitySession(user) {
    state.user = user;
    state.token = await user.jwt();
    const session = await apiFetch('/.netlify/functions/auth-me', { method: 'GET' });
    state.member = session.member;
    state.month = session.month;
    updateBudgetChip(session.month);
    ensureIdentitySummary();
    setAuthStatus(`Signed in as ${session.user.email}. Role: ${session.member.role}.`, 'ok');
    hideOverlay();
    await loadCloudWorkspace();
  }

  function wrapWorkspaceMutation(name) {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = async function (...args) {
      const result = await original.apply(this, args);
      scheduleCloudSave(false);
      return result;
    };
  }

  function patchLogFlush() {
    if (typeof _flushNeonLogs !== 'function') return;
    _flushNeonLogs = async function () {
      _neonFlushTimer = null;
      if (_neonLogQueue.length === 0 || isLocal) return;
      const batch = _neonLogQueue.splice(0, 100);
      try {
        await apiFetch('/.netlify/functions/logs', {
          method: 'POST',
          body: JSON.stringify(batch)
        });
      } catch (error) {
        console.warn('[s0l26 logs]', error.message);
      }
    };
  }

  function patchAiRoutes() {
    if (typeof kaixuChat === 'function') {
      const originalChat = kaixuChat;
      kaixuChat = async function (_key, payload) {
        if (!isLocal && !state.token) {
          showOverlay();
          throw new Error('Login required before AI use');
        }
        const res = await apiFetch('/.netlify/functions/gateway-chat', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (res.month) updateBudgetChip(res.month);
        return res;
      };
      window.kaixuChat = kaixuChat;
    }

    if (typeof kaixuStreamChat === 'function') {
      kaixuStreamChat = async function ({ payload, onMeta, onDelta, onDone, onError }) {
        if (!isLocal && !state.token) {
          showOverlay();
          const error = new Error('Login required before AI use');
          onError && onError(error);
          throw error;
        }
        try {
          const response = await fetch('/.netlify/functions/gateway-stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
            },
            body: JSON.stringify(payload)
          });
          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `HTTP ${response.status}`);
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const chunks = buffer.split('\n\n');
            buffer = chunks.pop() || '';
            for (const chunk of chunks) {
              const eventMatch = chunk.match(/^event:\s*(.+)$/m);
              const dataMatch = chunk.match(/^data:\s*(.+)$/m);
              if (!eventMatch || !dataMatch) continue;
              const event = eventMatch[1].trim();
              const data = JSON.parse(dataMatch[1]);
              if (event === 'meta') onMeta && onMeta(data);
              if (event === 'delta') onDelta && onDelta(data.text || '');
              if (event === 'done') {
                if (data.month) updateBudgetChip(data.month);
                onDone && onDone(data);
              }
            }
          }
        } catch (error) {
          onError && onError(error);
          throw error;
        }
      };
      window.kaixuStreamChat = kaixuStreamChat;
    }
  }

  function applyFooterCollapse(forceDefault) {
    const section = document.querySelector('footer .mt-3.pt-3.border-t');
    if (!section) return;
    let btn = document.getElementById('skaixu-footer-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'skaixu-footer-toggle';
      btn.className = 'skaixu-mini-toggle';
      btn.type = 'button';
      btn.addEventListener('click', () => {
        section.classList.toggle('skaixu-hidden');
        localStorage.setItem('skaixu_footer_collapsed', section.classList.contains('skaixu-hidden') ? '1' : '0');
        btn.textContent = section.classList.contains('skaixu-hidden') ? 'Show s0l26 0s links' : 'Hide s0l26 0s links';
      });
      section.parentElement.insertBefore(btn, section);
    }
    const localChoice = localStorage.getItem('skaixu_footer_collapsed');
    const collapsed = forceDefault
      ? (localChoice ? localChoice === '1' : Boolean(state.config.footer_collapsed))
      : section.classList.contains('skaixu-hidden');
    section.classList.toggle('skaixu-hidden', collapsed);
    btn.textContent = collapsed ? 'Show s0l26 0s links' : 'Hide s0l26 0s links';
    if (state.config.announcement) {
      const statusHost = document.querySelector('footer .flex.flex-wrap.gap-x-6.gap-y-2.items-center');
      if (statusHost && !document.getElementById('skaixu-announcement-chip')) {
        const chip = document.createElement('span');
        chip.id = 'skaixu-announcement-chip';
        chip.className = 'skaixu-cloud-chip';
        chip.textContent = state.config.announcement.slice(0, 110);
        statusHost.appendChild(chip);
      }
    }
  }

  function patchGlobalBehaviors() {
    patchAiRoutes();
    patchLogFlush();
    const originalSetFsEntry = setFsEntry;
    setFsEntry = async function (...args) {
      const result = await originalSetFsEntry.apply(this, args);
      scheduleCloudSave(false);
      return result;
    };
    const originalSaveFs = saveFs;
    saveFs = async function (...args) {
      const result = await originalSaveFs.apply(this, args);
      scheduleCloudSave(false);
      return result;
    };
    wrapWorkspaceMutation('fhNewProject');
    wrapWorkspaceMutation('fhNewFile');
    wrapWorkspaceMutation('fhNewFolder');
    wrapWorkspaceMutation('fhDuplicate');
    wrapWorkspaceMutation('fhDelete');
    wrapWorkspaceMutation('saveCurrentWork');
    const originalOpenFile = window.openFile;
    if (typeof originalOpenFile === 'function') {
      window.openFile = function (...args) {
        const result = originalOpenFile.apply(this, args);
        scheduleCloudSave(false);
        return result;
      };
    }
    const originalPromote = window.promoteToOriginal;
    if (typeof originalPromote === 'function') {
      window.promoteToOriginal = async function (...args) {
        const result = await originalPromote.apply(this, args);
        scheduleCloudSave(false);
        return result;
      };
    }
  }

  async function initIdentity() {
    await refreshRuntimeStatus();
    if (isLocal) {
      state.workspaceLoaded = true;
      ensureIdentitySummary();
      setAuthStatus('Local mode bypass enabled. Production still requires login.', 'ok');
      hideOverlay();
      return;
    }

    showOverlay();
    if (!window.netlifyIdentity) {
      setAuthStatus('Netlify Identity widget missing. Enable Identity on the site and redeploy.', 'fail');
      return;
    }

    window.netlifyIdentity.on('init', async (user) => {
      state.widgetReady = true;
      if (user) {
        try {
          await syncIdentitySession(user);
        } catch (error) {
          setAuthStatus(error.message, 'fail');
          showOverlay();
        }
      } else {
        setAuthStatus('Login required before workspace or AI access.', 'warn');
        showOverlay();
      }
    });

    window.netlifyIdentity.on('login', async (user) => {
      try {
        await syncIdentitySession(user);
        window.netlifyIdentity.close && window.netlifyIdentity.close();
      } catch (error) {
        setAuthStatus(error.message, 'fail');
      }
    });

    window.netlifyIdentity.on('signup', async (user) => {
      if (user?.email) {
        setAuthStatus(`Account created for ${user.email}. Finish confirmation if required, then sign in.`, 'ok');
      }
    });

    window.netlifyIdentity.on('logout', () => {
      state.user = null;
      state.token = null;
      state.member = null;
      state.month = null;
      ensureIdentitySummary();
      showOverlay();
      setAuthStatus('Session closed. Sign back in to use the IDE.', 'warn');
    });

    try {
      window.netlifyIdentity.init();
      const current = window.netlifyIdentity.currentUser();
      if (current) await syncIdentitySession(current);
    } catch (error) {
      setAuthStatus(`Identity init failed: ${error.message}`, 'fail');
    }
  }

  function boot() {
    injectStyles();
    authOverlay();
    patchGlobalBehaviors();
    ensureIdentitySummary();
    initIdentity().catch((error) => setAuthStatus(error.message, 'fail'));
    window.addEventListener('beforeunload', () => {
      if (!isLocal && state.token) {
        try { navigator.sendBeacon && navigator.sendBeacon('/.netlify/functions/logs', JSON.stringify([{ source: 'IDE', type: 'info', message: 'window-unload', hostname: location.hostname, email: state.user?.email || '' }])); } catch {}
      }
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 20);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 20));
  }
})();
