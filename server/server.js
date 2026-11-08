// Tiny JSON API. Nginx serves the static frontend and proxies /api here; binds to localhost only.
import http from 'node:http';
import { searchCities, getPlan, reverseCity, routeBetween, placePhoto } from './data.js';

const send = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const routes = {
  '/api/health': () => ({ ok: true }),
  '/api/cities': (q) => searchCities(q.get('q')),
  '/api/plan': (q) => getPlan(Object.fromEntries(q)),
  '/api/reverse': (q) => reverseCity(Object.fromEntries(q)),
  '/api/route': (q) => routeBetween(Object.fromEntries(q)),
};

const port = Number(process.env.PORT) || 3000;
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/photo') { // the one binary route
    try {
      const p = await placePhoto(url.searchParams.get('name'));
      res.writeHead(200, { 'content-type': p.type, 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' });
      return res.end(p.body);
    } catch (e) {
      if (!e.status) console.error('/api/photo', e.message);
      return send(res, e.status || 502, { error: e.status ? e.message : 'Photo unavailable.' });
    }
  }
  const route = req.method === 'GET' && routes[url.pathname];
  if (!route) return send(res, 404, { error: 'Not found' });
  try {
    send(res, 200, await route(url.searchParams));
  } catch (e) {
    if (!e.status) console.error(url.pathname, e.message);
    send(res, e.status || 502, { error: e.status ? e.message : 'A data source is unavailable. Please try again.' });
  }
}).listen(port, '127.0.0.1', () => console.log(`API on http://127.0.0.1:${port}`));
