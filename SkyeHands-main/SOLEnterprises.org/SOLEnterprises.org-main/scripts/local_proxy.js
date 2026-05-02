const http = require('http');
const fs = require('fs');
const path = require('path');
const Module = require('module');

// ensure minimal SMTP env vars for the handler
process.env.SMTP_HOST = process.env.SMTP_HOST || 'smtp.example.com';
process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
process.env.SMTP_USER = process.env.SMTP_USER || 'user';
process.env.SMTP_PASS = process.env.SMTP_PASS || 'pass';
process.env.MAIL_TO = process.env.MAIL_TO || 'Contact@Solenterprises.org';

// Mock nodemailer to avoid installing dependencies in this environment
const origLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'nodemailer') {
    return {
      createTransport: () => ({
        sendMail: (opts) => {
          console.log('[local-proxy] mock sendMail called');
          console.log(opts);
          return Promise.resolve({ accepted: [process.env.MAIL_TO] });
        }
      })
    };
  }
  return origLoad(request, parent, isMain);
};

const handler = require('../netlify/functions/contact.js').handler;

const PUBLIC = path.resolve(process.cwd());

function sendFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const ct = {
      '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'
    }[ext] || 'application/octet-stream';
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

  // Serve static files from repo root
  let filePath = path.join(PUBLIC, decodeURIComponent(url.pathname));
  if (filePath.endsWith(path.sep)) filePath = path.join(filePath, 'index.html');
  // Security: prevent escaping PUBLIC
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  // If path is directory or missing extension and not found, try serving index.html
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) return sendFile(res, filePath);
    // try Pages path
    const pagesPath = path.join(PUBLIC, url.pathname.replace(/^\//,'') );
    if (pagesPath && fs.existsSync(pagesPath)) return sendFile(res, pagesPath);
    const fallback = path.join(PUBLIC, 'index.html');
    if (fs.existsSync(fallback)) return sendFile(res, fallback);
    res.writeHead(404); res.end('Not found');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[local-proxy] Server listening on http://localhost:${PORT}`);
  console.log(`[local-proxy] Serving site from ${PUBLIC}`);
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
