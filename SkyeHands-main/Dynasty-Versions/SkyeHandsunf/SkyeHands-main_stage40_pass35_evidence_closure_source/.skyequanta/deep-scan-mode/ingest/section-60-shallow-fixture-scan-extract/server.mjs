
import http from 'node:http';
const port = Number(process.env.PORT || 4320);
function send(res, status, body, type='application/json; charset=utf-8') { res.writeHead(status, { 'content-type': type }); res.end(body); }
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return send(res, 200, '<!doctype html><html><head><title>Section 60 Shallow Fixture</title></head><body><h1>Section 60 Shallow Fixture</h1><button id="launchBtn">Launch</button><form action="/api/echo" method="post"><input name="nonce" /></form></body></html>', 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, JSON.stringify({ ok: true, label: 'Section 60 Shallow Fixture' }));
  }
  if (req.method === 'GET' && req.url === '/pricing') {
    return send(res, 200, '<!doctype html><html><body><h1>Pricing</h1></body></html>', 'text/html; charset=utf-8');
  }
  if (req.method === 'POST' && req.url === '/api/echo') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body || '{}');
    return send(res, 200, JSON.stringify({ ok: true, echo: payload.nonce || null }));
  }
  return send(res, 404, JSON.stringify({ ok: false, path: req.url }), 'application/json; charset=utf-8');
});
server.listen(port, '127.0.0.1');
