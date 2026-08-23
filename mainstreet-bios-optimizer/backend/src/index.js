'use strict';

// MAINSTREET BIOS OPTIMIZER — API de licenciamento (Node puro, sem framework).
// Responsável por: autenticação, validação/ativação/renovação/expiração/
// bloqueio de licenças, gerenciamento de dispositivos, histórico e logs.
//
// Deploy:
//   1) cp .env.example .env   (preencha APP_SECRET e credenciais do MySQL)
//   2) npm install && npm start
//   3) Aplique sql/schema.sql no banco.
//   4) Crie um administrador: node scripts/create-admin.js <usuario> <senha>

const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const licenseRoutes = require('./routes-license');
const adminRoutes = require('./routes-admin');
const appRoutes = require('./routes-app');

const ADMIN_HTML = path.join(__dirname, '..', 'admin', 'index.html');

// ---------- Roteador mínimo ----------
class Router {
  constructor() {
    this.routes = []; // { method, parts, handler }
    this.middlewares = []; // { prefix, mw }
  }
  on(method, pattern, handler) {
    this.routes.push({ method, parts: pattern.split('/').filter(Boolean), handler });
  }
  get(p, h) { this.on('GET', p, h); }
  post(p, h) { this.on('POST', p, h); }
  use(prefix, mw) { this.middlewares.push({ prefix, mw }); }

  match(method, pathname) {
    const parts = pathname.split('/').filter(Boolean);
    for (const r of this.routes) {
      if (r.method !== method || r.parts.length !== parts.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        if (r.parts[i].startsWith(':')) params[r.parts[i].slice(1)] = decodeURIComponent(parts[i]);
        else if (r.parts[i] !== parts[i]) { ok = false; break; }
      }
      if (ok) return { handler: r.handler, params };
    }
    return null;
  }

  async runMiddlewares(pathname, req) {
    for (const { prefix, mw } of this.middlewares) {
      if (!pathname.startsWith(prefix)) continue;
      const result = await mw(req);
      if (result !== undefined) return result; // resposta direta (ex.: 401)
    }
    return undefined;
  }
}

const router = new Router();
router.get('/api/v1/health', async () => ({ ok: true, service: 'bios-optimizer-api', time: new Date().toISOString() }));
licenseRoutes.register(router);
adminRoutes.register(router);
appRoutes.register(router);

// ---------- Helpers HTTP ----------
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': config.corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 256 * 1024) {
        reject(Object.assign(new Error('Corpo muito grande.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (_) { reject(Object.assign(new Error('JSON inválido.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function serveAdmin(res) {
  fs.readFile(ADMIN_HTML, (err, data) => {
    if (err) {
      sendJson(res, 404, { ok: false, message: 'Painel administrativo não encontrado.' });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': config.corsOrigin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end();
    return;
  }

  if (pathname === '/' || pathname === '/admin') return serveAdmin(res);

  const match = router.match(req.method, pathname);
  if (!match) return sendJson(res, 404, { ok: false, code: 'NOT_FOUND', message: 'Rota não encontrada.' });

  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const intercepted = await router.runMiddlewares(pathname, req);
    if (intercepted !== undefined) {
      const status = intercepted.status >= 400 ? intercepted.status : 200;
      return sendJson(res, status, intercepted);
    }
    const payload = await match.handler(body, match.params, urlObj, req);
    const status = payload && payload.status >= 400 ? payload.status : 200;
    return sendJson(res, status, payload);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[api]', err);
    return sendJson(res, status, err.payload || { ok: false, code: 'SERVER_ERROR', message: 'Erro interno do servidor.' });
  }
});

server.listen(config.port, () => {
  console.log(`[api] BIOS Optimizer API ouvindo em http://0.0.0.0:${config.port}`);
  console.log(`[api] Painel administrativo: http://localhost:${config.port}/admin`);
});
