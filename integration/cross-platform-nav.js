(function () {
  if (document.querySelector('.skye-cross-nav')) return;

  const script = document.currentScript;
  const commandhubRoot = script?.dataset?.commandhubRoot || '';
  const bridge = window.SkyeIntegrationBridge;

  function queueCount() {
    try {
      return bridge?.listQueue?.().length || 0;
    } catch {
      return 0;
    }
  }

  const nav = document.createElement('div');
  nav.className = 'skye-cross-nav';
  nav.innerHTML = `
    <span class="skye-cross-nav__brand">SkyeHands Mesh</span>
    <span class="skye-cross-nav__meta" data-queue-count>${queueCount()} queued</span>
    <div class="skye-cross-nav__actions">
      <a class="skye-cross-nav__link" href="${commandhubRoot ? `${commandhubRoot.replace(/\/$/, '')}/index.html` : '#'}">Hub</a>
      <button type="button" class="skye-cross-nav__button" data-open-queue>Queue</button>
    </div>
  `;

  function renderQueueCount() {
    const label = nav.querySelector('[data-queue-count]');
    if (label) label.textContent = `${queueCount()} queued`;
  }

  nav.querySelector('[data-open-queue]')?.addEventListener('click', () => {
    const events = bridge?.listQueue?.() || [];
    const lines = events.slice(0, 10).map((event) => `${event.createdAt}  ${event.type}`);
    alert(lines.length ? lines.join('\n') : 'No queued integration events yet.');
  });

  window.addEventListener('skyehands:bridge-event', renderQueueCount);
  window.addEventListener('storage', (event) => {
    if (event.key === 'skyehands.integration.queue.v1') renderQueueCount();
  });

  document.body.appendChild(nav);
})();
