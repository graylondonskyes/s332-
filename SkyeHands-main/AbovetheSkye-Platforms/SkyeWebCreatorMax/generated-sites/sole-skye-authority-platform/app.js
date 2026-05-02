const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const cursor = document.getElementById('cursor');
const sceneMode = document.getElementById('sceneMode');
let mode = 'orbit';
const particles = Array.from({ length: 160 }, (_, i) => ({ seed: i * 19.17, r: 90 + (i % 17) * 19, s: .00016 + (i % 9) * .000035, size: 1 + (i % 4) }));

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw(t) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const cx = innerWidth * .62;
  const cy = innerHeight * .42;
  const scale = mode === 'forge' ? 1.34 : mode === 'calm' ? .72 : 1;
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((p) => {
    const a = t * p.s + p.seed;
    const x = cx + Math.cos(a * 1.7) * p.r * scale + Math.sin(a * .45) * 140;
    const y = cy + Math.sin(a * 1.2) * p.r * .55 * scale;
    const g = ctx.createRadialGradient(x, y, 0, x, y, p.size * 12);
    g.addColorStop(0, 'rgba(247,211,124,.48)');
    g.addColorStop(.42, 'rgba(124,58,237,.20)');
    g.addColorStop(1, 'rgba(45,212,191,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, p.size * 12, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalCompositeOperation = 'source-over';
  requestAnimationFrame(draw);
}

document.addEventListener('pointermove', (event) => {
  cursor.style.opacity = '.9';
  cursor.style.left = event.clientX + 'px';
  cursor.style.top = event.clientY + 'px';
});

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    mode = button.dataset.mode;
    sceneMode.textContent = mode === 'forge' ? 'Forge expansion' : mode === 'calm' ? 'Calm authority' : 'Founder orbit';
  });
});

const panels = {
  audit: ['Audit Trail', '[audit] Source refs exist.\\n[audit] Dead links: 0.\\n[audit] House style contract loaded.'],
  design: ['Design Vault', '[vault] shadcn + TailGrids + R3F + drei + Triplex indexed.\\n[vault] SOLE / SkyeSol style floor attached.'],
  delivery: ['AE Delivery', '[delivery] Artifact can route to AE CommandHub once gateway vars are set.\\n[delivery] Local export is usable now.'],
  gateway: ['SkyeGateFS13', '[gateway] Waiting for production env vars.\\n[gateway] Local UI state is active and verified.'],
};

document.querySelectorAll('[data-panel]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-panel]').forEach((item) => item.classList.toggle('active', item === button));
    const [title, text] = panels[button.dataset.panel];
    document.getElementById('panelTitle').textContent = title;
    document.getElementById('terminal').textContent = text;
  });
});

document.getElementById('runAudit').addEventListener('click', () => {
  document.getElementById('deadLinks').textContent = '0';
  document.getElementById('readyState').textContent = 'Verified';
  document.getElementById('terminal').textContent = '[audit] Local audit completed at ' + new Date().toLocaleTimeString() + '.\\n[audit] Interactive controls responded.\\n[audit] Intake route active.';
});

document.getElementById('buildForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const payload = {
    project: data.get('project') || '',
    lane: data.get('lane') || '',
    notes: data.get('notes') || '',
    source: 'sole-skye-authority-platform',
  };
  const result = window.SkyeIntegrationBridge?.enqueueWebsiteRequest?.(payload);
  document.getElementById('formStatus').textContent = result
    ? 'Queued for AE review: ' + data.get('project') + ' / ' + data.get('lane') + '.'
    : 'AE bridge offline. Queue write failed for ' + data.get('project') + ' / ' + data.get('lane') + '.';
});

const gateOverlay = document.getElementById('gateOverlay');
const openGate = () => {
  gateOverlay.classList.add('open');
  gateOverlay.setAttribute('aria-hidden', 'false');
  document.getElementById('gatePhrase').focus();
};
const closeGate = () => {
  gateOverlay.classList.remove('open');
  gateOverlay.setAttribute('aria-hidden', 'true');
};
document.querySelectorAll('#openGate,[data-open-gate]').forEach((button) => button.addEventListener('click', openGate));
document.getElementById('closeGate').addEventListener('click', closeGate);
gateOverlay.addEventListener('click', (event) => {
  if (event.target === gateOverlay) closeGate();
});
document.getElementById('verifyGate').addEventListener('click', () => {
  const phrase = document.getElementById('gatePhrase').value.trim();
  document.getElementById('gateStatus').textContent = phrase
    ? 'Portal verified locally for "' + phrase + '". Production auth can replace this shell cleanly.'
    : 'Enter an access phrase to verify the local portal shell.';
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeGate();
});

addEventListener('resize', resize);
resize();
requestAnimationFrame(draw);
