(function () {
  if (window.__skyesRuntime) return;

  const runtime = {
    missing: [],
    banners: new Set()
  };

  function noteMissing(name) {
    if (!runtime.missing.includes(name)) runtime.missing.push(name);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function simpleMarkdown(value) {
    const escaped = escapeHtml(String(value || ''));
    return escaped
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll('script,iframe,object,embed,link[rel="import"]').forEach((node) => node.remove());
    template.content.querySelectorAll('*').forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || '');
        if (name.startsWith('on')) node.removeAttribute(attr.name);
        if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^\s*javascript:/i.test(value)) {
          node.removeAttribute(attr.name);
        }
      });
    });
    return template.innerHTML;
  }

  if (typeof window.tailwind === 'undefined') noteMissing('tailwindcss');
  if (typeof window.THREE === 'undefined') noteMissing('three.js');
  if (typeof window.JSZip === 'undefined') noteMissing('jszip');

  if (!window.lucide || typeof window.lucide.createIcons !== 'function') {
    noteMissing('lucide');
    window.lucide = { createIcons: function () { return []; } };
  }

  if (!window.marked || typeof window.marked.parse !== 'function') {
    noteMissing('marked');
    window.marked = { parse: simpleMarkdown };
  }

  if (!window.DOMPurify || typeof window.DOMPurify.sanitize !== 'function') {
    noteMissing('dompurify');
    window.DOMPurify = { sanitize: sanitizeHtml };
  }

  if (!window.mermaid || typeof window.mermaid.initialize !== 'function') {
    noteMissing('mermaid');
    window.mermaid = {
      initialize: function () {},
      init: function () {},
      run: function () {}
    };
  }

  if (!window.netlifyIdentity) {
    noteMissing('netlify-identity');
    const listeners = {};
    window.netlifyIdentity = {
      __stub: true,
      init: function () {
        (listeners.init || []).forEach((handler) => { try { handler(null); } catch (_) {} });
      },
      open: function (mode) {
        const error = new Error(`Netlify Identity widget unavailable${mode ? ` for ${mode}` : ''}.`);
        (listeners.error || []).forEach((handler) => { try { handler(error); } catch (_) {} });
      },
      on: function (event, handler) {
        listeners[event] = listeners[event] || [];
        listeners[event].push(handler);
      },
      off: function (event, handler) {
        listeners[event] = (listeners[event] || []).filter((item) => item !== handler);
      },
      close: function () {},
      logout: async function () {
        (listeners.logout || []).forEach((handler) => { try { handler(); } catch (_) {} });
      },
      currentUser: function () { return null; }
    };
  }

  function injectBannerStyles() {
    if (document.getElementById('skyes-runtime-guard-style')) return;
    const style = document.createElement('style');
    style.id = 'skyes-runtime-guard-style';
    style.textContent = '.skyes-runtime-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:10000;padding:12px 14px;border-radius:14px;background:rgba(14,19,34,.94);color:#e5e7eb;border:1px solid rgba(245,158,11,.35);box-shadow:0 20px 60px rgba(0,0,0,.35);font:600 12px/1.45 Inter,system-ui,sans-serif;backdrop-filter:blur(10px)}.skyes-runtime-banner strong{color:#fbbf24}.skyes-runtime-banner code{font:700 11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:#c4b5fd}.skyes-runtime-banner button{margin-left:12px;background:#4f46e5;color:#fff;border:none;border-radius:999px;padding:6px 10px;font:800 10px/1 Inter,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}';
    document.head.appendChild(style);
  }

  function showBanner(scope, missing) {
    const key = `${scope}:${missing.join(',')}`;
    if (!missing.length || runtime.banners.has(key)) return;
    runtime.banners.add(key);
    injectBannerStyles();
    const render = function () {
      if (!document.body) return;
      const banner = document.createElement('div');
      banner.className = 'skyes-runtime-banner';
      banner.innerHTML = `<strong>Degraded runtime mode</strong> on <code>${escapeHtml(scope)}</code>. Missing CDN assets: <code>${escapeHtml(missing.join(', '))}</code>. Core flows stay available, but visual or convenience features may be reduced.`;
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'Dismiss';
      close.addEventListener('click', function () { banner.remove(); });
      banner.appendChild(close);
      document.body.appendChild(banner);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', render, { once: true });
    } else {
      render();
    }
  }

  function flattenProjectTree(node, prefix, output) {
    Object.keys(node || {}).forEach((key) => {
      const item = node[key];
      const nextPath = prefix ? `${prefix}/${key}` : key;
      if (item && item.type === 'folder') flattenProjectTree(item.children || {}, nextPath, output);
      else output[nextPath] = item && typeof item.content === 'string' ? item.content : '';
    });
  }

  window.__skyesRuntime = runtime;
  window.__skyesSafeMarkdown = function (value) {
    return window.DOMPurify.sanitize(window.marked.parse(String(value || '')));
  };
  window.__skyesSafeIconRefresh = function () {
    try { return window.lucide.createIcons(); } catch (_) { return []; }
  };
  window.__skyesNotifyMissingRuntime = function (scope, extras) {
    const missing = Array.from(new Set(runtime.missing.concat(Array.isArray(extras) ? extras : [])));
    showBanner(scope || 'runtime', missing);
  };
  window.__skyesDownloadBlob = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  };
  window.__skyesDownloadProjectBundle = function (projectName, projectTree) {
    const files = {};
    flattenProjectTree(projectTree || {}, '', files);
    const blob = new Blob([JSON.stringify({
      project: projectName,
      exported_at: new Date().toISOString(),
      format: 'skyes-fallback-project-bundle',
      files
    }, null, 2)], { type: 'application/json' });
    window.__skyesDownloadBlob(blob, `${String(projectName || 'project').replace(/\s+/g, '_')}.bundle.json`);
  };

  if (runtime.missing.length) {
    window.__skyesNotifyMissingRuntime(document.documentElement.getAttribute('data-runtime-scope') || 'app');
  }
})();
