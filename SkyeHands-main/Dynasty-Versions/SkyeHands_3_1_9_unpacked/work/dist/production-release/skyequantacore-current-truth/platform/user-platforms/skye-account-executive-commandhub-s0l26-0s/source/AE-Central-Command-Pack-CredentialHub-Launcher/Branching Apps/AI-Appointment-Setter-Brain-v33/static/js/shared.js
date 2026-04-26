let authState = { csrfToken: '' };
window.publicConfig = window.publicConfig || null;

function currentOrgSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get('org') || '';
}

function nextPathOrDefault(fallback = '/admin/index.html') {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || fallback;
  return next.startsWith('/') ? next : fallback;
}

function setCsrfToken(token) {
  authState.csrfToken = token || '';
}

function getCsrfToken() {
  return authState.csrfToken || '';
}

function featureFlags() {
  return (window.publicConfig && window.publicConfig.features) || {};
}

function hasFeature(name) {
  return !!featureFlags()[name];
}

async function api(path, options = {}, extras = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (method !== 'GET' && method !== 'HEAD' && getCsrfToken()) {
    headers['X-CSRF-Token'] = getCsrfToken();
  }
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const message = data.error || `Request failed: ${response.status}`;
    if (data.code === 'PASSWORD_CHANGE_REQUIRED' && !window.location.pathname.includes('/auth/login.html')) {
      window.location.href = `/auth/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}&must_change=1`;
    }
    if (response.status === 401 && extras.redirectOn401 !== false && !window.location.pathname.includes('/auth/login.html')) {
      window.location.href = `/auth/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new Error(message);
  }
  if (data.csrf_token) setCsrfToken(data.csrf_token);
  return data;
}

async function authMe() {
  const data = await api('/api/auth/me', {}, { redirectOn401: false });
  if (data.csrf_token) setCsrfToken(data.csrf_token);
  return data;
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST', body: '{}' }, { redirectOn401: false });
  setCsrfToken('');
  window.location.href = '/auth/login.html';
}

function formatDateTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function withOrg(path) {
  const org = currentOrgSlug();
  if (!org) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}org=${encodeURIComponent(org)}`;
}

async function loadPublicConfig() {
  const config = await api(withOrg('/api/public/config'), {}, { redirectOn401: false });
  window.publicConfig = config;
  document.querySelectorAll('[data-brand]').forEach((el) => { el.textContent = config.brand; });
  document.querySelectorAll('[data-support-email]').forEach((el) => { el.textContent = config.support_email; });
  document.querySelectorAll('[data-support-phone]').forEach((el) => { el.textContent = config.support_phone; });
  document.querySelectorAll('[data-hours]').forEach((el) => { el.textContent = config.operating_hours; });
  return config;
}
