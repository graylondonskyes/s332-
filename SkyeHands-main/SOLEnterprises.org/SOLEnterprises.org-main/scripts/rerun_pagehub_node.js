const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const INPUT = path.join(__dirname, '..', 'Pages', 'PageHub.html');
const OUT_DIR = path.join(__dirname, '..', 'pages_output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const html = fs.readFileSync(INPUT, 'utf-8');

const virtualConsole = new VirtualConsole();
const logs = [];
virtualConsole.on('log', (msg) => { logs.push('[log] ' + msg); console.log('[log]', msg); });
virtualConsole.on('info', (msg) => { logs.push('[info] ' + msg); console.info('[info]', msg); });
virtualConsole.on('warn', (msg) => { logs.push('[warn] ' + msg); console.warn('[warn]', msg); });
virtualConsole.on('error', (msg) => { logs.push('[error] ' + msg); console.error('[error]', msg); });

(async () => {
  // Provide a minimal fake canvas getContext implementation so particle canvas code runs in jsdom
  const preface = `\n<script>\nHTMLCanvasElement.prototype.getContext = function() {\n  return {\n    clearRect: function(){}, beginPath: function(){}, createRadialGradient: function(){ return { addColorStop: function(){} } }, arc: function(){}, fill: function(){}, addEventListener: function(){}, width: 0, height: 0, fillStyle: ''\n  };\n};\n// Polyfill requestAnimationFrame for jsdom environment\nwindow.requestAnimationFrame = function(cb){ return setTimeout(cb, 16); };\nwindow.cancelAnimationFrame = function(id){ clearTimeout(id); };\n</script>\n`;

  const dom = new JSDOM(preface + html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost:5000/Pages/PageHub.html',
    virtualConsole
  });

  const { window } = dom;

  // Wait for scripts to execute and for the page to settle
  function wait(ms) { return new Promise((res) => setTimeout(res, ms)); }

  // Allow inline scripts to run
  await wait(800);

  try {
    const doc = window.document;
    const refreshBtn = doc.getElementById('refreshPagesBtn');
    if (refreshBtn) {
      logs.push('[action] clicking refreshPagesBtn');
      refreshBtn.click();
      // wait for any async operations triggered by click
      await wait(800);
    } else {
      logs.push('[action] no refreshPagesBtn; assuming initial run completed');
    }
  } catch (err) {
    logs.push('[error] exception during run: ' + String(err));
  }

  // Save rendered DOM
  const outHtml = path.join(OUT_DIR, 'PageHub_rendered.html');
  fs.writeFileSync(outHtml, dom.serialize(), 'utf-8');
  console.log('Saved rendered DOM to', outHtml);

  const outLog = path.join(OUT_DIR, 'PageHub_console.log');
  fs.writeFileSync(outLog, logs.join('\n'), 'utf-8');
  console.log('Saved logs to', outLog);

  // clean up
  if (window && window.close) window.close();
})();
