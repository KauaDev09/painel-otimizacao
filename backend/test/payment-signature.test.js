'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { createProvider } = require('../src/services/paymentProvider');

// Caminho do webhook (constante no adapter — reproduzida aqui no teste).
const WEBHOOK_PATH = '/api/v1/public/webhooks/mercadopago';

function hmacSignature(body, secret, ts) {
  const txt = body.TXT ? String(body.TXT) : JSON.stringify(body);
  const id = String((body && body.data && body.data.id) || '');
  const toSign = `${id}.${txt}.${WEBHOOK_PATH}`;
  return crypto.createHmac('sha256', secret).update(toSign).digest('hex');
}

test('sem segredo configurado → verificação retorna null (não bloqueia)', () => {
  const provider = createProvider();
  provider.webhookSecret = '';
  const body = { type: 'payment', data: { id: '123' }, TXT: 'abc' };
  assert.strictEqual(provider.verifySignature(body, {}), null);
});

test('assinatura válida é aceita', () => {
  const provider = createProvider();
  const secret = 'segredo-de-teste';
  provider.webhookSecret = secret;
  const body = { type: 'payment', data: { id: '123456' }, TXT: 'XYZ-001' };
  const ts = Math.floor(Date.now() / 1000);
  const v1 = hmacSignature(body, secret, ts);
  const ok = provider.verifySignature(body, { 'x-signature': `ts=${ts},v1=${v1}` });
  assert.strictEqual(ok, true);
});

test('assinatura inválida é rejeitada', () => {
  const provider = createProvider();
  const secret = 'segredo-de-teste';
  provider.webhookSecret = secret;
  const body = { type: 'payment', data: { id: '654321' }, TXT: 'XYZ-002' };
  const ts = Math.floor(Date.now() / 1000);
  const wrong = 'f'.repeat(64);
  assert.strictEqual(provider.verifySignature(body, { 'x-signature': `ts=${ts},v1=${wrong}` }), false);
});

test('assinatura de um payload não serve para outro (vazamento de contexto)', () => {
  const provider = createProvider();
  const secret = 'segredo-de-teste';
  provider.webhookSecret = secret;
  const bodyA = { type: 'payment', data: { id: '111' }, TXT: 'A' };
  const ts = Math.floor(Date.now() / 1000);
  const v1 = hmacSignature(bodyA, secret, ts);
  const bodyB = { type: 'payment', data: { id: '222' }, TXT: 'B' };
  assert.strictEqual(provider.verifySignature(bodyB, { 'x-signature': `ts=${ts},v1=${v1}` }), false);
});

test('cabeçalho x-signature malformado é rejeitado', () => {
  const provider = createProvider();
  provider.webhookSecret = 'segredo-de-teste';
  const body = { type: 'payment', data: { id: '999' } };
  assert.strictEqual(provider.verifySignature(body, { 'x-signature': 'garbage' }), false);
  assert.strictEqual(provider.verifySignature(body, {}), false);
});