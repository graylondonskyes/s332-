const http = require('http');
const fs = require('fs');
const path = require('path');

// Ensure required SMTP env vars are present
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO, MAIL_FROM } = process.env;

const PUBLIC = path.resolve(process.cwd());
if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
  console.error('Missing SMTP env vars. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.');
  process.exit(1);
}

let nodemailer;
try {
  // Prefer project-local netlify function node_modules if present
  const candidates = [
    path.join(PUBLIC, 'netlify', 'functions', 'node_modules', 'nodemailer'),
    path.join(PUBLIC, 'contact_api', 'netlify', 'functions', 'node_modules', 'nodemailer')
  ];
  let loaded = false;
  for (const nmPath of candidates) {
    if (fs.existsSync(nmPath)) {
      nodemailer = require(nmPath);
      loaded = true;
      break;
    }
  }
  if (!loaded) nodemailer = require('nodemailer');
} catch (err) {
  console.error('nodemailer not found. Install nodemailer in the project or ensure netlify/functions/node_modules exists.');
  throw err;
}
// Ensure when contact.js calls require('nodemailer') it resolves to our loaded instance
const Module = require('module');
const origLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'nodemailer') return nodemailer;
  return origLoad(request, parent, isMain);
};

const handler = require('../netlify/functions/contact.js').handler;
// restore original loader to avoid side-effects
Module._load = origLoad;

function sendFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    const ct = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'POST' && url.pathname === '/api/contact') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        // Use the same handler but ensure MAIL_FROM/MAIL_TO are set
        const event = { httpMethod: 'POST', body };
        const out = await handler(event);
        const status = out.statusCode || 200;
        const bodyOut = out.body || '';
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(typeof bodyOut === 'string' ? bodyOut : JSON.stringify(bodyOut));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Handler error: ' + err.message);
      }
    });
    return;
  }

  // Serve static files
  let filePath = path.join(PUBLIC, decodeURIComponent(url.pathname));
  if (filePath.endsWith(path.sep)) filePath = path.join(filePath, 'index.html');
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) return sendFile(res, filePath);
    const fallback = path.join(PUBLIC, 'index.html');
    if (fs.existsSync(fallback)) return sendFile(res, fallback);
    res.writeHead(404); res.end('Not found');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`[local-proxy-real] listening http://localhost:${PORT}`));
process.on('SIGINT', () => { server.close(() => process.exit(0)); });
