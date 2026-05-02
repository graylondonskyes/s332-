const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
let sceneMode = 'orbit';
const nodes = Array.from({ length: 180 }, (_, i) => ({ seed: i * 11.91, r: 80 + (i % 13) * 22, s: .00018 + (i % 8) * .000045, size: 1 + (i % 5) }));

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
  const cx = innerWidth * .68;
  const cy = innerHeight * .48;
  const modeScale = sceneMode === 'explode' ? 1.42 : sceneMode === 'calm' ? .72 : 1;
  ctx.globalCompositeOperation = 'lighter';
  nodes.forEach((n) => {
    const a = t * n.s + n.seed;
    const x = cx + Math.cos(a * 1.7) * n.r * modeScale + Math.sin(a * .4) * 110;
    const y = cy + Math.sin(a * 1.1) * n.r * .55 * modeScale;
    const g = ctx.createRadialGradient(x, y, 0, x, y, n.size * 13);
    g.addColorStop(0, 'rgba(57,255,136,.7)');
    g.addColorStop(.45, 'rgba(93,241,255,.22)');
    g.addColorStop(1, 'rgba(255,79,216,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, n.size * 13, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(57,255,136,.34)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, (180 + Math.sin(t * .001) * 18) * modeScale, 82 * modeScale, Math.sin(t * .0004) * .4, 0, Math.PI * 2);
  ctx.stroke();
  requestAnimationFrame(draw);
}

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    sceneMode = button.dataset.mode;
    document.getElementById('demoState').textContent = 'Scene mode: ' + sceneMode;
    document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
  });
});

document.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const email = data.get('email') || 'this visitor';
  const payload = {
    email,
    brief: data.get('brief') || '',
    source: 'spatial-product-showcase',
  };
  const result = window.SkyeIntegrationBridge?.enqueueWebsiteRequest?.(payload);
  document.getElementById('formStatus').textContent = result
    ? 'Website request queued for AE review for ' + email + '.'
    : 'AE bridge offline. Website request was not queued for ' + email + '.';
});

addEventListener('resize', resize);
resize();
requestAnimationFrame(draw);
