
import http from 'node:http';
const port = Number(process.env.PORT || 4340);
const server = http.createServer(async (req, res) => {
  const send = (status, body, type='application/json; charset=utf-8') => { res.writeHead(status, { 'content-type': type }); res.end(body); };
  if (req.method === 'GET' && req.url === '/') return send(200, '<!doctype html><html><body><h1>Section 54 Fixture</h1><a href="/docs">Docs</a></body></html>', 'text/html; charset=utf-8');
  if (req.method === 'GET' && req.url === '/health') return send(200, JSON.stringify({ ok: true, port }));
  if (req.method === 'GET' && req.url === '/docs') return send(200, '<!doctype html><html><body><h1>Docs</h1><p>Deploy with npm run start.</p></body></html>', 'text/html; charset=utf-8');
  return send(404, JSON.stringify({ ok: false, path: req.url }));
});
server.listen(port, '127.0.0.1');
