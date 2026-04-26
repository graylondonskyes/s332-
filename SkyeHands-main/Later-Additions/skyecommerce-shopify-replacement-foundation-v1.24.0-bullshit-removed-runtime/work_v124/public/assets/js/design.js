function fill(form, data = {}) {
  Object.entries(data).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value ?? '';
  });
}

function collect(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function applyPreview(data = {}) {
  const banner = document.getElementById('theme-preview');
  const title = document.getElementById('preview-title');
  const tagline = document.getElementById('preview-tagline');
  const button = document.getElementById('preview-button');
  banner.style.background = data.surfaceColor || '#111827';
  banner.style.color = data.textColor || '#f8fafc';
  banner.style.borderColor = data.accentColor || '#7c3aed';
  title.textContent = data.heroTitle || data.brandName || 'Your storefront';
  tagline.textContent = data.heroTagline || 'Theme rendering appears here.';
  button.style.background = data.accentColor || '#7c3aed';
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('design-form');
  const auth = await window.SKYECOM.api('/api/auth/me').catch(() => ({ ok: false }));
  if (auth.ok && auth.session?.merchant) {
    fill(form, auth.session.merchant);
    applyPreview(auth.session.merchant);
    document.getElementById('open-store-link').href = `../store/index.html?slug=${auth.session.merchant.slug}`;
  }
  form.addEventListener('input', () => applyPreview(collect(form)));
  document.getElementById('design-save').addEventListener('click', async () => {
    try {
      await window.SKYECOM.api('/api/merchant', { method: 'PUT', body: JSON.stringify(collect(form)) });
      window.SKYECOM.status('design-status', 'Theme saved.', 'good');
    } catch (error) {
      window.SKYECOM.status('design-status', error.message, 'bad');
    }
  });
  document.getElementById('design-publish').addEventListener('click', async () => {
    try {
      await window.SKYECOM.api('/api/merchant', { method: 'PUT', body: JSON.stringify(collect(form)) });
      const data = await window.SKYECOM.api('/api/publish', { method: 'POST' });
      window.SKYECOM.status('design-status', `Theme saved and store published. <a href="${data.previewUrl}" target="_blank" rel="noreferrer">Open store</a>`, 'good');
      document.getElementById('open-store-link').href = data.previewUrl;
    } catch (error) {
      window.SKYECOM.status('design-status', error.message, 'bad');
    }
  });
});
