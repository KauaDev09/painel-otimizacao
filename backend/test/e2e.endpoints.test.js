'use strict';

// Suíte E2E de segurança dos endpoints do backend (OWASP-ish, seleção 3.1 da checklist).
//
// Roda uma instância NOVA do servidor no mesmo processo (porta efêmera), com estado de
// rate-limit zerado e sem interferir no servidor do dev (8787).
//
// Requer acesso ao banco (mesma base do .env). Ativar com:
//   npm run test:e2e          (Windows: define RUN_E2E=1)
// Ou, contra um baseline próprio:
//   RUN_E2E=1 node --test test/e2e.endpoints.test.js
//
// Sem RUN_E2E=1 a suíte é pulada inteira (o `npm test` unitário não exige banco/CI).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const e2e = process.env.RUN_E2E === '1' ? test : test.skip;

const { handleRequest } = require('../src/index');
const config = require('../src/config');
const { signToken } = require('../src/util');

let server;

before(async () => {
  if (process.env.RUN_E2E !== '1') return;
  server = await new Promise((resolve) => {
    const s = http.createServer(handleRequest);
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
});

after(() => {
  if (server) server.close();
});

function api(path, opts = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const req = http.request(
      {
        host: '127.0.0.1',
        port: server.address().port,
        path,
        method: opts.method || 'GET',
        headers: { host: '127.0.0.1', ...(opts.headers || {}) }
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (d) => { data += d; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch (_) { /* não-JSON */ }
          finish({ status: res.statusCode, headers: res.headers, text: data, json });
        });
      }
    );
    req.on('error', () => finish({ status: 0, headers: {}, text: '', json: null }));
    req.on('close', () => finish({ status: 0, headers: {}, text: '', json: null }));
    req.setTimeout(10000, () => { try { req.destroy(); } catch (_) { /* ok */ } });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

e2e('health responde 200 com headers de segurança', async () => {
  const r = await api('/api/v1/health');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers['x-content-type-options'], 'nosniff');
  assert.strictEqual(r.headers['x-frame-options'], 'DENY');
  assert.strictEqual(r.headers['referrer-policy'], 'no-referrer');
});

e2e('store/login é limitado por IP (429 após N tentativas)', async () => {
  const limit = config.security.storeAuthRateLimit;
  const statuses = [];
  for (let i = 0; i < limit + 1; i++) {
    const r = await api('/api/v1/store/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usuario: 'nope', senha: 'x' })
    });
    statuses.push(r.status);
  }
  const last = statuses[statuses.length - 1];
  assert.strictEqual(last, 429, `esperado 429 no fim, veio ${statuses.join(',')}`);
  const rlBody = await (async () => {
    for (let i = 0; i < limit + 1; i++) {
      const r = await api('/api/v1/store/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ usuario: 'nope', senha: 'x' })
      });
      if (r.status === 429) return r;
    }
    return null;
  })();
  assert.ok(rlBody && rlBody.json, '429 deve retornar JSON');
  assert.strictEqual(rlBody.json.code, 'RATE_LIMITED');
});

e2e('admin/login é limitado por IP (429)', async () => {
  const limit = config.security.adminLoginRateLimit;
  let got429 = false;
  for (let i = 0; i < limit + 1; i++) {
    const r = await api('/api/v1/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usuario: 'nope', senha: 'x' })
    });
    if (r.status === 429) got429 = true;
  }
  assert.strictEqual(got429, true, 'esperado pelo menos um 429');
});

e2e('admin sem token → 401', async () => {
  const r = await api('/api/v1/admin/updates');
  assert.strictEqual(r.status, 401);
});

e2e('admin com token customer → 401 (typ errado)', async () => {
  const customer = signToken({ typ: 'customer', uid: 1 }, config.appSecret, 3600);
  const r = await api('/api/v1/admin/updates', { headers: { authorization: `Bearer ${customer}` } });
  assert.strictEqual(r.status, 401);
});

e2e('store/account sem token e com typ errado → 401', async () => {
  const noToken = await api('/api/v1/store/account/keys');
  assert.strictEqual(noToken.status, 401);
  const wrongTyp = signToken({ typ: 'admin', uid: 1 }, config.appSecret, 3600);
  const bad = await api('/api/v1/store/account/keys', { headers: { authorization: `Bearer ${wrongTyp}` } });
  assert.strictEqual(bad.status, 401);
});

e2e('corpo acima de 256 KB é rejeitado (413) ou conexão abortada', async () => {
  const big = JSON.stringify({ usuario: 'x', senha: 'y'.repeat(300 * 1024) });
  const r = await api('/api/v1/store/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: big
  });
  assert.ok(r.status === 0 || r.status === 413, `esperado abort ou 413, veio ${r.status}`);
});

e2e('JSON inválido → 400', async () => {
  const r = await api('/api/v1/store/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'isto não é json'
  });
  assert.strictEqual(r.status, 400);
});

e2e('path traversal é neutralizado (URL normaliza, nunca expõe admin API)', async () => {
  const r = await api('/api/v1/../admin/updates');
  assert.ok(!r.text.includes('"updates"'), 'não deve devolver lista de atualizações');
  const r2 = await api('/admin/../api/v1/admin/updates');
  assert.strictEqual(r2.status, 401, 'normaliza para a rota admin protegida → 401');
});