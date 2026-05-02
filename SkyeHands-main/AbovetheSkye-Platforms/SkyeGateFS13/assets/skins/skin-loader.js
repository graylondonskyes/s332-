(function () {
  const KEY = 'SKYEGATEFS13_SKIN';
  const DEFAULT_SKIN = 'classic';
  const SKINS = new Set(['classic', 'skaixu-ide', 'sol-ops', 'focus']);

  function normalize(value) {
    return SKINS.has(value) ? value : DEFAULT_SKIN;
  }

  function applySkin(value) {
    const skin = normalize(value);
    document.documentElement.dataset.skyeSkin = skin;
    try { localStorage.setItem(KEY, skin); } catch {}
    const select = document.getElementById('skinSelect');
    if (select && select.value !== skin) select.value = skin;
    window.dispatchEvent(new CustomEvent('skye:skinchange', { detail: { skin } }));
    return skin;
  }

  function init() {
    const current = applySkin(localStorage.getItem(KEY) || document.documentElement.dataset.skyeSkin || DEFAULT_SKIN);
    const select = document.getElementById('skinSelect');
    if (!select) return;
    select.value = current;
    select.addEventListener('change', () => applySkin(select.value));
  }

  window.SkyeGateSkins = {
    list: () => Array.from(SKINS),
    current: () => normalize(document.documentElement.dataset.skyeSkin),
    apply: applySkin
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
