window.SKYECOM = {
  csrfToken: '',
  async ensureCsrfToken() {
    if (this.csrfToken) return this.csrfToken;
    const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `CSRF request failed: ${res.status}`);
    this.csrfToken = data.csrfToken || '';
    return this.csrfToken;
  },
  async api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const method = String(options.method || 'GET').toUpperCase();
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (mutating && String(path || '').startsWith('/api/') && !headers.has('Authorization') && path !== '/api/auth/csrf') {
      const token = await this.ensureCsrfToken();
      if (token) headers.set('X-Skye-CSRF', token);
    }
    let res = await fetch(path, { ...options, method, headers, credentials: 'same-origin' });
    let data = await res.json().catch(() => ({}));
    if (res.status === 403 && data.code === 'csrf_invalid') {
      this.csrfToken = '';
      const token = await this.ensureCsrfToken();
      headers.set('X-Skye-CSRF', token);
      res = await fetch(path, { ...options, method, headers, credentials: 'same-origin' });
      data = await res.json().catch(() => ({}));
    }
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  },
  status(targetId, message, mode = 'warn') {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.className = `status-box show status-${mode}`;
    el.innerHTML = message;
  },
  money(cents = 0, currency = 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((Number(cents) || 0) / 100);
  },
  escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  nav() {
    const current = location.pathname.replace(/index\.html$/, '');
    document.querySelectorAll('[data-nav]').forEach((link) => {
      const href = link.getAttribute('href')?.replace(/index\.html$/, '');
      if (href && current.endsWith(href.replace(/^\.\//, ''))) link.classList.add('active');
    });
  }
};
document.addEventListener('DOMContentLoaded', () => window.SKYECOM.nav());
