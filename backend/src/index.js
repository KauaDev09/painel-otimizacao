'use strict';

// ORION OPTIMIZER — API de licenciamento (Node puro, sem framework).
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
const storefrontRoutes = require('./routes-storefront');

const ADMIN_DIR = path.join(__dirname, '..', 'admin');
const ADMIN_HTML = path.join(ADMIN_DIR, 'index.html');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const PUBLIC_PAGES = {
  '/': 'index.html',
  '/planos': 'planos.html',
  '/download': 'download.html',
  '/checkout': 'checkout.html',
  '/login': 'login.html',
  '/conta': 'conta.html',
  '/sucesso': 'sucesso.html',
  '/suporte': 'suporte.html'
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { ok: false, message: 'Arquivo não encontrado.' });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

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
router.get('/api/v1/health', async () => ({ ok: true, service: 'bios-optimizer-api', time: new Date().toISOString(), vurl: process.env.VERCEL_URL || null }));
licenseRoutes.register(router);
adminRoutes.register(router);
appRoutes.register(router);
storefrontRoutes.register(router);

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

async function handleRequest(req, res) {
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

  // ---- Painel administrativo mantém-se em /admin ----
  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/index.html') {
    return serveAdmin(res);
  }

  // ---- Assets estáticos do painel admin (/admin/imagem.png etc.) ----
  if (pathname.startsWith('/admin/')) {
    const route = pathname.replace(/^\/admin\//, '');
    const safe = path.normalize(route).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(ADMIN_DIR, safe);
    const ext = path.extname(filePath).toLowerCase() || '.png';
    if (filePath.startsWith(ADMIN_DIR) && /\.(png|jpg|jpeg|svg|ico|webp|gif|txt)$/i.test(filePath)) {
      return serveStatic(res, filePath, CONTENT_TYPES[ext] || 'application/octet-stream');
    }
  }

  // ---- Páginas públicas do SaaS (landing, planos, etc.) ----
  if (PUBLIC_PAGES[pathname]) {
    return serveStatic(res, path.join(PUBLIC_DIR, PUBLIC_PAGES[pathname]), CONTENT_TYPES['.html']);
  }

  // ---- Arquivos estáticos (/assets/*) ----
  if (pathname.startsWith('/assets/')) {
    const route = pathname.replace(/^\/assets\//, '');
    const safe = path.normalize(route).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(PUBLIC_DIR, 'assets', safe);
    const ext = path.extname(filePath).toLowerCase() || '.js';
    if (filePath.startsWith(PUBLIC_DIR) && /\.(css|js|svg|png|jpg|jpeg|ico|json|txt|woff2)$/i.test(filePath)) {
      return serveStatic(res, filePath, CONTENT_TYPES[ext] || 'application/octet-stream');
    }
  }

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
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(config.port, () => {
    console.log(`[api] BIOS Optimizer API ouvindo em http://0.0.0.0:${config.port}`);
    console.log(`[api] Painel administrativo: http://localhost:${config.port}/admin`);
  });
}

module.exports = { handleRequest };
